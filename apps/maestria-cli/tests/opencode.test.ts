import { Effect } from 'effect';
import { parse } from 'jsonc-parser/lib/esm/main.js';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  installOpenCode,
  maestriaEntries,
  openCodeInstalledVersion,
  removeLegacyEntries,
  uninstallOpenCode,
  updateOpenCode,
  withOptions,
} from '@/lib/opencode.js';
import * as shell from '@/lib/shell.js';

vi.mock('@/lib/shell.js', async (importOriginal) => {
  const actual = await importOriginal<typeof shell>();
  return { ...actual, run: vi.fn(() => Effect.succeed('')) };
});

const config = `{
  // keep this comment
  "plugin": ["other-plugin", ["@maestria/opencode@0.8.0", { "x": 1 }], "@maestria/opencode"],
  "plugins": [
    "@maestria/opencode-v2",
    { "package": "@maestria/opencode@0.9.0", "options": { "modes": { "disabledKeywords": ["blitz"] } } },
    "@maestria/opencode-extras"
  ]
}`;

describe('OpenCode plugin entries', () => {
  it('finds maestria and preview entries in V2 objects and V1 tuples, not other packages', () => {
    expect(maestriaEntries(config, 'plugins')).toEqual([
      { index: 0, options: undefined, spec: '@maestria/opencode-v2' },
      {
        index: 1,
        options: { modes: { disabledKeywords: ['blitz'] } },
        spec: '@maestria/opencode@0.9.0',
      },
    ]);
    expect(maestriaEntries(config, 'plugin').map((entry) => entry.spec)).toEqual([
      '@maestria/opencode@0.8.0',
      '@maestria/opencode',
    ]);
  });

  it('removes only maestria from the V1 plugin array and keeps comments', () => {
    const next = removeLegacyEntries(config);
    expect(parse(next)).toMatchObject({ plugin: ['other-plugin'] });
    expect(maestriaEntries(next, 'plugins')).toEqual(maestriaEntries(config, 'plugins'));
    expect(next).toContain('// keep this comment');
  });

  it('carries plugin options onto a re-added entry', () => {
    const added = '{ "plugins": ["other", "@maestria/opencode@0.8.0"] }';
    const next = withOptions(added, '@maestria/opencode@0.8.0', { modes: {} });
    expect(parse(next)).toEqual({
      plugins: ['other', { options: { modes: {} }, package: '@maestria/opencode@0.8.0' }],
    });
    expect(withOptions(added, '@maestria/opencode@0.8.0')).toBe(added);
  });
});

const specOf = (entry: unknown): unknown =>
  typeof entry === 'object' && entry !== null && 'package' in entry ? entry.package : entry;

// A fake `opencode` CLI that edits the global config the way OpenCode 2.0.28 does: `plugin add`
// appends a new spec and ignores a configured one, and `plugin remove` needs the exact spec.
describe('OpenCode CLI flows', () => {
  let configFile: string;
  let host: { version: string; failAdd: boolean; calls: string[] };

  const writeConfig = (value: unknown): void => {
    writeFileSync(configFile, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const readConfig = (): Record<string, unknown> => {
    const value: unknown = parse(readFileSync(configFile, 'utf-8'));
    return typeof value === 'object' && value !== null ? { ...value } : {};
  };
  const pluginsOf = (): unknown[] => {
    const { plugins } = readConfig();
    return Array.isArray(plugins) ? plugins : [];
  };

  const fakeOpenCode = (args: readonly string[]): Effect.Effect<string, shell.CommandError> => {
    host.calls.push(args.join(' '));
    const [command, action, spec] = args;
    if (command === '--version') {
      return Effect.succeed(host.version);
    }
    const plugins = pluginsOf();
    if (action === 'add' && host.failAdd) {
      return Effect.fail(new shell.CommandError({ command: 'opencode', message: 'fetch failed' }));
    }
    if (action === 'add' && !plugins.some((entry) => specOf(entry) === spec)) {
      writeConfig({ ...readConfig(), plugins: [...plugins, spec] });
    }
    if (action === 'remove') {
      const kept = plugins.filter((entry) => specOf(entry) !== spec);
      if (kept.length === plugins.length) {
        return Effect.fail(
          new shell.CommandError({ command: 'opencode', message: 'not configured' }),
        );
      }
      writeConfig({ ...readConfig(), plugins: kept });
    }
    return Effect.succeed('');
  };

  beforeEach(() => {
    const root = mkdtempSync(path.join(tmpdir(), 'maestria-opencode-flows-'));
    vi.stubEnv('XDG_CONFIG_HOME', path.join(root, 'config'));
    vi.stubEnv('XDG_CACHE_HOME', path.join(root, 'cache'));
    mkdirSync(path.join(root, 'config', 'opencode'), { recursive: true });
    configFile = path.join(root, 'config', 'opencode', 'opencode.jsonc');
    host = { calls: [], failAdd: false, version: 'opencode v2.0.28' };
    vi.mocked(shell.run).mockImplementation((_command, args) => fakeOpenCode(args));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('install moves a V1 entry to plugins', async () => {
    writeConfig('{ "plugin": ["@maestria/opencode@latest", "other"], "plugins": ["x"] }');
    await Effect.runPromise(installOpenCode);
    expect(readConfig()).toEqual({ plugin: ['other'], plugins: ['x', '@maestria/opencode'] });
  });

  it('install replaces the preview package and keeps its options', async () => {
    const options = { modes: { disabledKeywords: ['blitz'] } };
    writeConfig({ plugins: [{ options, package: '@maestria/opencode-v2' }] });
    await Effect.runPromise(installOpenCode);
    expect(pluginsOf()).toEqual([{ options, package: '@maestria/opencode' }]);
  });

  it('updates a lone unpinned entry in place', async () => {
    const options = { modes: {} };
    writeConfig({ plugins: [{ options, package: '@maestria/opencode' }] });
    await Effect.runPromise(updateOpenCode());
    expect(host.calls).toEqual(['--version', 'plugin update @maestria/opencode']);
    expect(pluginsOf()).toEqual([{ options, package: '@maestria/opencode' }]);
  });

  it('drops a leftover preview entry instead of updating in place', async () => {
    writeConfig({ plugins: ['@maestria/opencode', '@maestria/opencode-v2'] });
    await Effect.runPromise(updateOpenCode());
    expect(host.calls).toEqual(['--version', 'plugin remove @maestria/opencode-v2']);
    expect(pluginsOf()).toEqual(['@maestria/opencode']);
  });

  it('pins by adding first, carrying options, and removing each old spec once', async () => {
    const options = { modes: {} };
    writeConfig({
      plugins: [{ options, package: '@maestria/opencode' }, '@maestria/opencode', 'other'],
    });
    await Effect.runPromise(updateOpenCode('0.9.1'));
    expect(host.calls.slice(1)).toEqual([
      'plugin add @maestria/opencode@0.9.1',
      'plugin remove @maestria/opencode',
    ]);
    expect(pluginsOf()).toEqual(['other', { options, package: '@maestria/opencode@0.9.1' }]);
  });

  it('keeps the existing entry when fetching the new version fails', async () => {
    const before = { plugins: [{ options: { modes: {} }, package: '@maestria/opencode' }] };
    writeConfig(before);
    host.failAdd = true;
    await expect(Effect.runPromise(updateOpenCode('0.9.1'))).rejects.toThrow('fetch failed');
    expect(readConfig()).toEqual(before);
  });

  it.each(['1.18.31', 'opencode v2.0.5', ''])(
    'refuses OpenCode %j, older than 2.0.28, without touching the config',
    async (version) => {
      writeConfig('{ "plugin": ["@maestria/opencode@latest"] }');
      host.version = version;
      await expect(Effect.runPromise(installOpenCode)).rejects.toThrow('@maestria/opencode@0.8.0');
      expect(readConfig()).toEqual({ plugin: ['@maestria/opencode@latest'] });
    },
  );

  it('accepts a newer OpenCode V2 minor release', async () => {
    writeConfig('{}');
    host.version = 'opencode v2.1.0';
    await Effect.runPromise(installOpenCode);
    expect(pluginsOf()).toEqual(['@maestria/opencode']);
  });

  it('uninstall removes every maestria spec once and the V1 entry', async () => {
    writeConfig({
      plugin: ['@maestria/opencode'],
      plugins: ['@maestria/opencode', '@maestria/opencode', '@maestria/opencode-v2', 'other'],
    });
    await Effect.runPromise(uninstallOpenCode);
    expect(readConfig()).toEqual({ plugin: [], plugins: ['other'] });
  });

  it('reads the installed version from the newest cached install of the configured spec', async () => {
    writeConfig({ plugins: ['@maestria/opencode-v2', '@maestria/opencode'] });
    const cache = path.join(process.env.XDG_CACHE_HOME ?? '', 'opencode', 'npm');
    for (const [install, version] of [
      ['1791476216847', '0.9.0'],
      ['1791913814339', '0.9.1'],
    ]) {
      const dir = path.join(
        cache,
        '@maestria/opencode@latest',
        install,
        'node_modules/@maestria/opencode',
      );
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version }));
    }
    expect(await Effect.runPromise(openCodeInstalledVersion)).toBe('0.9.1');
  });
});

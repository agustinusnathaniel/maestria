import { beforeAll, describe, it, expect } from 'vite-plus/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  BeforeAgentStartEventResult,
  ExtensionAPI,
  ExtensionCommandContext,
} from '../src/pi-api.ts';
import { MODE_STATE_CUSTOM_TYPE } from '../src/state.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PACKAGE_ROOT, 'src');
const DIST_EXTENSION = path.join(PACKAGE_ROOT, 'dist', 'extension.mjs');

interface PackageJson {
  name?: string;
  files?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  pi?: { extensions?: string[]; skills?: string[] };
}

async function readJson<T>(relativePath: string): Promise<T> {
  const absolute = path.join(PACKAGE_ROOT, relativePath);
  const raw = await readFile(absolute, 'utf8');
  return JSON.parse(raw) as T;
}

/** Read all src file contents, recursively. */
async function readSrcFiles(): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name.endsWith('.ts')) {
        out.push(await readFile(full, 'utf8'));
      }
    }
  }
  await walk(SRC_DIR);
  return out;
}

describe('prime-agent package manifest (Prime/Pi discovery)', () => {
  it('declares the compiled extension under pi.extensions', async () => {
    const pkg = await readJson<PackageJson>('package.json');
    expect(pkg.pi?.extensions).toContain('./dist/extension.mjs');
  });

  it('declares the skills projection under pi.skills', async () => {
    const pkg = await readJson<PackageJson>('package.json');
    expect(pkg.pi?.skills).toContain('./skills');
  });

  it('ships dist/ and skills/ in the published files', async () => {
    const pkg = await readJson<PackageJson>('package.json');
    expect(pkg.files).toContain('dist');
    expect(pkg.files).toContain('skills');
  });

  it('builds the declared extension file via the build script', async () => {
    const pkg = await readJson<PackageJson>('package.json');
    expect(pkg.scripts?.build).toBe('vp pack');
  });
});

describe('prime-agent dependency boundary', () => {
  it('has no runtime, dev, or peer dependency on @maestria/pi', async () => {
    const pkg = await readJson<PackageJson>('package.json');
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
      expect(pkg[section]?.['@maestria/pi']).toBeUndefined();
    }
  });

  it('declares no runtime dependency on the unpublished Prime fork of pi-coding-agent', async () => {
    // The Prime-compatible @earendil-works/pi-coding-agent@0.7.2 is not on npm
    // (the registry carries the original Pi line, latest 0.84.1); Prime bundles
    // the pi API into its runtime. The extension consumes the API exclusively
    // through the runtime-provided `pi` object with type-only local declarations,
    // so no runtime/peer dependency is declared.
    const pkg = await readJson<PackageJson>('package.json');
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.peerDependencies?.['@earendil-works/pi-coding-agent']).toBeUndefined();
  });

  it('imports no pi package at runtime from src (types are local and erased)', async () => {
    const sources = await readSrcFiles();
    for (const source of sources) {
      expect(source).not.toMatch(/from\s+['"]@earendil-works\/pi-coding-agent['"]/);
      expect(source).not.toMatch(/from\s+['"]@earendil-works\/pi-(ai|agent-core|tui)['"]/);
    }
  });

  it('imports no internal Prime src/core/* modules (public API only)', async () => {
    const sources = await readSrcFiles();
    for (const source of sources) {
      // Only import specifiers matter; comments legitimately cite the upstream
      // source path for the evidence pin.
      expect(source).not.toMatch(/from\s+['"][^'"]*src\/core\//);
    }
  });

  it('performs no filesystem writes from src (state rides on host session entries)', async () => {
    const sources = await readSrcFiles();
    for (const source of sources) {
      expect(source).not.toMatch(/writeFile|appendFile|mkdir|createWriteStream|openSync|writeSync/);
    }
  });
});

describe('prime-agent built extension artifact', () => {
  it('builds the declared extension artifact (dist/extension.mjs)', () => {
    // package.json declares pi.extensions: ["./dist/extension.mjs"], so a
    // missing artifact is a packaging failure, not a reason to skip. The
    // package test script builds first (`vp pack && vp test`); this assertion
    // still fails clearly for direct `vp test` runs on an unbuilt tree.
    expect(existsSync(DIST_EXTENSION), `missing ${DIST_EXTENSION} - run \`pnpm build\` first`).toBe(
      true,
    );
  });

  it('exports a default factory function (built artifact)', async () => {
    const mod = (await import(DIST_EXTENSION)) as { default?: unknown };
    expect(typeof mod.default).toBe('function');
  });

  it('registers the mode commands when invoked (built-artifact smoke)', async () => {
    const mod = (await import(DIST_EXTENSION)) as { default: (pi: ExtensionAPI) => void };
    const commands: string[] = [];
    const pi: ExtensionAPI = {
      on: () => {},
      registerCommand: (name) => {
        commands.push(name);
      },
      appendEntry: () => {},
      sendUserMessage: () => {},
    };
    mod.default(pi);
    expect(commands).toEqual(['fein', 'sonar', 'blitz', 'mode-clear', 'maestria-status']);
  });

  it('exercises command behavior and mode prompt injection (built-artifact smoke)', async () => {
    // The built artifact is the code Prime actually loads; exercise behavior
    // beyond registration against a fake `pi` (no live Prime binary needed).
    const mod = (await import(DIST_EXTENSION)) as { default: (pi: ExtensionAPI) => void };
    const handlers = new Map<string, (event: unknown, ctx: unknown) => unknown>();
    const commands: Array<{
      name: string;
      handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
    }> = [];
    const entries: Array<{ customType: string; data?: unknown }> = [];
    const sentMessages: Array<{ content: string; options?: { deliverAs?: 'steer' | 'followUp' } }> =
      [];
    const pi: ExtensionAPI = {
      on: ((event, handler) => {
        handlers.set(event, handler as (event: unknown, ctx: unknown) => unknown);
      }) as ExtensionAPI['on'],
      registerCommand: (name, options) => {
        commands.push({ name, handler: options.handler });
      },
      appendEntry: (customType, data) => {
        entries.push({ customType, data });
      },
      sendUserMessage: (content, options) => {
        sentMessages.push({ content, options });
      },
    };

    mod.default(pi);

    // Command behavior: `/fein <goal>` sets the mode, persists a custom entry,
    // and steers the goal to the agent.
    const fein = commands.find((c) => {
      return c.name === 'fein';
    });
    expect(fein).toBeDefined();
    // Only the notify method is exercised by the command handler; the rest of
    // the context is a stub (same pattern as tests/extension.test.ts).
    await fein!.handler('implement the pipeline', {
      ui: { notify: () => {} },
    } as unknown as ExtensionCommandContext);
    expect(entries.at(-1)).toEqual({
      customType: MODE_STATE_CUSTOM_TYPE,
      data: { mode: 'fein' },
    });
    expect(sentMessages).toEqual([
      { content: 'implement the pipeline', options: { deliverAs: 'steer' } },
    ]);

    // Mode prompt injection: the active mode appends the generated
    // skills/fein/SKILL.md mode section to the chained system prompt on the
    // next agent turn. A missing skill file would degrade to "no injection"
    // and fail this assertion, so the test is not vacuous.
    const beforeAgentStart = handlers.get('before_agent_start');
    expect(beforeAgentStart).toBeDefined();
    const result = (await beforeAgentStart!(
      { type: 'before_agent_start', prompt: 'implement the pipeline', systemPrompt: 'BASE' },
      {},
    )) as BeforeAgentStartEventResult | void;
    const systemPrompt = (result as BeforeAgentStartEventResult | undefined)?.systemPrompt;
    expect(systemPrompt).toBeDefined();
    expect(systemPrompt).toContain('[MODE: fein]');
    expect(systemPrompt).toContain('## MODE: fein');
  });
});

describe('prime-agent package tarball (npm pack --dry-run)', () => {
  /**
   * The file list npm would pack, per `npm pack --dry-run --json`.
   *
   * This is the regression guard for the packaging/install blocker: `dist/` is
   * gitignored, so a publish/pack of a clean tree without a build silently
   * omits the extension Prime is told to load (`pi.extensions`). The package
   * test script builds first (`vp pack && vp test`), so the dry-run here
   * reflects a built tree, and the `files` allowlist in package.json is what
   * npm actually honors (gitignore does not exclude allowlisted files).
   * Deterministic: local-only, no network, no live Prime binary required.
   */
  function npmPackFileList(): string[] {
    const stdout = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(stdout) as Array<{ files?: Array<{ path: string }> }>;
    const result = parsed[0];
    if (!result?.files) {
      throw new Error('npm pack --dry-run --json returned no file list');
    }
    return result.files.map((f) => {
      return f.path;
    });
  }

  // npm pack is relatively expensive in this workspace. Reuse the one
  // deterministic dry-run result across assertions so the tests do not race
  // Vitest's default per-test timeout by spawning npm three times.
  let packFiles: string[];
  beforeAll(() => {
    packFiles = npmPackFileList();
  }, 30_000);

  it('packs the compiled extension, its sourcemap, and the manifest', () => {
    for (const required of [
      'package.json',
      'INSTALL.md',
      'README.md',
      'LICENSE',
      'dist/extension.mjs',
      'dist/extension.mjs.map',
    ]) {
      expect(packFiles, `tarball must include ${required}`).toContain(required);
    }
  });

  it('packs every generated skill directory', async () => {
    const skillNames = (
      await readdir(path.join(PACKAGE_ROOT, 'skills'), {
        withFileTypes: true,
      })
    )
      .filter((e) => {
        return e.isDirectory();
      })
      .map((e) => {
        return e.name;
      });
    expect(skillNames.length).toBeGreaterThan(0);

    for (const name of skillNames) {
      expect(packFiles, `tarball must include skills/${name}/SKILL.md`).toContain(
        `skills/${name}/SKILL.md`,
      );
    }
  });

  it('excludes source, tests, and dependency trees from the tarball', () => {
    for (const excluded of ['src/', 'tests/', 'node_modules/', 'scripts/']) {
      expect(
        packFiles.some((f) => {
          return f.startsWith(excluded);
        }),
      ).toBe(false);
    }
  });
});

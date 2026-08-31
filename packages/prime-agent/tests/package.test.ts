import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vite-plus/test';

import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionEventRegistration,
  ExtensionFactory,
  RegisteredCommandOptions,
} from '../src/pi-api.ts';
import { MODE_STATE_CUSTOM_TYPE } from '../src/state.ts';

const __dirname = import.meta.dirname;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string');

const isPiManifest = (value: unknown): value is NonNullable<PackageJson['pi']> => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    (value.extensions === undefined || isStringArray(value.extensions)) &&
    (value.skills === undefined || isStringArray(value.skills))
  );
};

const isPackageJson = (value: unknown): value is PackageJson => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    (value.name === undefined || typeof value.name === 'string') &&
    (value.files === undefined || isStringArray(value.files)) &&
    (value.dependencies === undefined || isStringRecord(value.dependencies)) &&
    (value.devDependencies === undefined || isStringRecord(value.devDependencies)) &&
    (value.peerDependencies === undefined || isStringRecord(value.peerDependencies)) &&
    (value.scripts === undefined || isStringRecord(value.scripts)) &&
    (value.pi === undefined || isPiManifest(value.pi))
  );
};

const readJson = async (relativePath: string): Promise<PackageJson> => {
  const absolute = path.join(PACKAGE_ROOT, relativePath);
  const raw = await readFile(absolute, 'utf-8');
  const value: unknown = JSON.parse(raw);
  if (!isPackageJson(value)) {
    throw new Error(`${relativePath} does not contain a valid package manifest`);
  }
  return value;
};

/** Read all src file contents, recursively. */
const readSrcFilesRecursively = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return await readSrcFilesRecursively(full);
      }
      return entry.name.endsWith('.ts') ? [await readFile(full, 'utf-8')] : [];
    }),
  );
  return nestedFiles.flat();
};

const readSrcFiles = async (): Promise<string[]> => await readSrcFilesRecursively(SRC_DIR);

const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value);

const isNpmPackFileList = (value: unknown): value is { path: string }[] =>
  isUnknownArray(value) && value.every((file) => isRecord(file) && typeof file.path === 'string');

const isExtensionFactory = (value: unknown): value is ExtensionFactory =>
  typeof value === 'function';

const loadExtensionFactory = async (): Promise<ExtensionFactory> => {
  const moduleValue: unknown = await import(DIST_EXTENSION);
  if (!isRecord(moduleValue) || !isExtensionFactory(moduleValue.default)) {
    throw new Error('built extension does not export a default factory function');
  }
  return moduleValue.default;
};

const extensionContext: ExtensionContext = {
  cwd: '/',
  hasUI: true,
  sessionManager: {
    getBranch: () => [],
    getEntries: () => [],
  },
  ui: { notify: () => {}, setEditorText: () => {} },
};

describe('prime-agent package manifest (Prime/Pi discovery)', () => {
  it('declares the compiled extension under pi.extensions', async () => {
    const pkg = await readJson('package.json');
    expect(pkg.pi?.extensions).toContain('./dist/extension.mjs');
  });

  it('declares the skills projection under pi.skills', async () => {
    const pkg = await readJson('package.json');
    expect(pkg.pi?.skills).toContain('./skills');
  });

  it('ships dist/ and skills/ in the published files', async () => {
    const pkg = await readJson('package.json');
    expect(pkg.files).toContain('dist');
    expect(pkg.files).toContain('skills');
  });

  it('builds the declared extension file via the build script', async () => {
    const pkg = await readJson('package.json');
    expect(pkg.scripts?.build).toBe('vp pack');
  });
});

describe('prime-agent dependency boundary', () => {
  it('has no runtime, dev, or peer dependency on @maestria/pi', async () => {
    const pkg = await readJson('package.json');
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
    const pkg = await readJson('package.json');
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.peerDependencies?.['@earendil-works/pi-coding-agent']).toBeUndefined();
  });

  it('imports no pi package at runtime from src (types are local and erased)', async () => {
    const sources = await readSrcFiles();
    for (const source of sources) {
      expect(source).not.toMatch(/from\s+['"]@earendil-works\/pi-coding-agent['"]/u);
      expect(source).not.toMatch(/from\s+['"]@earendil-works\/pi-(?:ai|agent-core|tui)['"]/u);
    }
  });

  it('imports no internal Prime src/core/* modules (public API only)', async () => {
    const sources = await readSrcFiles();
    for (const source of sources) {
      // Only import specifiers matter; comments legitimately cite the upstream
      // source path for the evidence pin.
      expect(source).not.toMatch(/from\s+['"][^'"]*src\/core\//u);
    }
  });

  it('performs no filesystem writes from src (state rides on host session entries)', async () => {
    const sources = await readSrcFiles();
    for (const source of sources) {
      expect(source).not.toMatch(
        /writeFile|appendFile|mkdir|createWriteStream|openSync|writeSync/u,
      );
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
    const factory = await loadExtensionFactory();
    expect(typeof factory).toBe('function');
  });

  it('registers the mode commands when invoked (built-artifact smoke)', async () => {
    const factory = await loadExtensionFactory();
    const commands: string[] = [];
    const pi: ExtensionAPI = {
      appendEntry: () => {},
      on: () => {},
      registerCommand: (name) => {
        commands.push(name);
      },
      sendUserMessage: () => {},
    };
    await factory(pi);
    expect(commands).toEqual(['fein', 'sonar', 'blitz', 'mode-clear', 'maestria-status']);
  });

  it('exercises command behavior and mode prompt injection (built-artifact smoke)', async () => {
    // The built artifact is the code Prime actually loads; exercise behavior
    // beyond registration against a fake `pi` (no live Prime binary needed).
    const factory = await loadExtensionFactory();
    let beforeAgentStartHandler:
      | Extract<ExtensionEventRegistration, ['before_agent_start', unknown]>[1]
      | undefined;
    const commands: {
      name: string;
      handler: RegisteredCommandOptions['handler'];
    }[] = [];
    const entries: { customType: string; data?: unknown }[] = [];
    const sentMessages: { content: string; options?: { deliverAs?: 'steer' | 'followUp' } }[] = [];
    const pi: ExtensionAPI = {
      appendEntry: (customType, data) => {
        entries.push({ customType, data });
      },
      on: (...[event, handler]: ExtensionEventRegistration) => {
        if (event === 'before_agent_start') {
          beforeAgentStartHandler = handler;
        }
      },
      registerCommand: (name, options) => {
        commands.push({ handler: options.handler, name });
      },
      sendUserMessage: (content, options) => {
        sentMessages.push({ content, options });
      },
    };

    await factory(pi);

    // Command behavior: `/fein <goal>` sets the mode, persists a custom entry,
    // and steers the goal to the agent.
    const fein = commands.find((c) => c.name === 'fein');
    expect(fein).toBeDefined();
    if (fein === undefined) {
      throw new Error('fein command was not registered');
    }
    await fein.handler('implement the pipeline', extensionContext);
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
    if (beforeAgentStartHandler === undefined) {
      throw new Error('before_agent_start handler was not registered');
    }
    const result = await beforeAgentStartHandler(
      { prompt: 'implement the pipeline', systemPrompt: 'BASE', type: 'before_agent_start' },
      extensionContext,
    );
    const systemPrompt = result?.systemPrompt;
    expect(systemPrompt).toBeDefined();
    if (systemPrompt === undefined) {
      throw new Error('before_agent_start did not return a system prompt');
    }
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
  const npmPackFileList = (): string[] => {
    const stdout = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const parsed: unknown = JSON.parse(stdout);
    if (!isUnknownArray(parsed)) {
      throw new TypeError('npm pack --dry-run --json returned an invalid response');
    }
    const [result] = parsed;
    if (!isRecord(result) || result.files === undefined) {
      throw new Error('npm pack --dry-run --json returned no file list');
    }
    const { files } = result;
    if (!isNpmPackFileList(files)) {
      throw new TypeError('npm pack --dry-run --json returned an invalid file list');
    }
    return files.map((file) => file.path);
  };

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
    const skillEntries = await readdir(path.join(PACKAGE_ROOT, 'skills'), {
      withFileTypes: true,
    });
    const skillNames = skillEntries.filter((e) => e.isDirectory()).map((e) => e.name);
    expect(skillNames.length).toBeGreaterThan(0);

    for (const name of skillNames) {
      expect(packFiles, `tarball must include skills/${name}/SKILL.md`).toContain(
        `skills/${name}/SKILL.md`,
      );
    }
  });

  it('excludes source, tests, and dependency trees from the tarball', () => {
    for (const excluded of ['src/', 'tests/', 'node_modules/', 'scripts/']) {
      expect(packFiles.some((f) => f.startsWith(excluded))).toBe(false);
    }
  });
});

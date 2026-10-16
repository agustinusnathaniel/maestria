/* oxlint-disable no-await-in-loop -- Platforms run one at a time so sandboxes never pile up in /tmp. */
// Drives the built maestria CLI against every real host CLI on PATH, each in its own isolated home:
// check, install, status, update, a failing pinned update, configure, uninstall, and a repeat
// uninstall. Mocked `run` unit tests miss these command branches.
import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const outIndex = process.argv.indexOf('--out');
const out = outIndex === -1 ? undefined : process.argv[outIndex + 1];
if (out === undefined || out === '') {
  throw new Error('Usage: maestria-cli-hosts-evidence.ts --out <path>');
}
const repo = path.resolve(import.meta.dirname, '../..');
const cli = path.join(repo, 'apps/maestria-cli/dist/index.js');

interface Platform {
  /** Host CLI names detection accepts. */
  binaries: string[];
  configure?: 'auth-error' | 'ok';
  id: string;
  pinless?: boolean;
}
interface Result {
  code: number | null;
  json: unknown;
  output: string;
}
const platforms: Platform[] = [
  { binaries: ['opencode'], configure: 'ok', id: 'opencode' },
  { binaries: ['pi'], configure: 'ok', id: 'pi' },
  { binaries: ['omp'], id: 'omp' },
  { binaries: ['kimi'], id: 'kimi-code' },
  { binaries: ['hermes'], id: 'hermes', pinless: true },
  { binaries: ['cursor-agent', 'agent'], configure: 'auth-error', id: 'cursor' },
  { binaries: ['claude'], id: 'claude-code', pinless: true },
  { binaries: ['codex'], configure: 'ok', id: 'codex', pinless: true },
];
// PATH `node` may be a version-manager shim that downloads a runtime into an isolated home, and
// vite-plus shims for host CLIs need VP_HOME to find their global packages.
const pathValue = [path.dirname(process.execPath), process.env.PATH].join(path.delimiter);
const sandboxEnv = (root: string): Record<string, string> => ({
  HOME: path.join(root, 'home'),
  OPENCODE_DISABLE_AUTOUPDATE: 'true',
  PATH: pathValue,
  ...(process.env.VP_HOME === undefined ? {} : { VP_HOME: process.env.VP_HOME }),
  XDG_CACHE_HOME: path.join(root, 'cache'),
  XDG_CONFIG_HOME: path.join(root, 'config'),
  XDG_DATA_HOME: path.join(root, 'data'),
  XDG_STATE_HOME: path.join(root, 'state'),
});
const checks: { detail: unknown; name: string; pass: boolean; platform: string }[] = [];
const steps: {
  command: string;
  exitCode: number | null;
  platform: string;
  stderr: string;
  stdout: string;
}[] = [];
const skipped: { platform: string; reason: string }[] = [];
const statusIds = new Set<string>();

const onPath = (binary: string): boolean =>
  pathValue.split(path.delimiter).some((dir) => {
    try {
      accessSync(path.join(dir, binary), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value } : {};
const list = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);
// `update` and `uninstall` print one result per platform.
const firstResult = (result: Result): Record<string, unknown> => record(list(result.json)[0]);
const reportsInstalled = (result: Result, installed: boolean): boolean =>
  record(result.json).pluginInstalled === installed;

const notInstalled = (result: Result): boolean =>
  result.code === 1 && reportsInstalled(result, false);

interface Check {
  args: string[];
  name: string;
  pass: (result: Result) => boolean;
}
const statusCheck = (id: string): Check => ({
  args: ['status', '--json'],
  name: 'status stdout is JSON and lists the install',
  pass: (result) => {
    const entries = list(record(result.json).platforms).map(record);
    for (const entry of entries) {
      statusIds.add(String(entry.id));
    }
    return (
      result.code === 0 && entries.some((entry) => entry.id === id && entry.installed === true)
    );
  },
});
const configureChecks = (platform: Platform): Check[] => {
  const args = ['configure', platform.id, '--set', 'builder=', '--global', '--json'];
  if (platform.configure === 'ok') {
    return [
      {
        args,
        name: 'configure clears the builder model',
        pass: (result) => result.code === 0 && record(record(result.json).models).builder === '',
      },
    ];
  }
  if (platform.configure === 'auth-error') {
    return [
      {
        args,
        name: 'configure fails with an auth error',
        pass: (result) =>
          result.code === 1 &&
          !result.output.includes('Canceled') &&
          /auth|log ?in/iu.test(result.output),
      },
    ];
  }
  return [];
};
const commandChecks = (platform: Platform): Check[] => {
  const { id } = platform;
  return [
    { args: ['check', id, '--json'], name: 'check before install', pass: notInstalled },
    { args: ['install', id, '--quiet'], name: 'install', pass: (result) => result.code === 0 },
    {
      args: ['check', id, '--json'],
      name: 'check after install',
      pass: (result) => result.code === 0 && reportsInstalled(result, true),
    },
    statusCheck(id),
    {
      args: ['update', id, '--json'],
      name: 'update is already up to date',
      pass: (result) =>
        result.code === 0 &&
        firstResult(result).ok === true &&
        firstResult(result).message === 'Already up to date',
    },
    {
      args: ['update', id, '--version', '0.0.1-nonexistent', '--json'],
      name: 'update to a missing version fails cleanly',
      pass: (result) =>
        result.code === 1 &&
        firstResult(result).ok === false &&
        (platform.pinless !== true ||
          String(firstResult(result).message).startsWith('Version pinning is not supported')),
    },
    ...configureChecks(platform),
    {
      args: ['uninstall', id, '--json'],
      name: 'uninstall',
      pass: (result) =>
        result.code === 0 &&
        firstResult(result).ok === true &&
        String(firstResult(result).message).startsWith('Uninstalled'),
    },
    { args: ['check', id, '--json'], name: 'check after uninstall', pass: notInstalled },
    {
      args: ['uninstall', id, '--json'],
      name: 'repeat uninstall',
      pass: (result) =>
        result.code === 0 &&
        firstResult(result).ok === true &&
        /^(?:Not installed|Uninstalled)/u.test(String(firstResult(result).message)),
    },
  ];
};

const sweep = async (platform: Platform): Promise<void> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `maestria-cli-${platform.id}-`));
  const env = sandboxEnv(root);
  await fs.mkdir(env.HOME, { recursive: true });
  // Non-zero exits are kept as results: several checks expect `maestria` to exit 1.
  // JSON is parsed from stdout alone, so spinner frames or stray logs there fail the check.
  const exec = (command: string, args: string[]): Result => {
    const result = spawnSync(command, args, {
      cwd: env.HOME,
      encoding: 'utf-8',
      env,
      timeout: 240_000,
    });
    if (result.error !== undefined) {
      throw result.error;
    }
    steps.push({
      command: [command, ...args].join(' '),
      exitCode: result.status,
      platform: platform.id,
      stderr: result.stderr,
      stdout: result.stdout,
    });
    return {
      code: result.status,
      json: parseJson(result.stdout),
      output: `${result.stdout}${result.stderr}`,
    };
  };
  try {
    if (platform.id === 'opencode') {
      // A private service port keeps the probe off any OpenCode service the developer is running.
      exec('opencode', ['service', 'set', 'port', String(20_000 + (process.pid % 20_000))]);
    }
    for (const { args, name, pass } of commandChecks(platform)) {
      const result = exec(process.execPath, [cli, ...args]);
      checks.push({
        detail: { exitCode: result.code, result: result.json ?? result.output },
        name,
        pass: pass(result),
        platform: platform.id,
      });
    }
  } catch (error) {
    checks.push({
      detail: String(error),
      name: 'sweep completes',
      pass: false,
      platform: platform.id,
    });
  } finally {
    if (platform.id === 'opencode') {
      exec('opencode', ['service', 'stop']);
    }
    // /tmp may be RAM-backed; host installs and npm caches add up across platforms.
    await fs.rm(root, { force: true, recursive: true });
  }
};

for (const platform of platforms) {
  if (platform.binaries.some(onPath)) {
    await sweep(platform);
  } else {
    skipped.push({
      platform: platform.id,
      reason: `${platform.binaries.join(' or ')} not on PATH`,
    });
  }
}
if (statusIds.size > 0) {
  const expected = platforms.map((platform) => platform.id).toSorted();
  const actual = [...statusIds].toSorted();
  checks.push({
    detail: { actual, expected },
    name: 'sweep covers every platform status reports',
    pass: JSON.stringify(actual) === JSON.stringify(expected),
    platform: 'all',
  });
}
await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
await fs.writeFile(out, JSON.stringify({ checks, skipped, steps }, null, 2));
for (const item of checks.filter((entry) => !entry.pass)) {
  console.log(`FAIL ${item.platform}: ${item.name}`);
}
const passed = checks.filter((item) => item.pass).length;
console.log(`${passed}/${checks.length} checks passed, ${skipped.length} skipped: ${out}`);
process.exitCode = passed === checks.length ? 0 : 1;

// Drives the built maestria CLI against a real OpenCode V2 CLI in an isolated home: install moves a
// V1 `plugin` entry to `plugins`, a pinned update keeps plugin options, and uninstall removes it.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'jsonc-parser';

const outIndex = process.argv.indexOf('--out');
const out = outIndex === -1 ? undefined : process.argv[outIndex + 1];
if (out === undefined || out === '') {
  throw new Error('Usage: maestria-cli-opencode-evidence.ts --out <path>');
}
const repo = path.resolve(import.meta.dirname, '../..');
const cli = path.join(repo, 'apps/maestria-cli/dist/index.js');
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maestria-cli-opencode-'));
const env = {
  HOME: path.join(root, 'home'),
  OPENCODE_DISABLE_AUTOUPDATE: 'true',
  PATH: process.env.PATH,
  XDG_CACHE_HOME: path.join(root, 'cache'),
  XDG_CONFIG_HOME: path.join(root, 'config'),
  XDG_DATA_HOME: path.join(root, 'data'),
  XDG_STATE_HOME: path.join(root, 'state'),
};
const configFile = path.join(root, 'config/opencode/opencode.jsonc');
const options = { modes: { disabledKeywords: ['blitz'] } };
const checks: { name: string; pass: boolean; detail: unknown }[] = [];
const steps: { command: string; output: string }[] = [];

// Non-zero exits are kept as output: `maestria check` exits non-zero for an outdated install.
const exec = (command: string, args: string[]): string => {
  const result = spawnSync(command, args, {
    cwd: env.HOME,
    encoding: 'utf-8',
    env,
    timeout: 240_000,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout}${result.stderr}`;
  steps.push({ command: [command, ...args].join(' '), output });
  return output;
};
const maestria = (...args: string[]): string => exec('node', [cli, ...args]);
const config = async (): Promise<Record<string, unknown>> => {
  const value: unknown = parse(await fs.readFile(configFile, 'utf-8'));
  return typeof value === 'object' && value !== null ? { ...value } : {};
};
const check = (name: string, pass: boolean, detail: unknown): void => {
  checks.push({ detail, name, pass });
};

await fs.mkdir(path.dirname(configFile), { recursive: true });
await fs.mkdir(env.HOME, { recursive: true });
await fs.writeFile(
  configFile,
  '{\n  // user comment\n  "plugin": ["@maestria/opencode@latest"],\n  "plugins": ["opencode-wakatime"]\n}\n',
);
try {
  // A private service port keeps the probe off any OpenCode service the developer is running.
  exec('opencode', ['service', 'set', 'port', String(40_000 + (process.pid % 20_000))]);

  maestria('install', 'opencode', '--quiet');
  let current = await config();
  check(
    'install moves the V1 entry to plugins',
    JSON.stringify(current.plugin) === '[]' &&
      JSON.stringify(current.plugins) === '["opencode-wakatime","@maestria/opencode"]',
    current,
  );
  const installedText = await fs.readFile(configFile, 'utf-8');
  check(
    'install keeps unrelated config and comments',
    installedText.includes('// user comment'),
    null,
  );

  await fs.writeFile(
    configFile,
    JSON.stringify({ plugins: [{ options, package: '@maestria/opencode' }, 'opencode-wakatime'] }),
  );
  maestria('update', 'opencode', '--version', '0.7.16', '--quiet');
  current = await config();
  check(
    'pinned update keeps plugin options',
    JSON.stringify(current.plugins) ===
      JSON.stringify(['opencode-wakatime', { options, package: '@maestria/opencode@0.7.16' }]),
    current.plugins,
  );
  const status = maestria('check', 'opencode', '--json');
  check('check reports the pinned version', status.includes('"installedVersion":"0.7.16"'), status);

  maestria('uninstall', 'opencode', '--quiet');
  current = await config();
  check(
    'uninstall removes only maestria',
    JSON.stringify(current.plugins) === '["opencode-wakatime"]',
    current.plugins,
  );
} finally {
  exec('opencode', ['service', 'stop']);
  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  await fs.writeFile(out, JSON.stringify({ checks, sandbox: root, steps }, null, 2));
}
const passed = checks.filter((item) => item.pass).length;
console.log(`${passed}/${checks.length} checks passed: ${out}`);
process.exitCode = passed === checks.length ? 0 : 1;

#!/usr/bin/env node
// Offline Claude Code E2E for native subagent skill preloads.
// Usage: node --experimental-strip-types scripts/e2e/claude-skill-preload.ts
//   --out artifacts/claude-skill-preload-evidence.json

import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import {
  createPreloadFixture,
  createPreloadState,
  setFailure,
} from './claude-skill-preload-fixture.ts';
import type { Evidence, RuntimeState } from './claude-skill-preload-fixture.ts';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const packageRoot = path.join(repoRoot, 'packages/agent-plugins');
const timeoutMs = 20_000;

const restrictedEnv = (configDir: string): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {};
  for (const name of [
    'PATH',
    'HOME',
    'USER',
    'TMPDIR',
    'TMP',
    'TEMP',
    'LANG',
    'LC_ALL',
    'TERM',
    'SystemRoot',
    'ComSpec',
    'PATHEXT',
  ]) {
    const value = process.env[name];
    if (value !== undefined) {
      env[name] = value;
    }
  }
  env.CLAUDE_CONFIG_DIR = configDir;
  env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
  return env;
};

const readCliVersion = (env: NodeJS.ProcessEnv): string => {
  const result = spawnSync('claude', ['--version'], { encoding: 'utf-8', env, timeout: 5000 });
  return result.status === 0 ? (result.stdout.trim().split(/\s+/u)[0] ?? 'unknown') : 'unavailable';
};

const runCli = async (
  env: NodeJS.ProcessEnv,
  cwd: string,
  state: RuntimeState,
): Promise<number> => {
  const cli = spawn(
    'claude',
    [
      '--plugin-dir',
      packageRoot,
      '--no-session-persistence',
      '--permission-mode',
      'acceptEdits',
      '--allowedTools',
      'Agent,Task',
      '--print',
      '--output-format',
      'json',
      'Call the Maestria reviewer subagent for a one-line preload probe.',
    ],
    { cwd, env, stdio: 'ignore' },
  );
  const closed = once(cli, 'close');
  const timer = setTimeout(() => {
    setFailure(state, 'cli-timeout');
    cli.kill('SIGTERM');
    setTimeout(() => {
      cli.kill('SIGKILL');
    }, 1000).unref();
  }, timeoutMs);
  try {
    const closeArgs: unknown[] = await closed;
    const [code] = closeArgs;
    return typeof code === 'number' ? code : 1;
  } catch {
    setFailure(state, 'cli-spawn-failed');
    return 1;
  } finally {
    clearTimeout(timer);
  }
};

const writeEvidence = (outPath: string, evidence: Evidence): void => {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf-8');
};

const runE2e = async (outPath: string): Promise<Evidence> => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maestria-claude-preload-'));
  const configDir = path.join(temporaryRoot, 'config');
  const cwd = path.join(temporaryRoot, 'workspace');
  fs.mkdirSync(configDir);
  fs.mkdirSync(cwd);
  const state = createPreloadState();
  const env = restrictedEnv(configDir);
  const version = readCliVersion(env);
  let fixture: Awaited<ReturnType<typeof createPreloadFixture>> | undefined;
  let exitCode = 1;

  try {
    if (version === 'unavailable') {
      setFailure(state, 'cli-unavailable');
    } else {
      fixture = await createPreloadFixture(temporaryRoot, state);
      env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${fixture.port}`;
      env.ANTHROPIC_API_KEY = 'local-fixture-only';
      exitCode = await runCli(env, cwd, state);
    }
  } catch {
    setFailure(state, 'fixture-run-failed');
  } finally {
    await fixture?.stop();
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }

  if (exitCode !== 0 && state.failureCode === null) {
    setFailure(state, 'cli-exited-with-error');
  }
  if (state.phase !== 'finished' && state.failureCode === null) {
    setFailure(state, 'expected-child-request-not-observed');
  }
  const passed =
    state.failureCode === null &&
    state.phase === 'finished' &&
    Object.values(state.checks).every(Boolean);
  const evidence: Evidence = {
    checks: state.checks,
    cliVersion: version,
    contextDigests: state.contextDigests,
    diagnostics: state.diagnostics,
    failureCode: passed ? null : (state.failureCode ?? 'e2e-check-failed'),
    status: passed ? 'passed' : 'failed',
  };
  writeEvidence(outPath, evidence);
  return evidence;
};

const outIndex = process.argv.indexOf('--out');
if (outIndex === -1 || process.argv[outIndex + 1] === undefined) {
  process.stderr.write('usage: claude-skill-preload.ts --out <path>\n');
  process.exit(2);
}
const outPath = path.resolve(repoRoot, process.argv[outIndex + 1] ?? '');
const evidence = await runE2e(outPath);
process.stdout.write(`Claude skill preload E2E ${evidence.status}: ${outPath}\n`);
if (evidence.status !== 'passed') {
  process.exitCode = 1;
}

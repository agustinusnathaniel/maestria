import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface Stage {
  name: string;
  command: string[];
  cwd: string;
  needs: string[];
}
export interface StageResult extends Stage {
  state: 'passed' | 'failed' | 'blocked';
  started?: number;
  ended: number;
  exitCode?: number | null;
  signal?: string | null;
  error?: string;
}

const runChild = async (stage: Stage, out: string): Promise<StageResult> =>
  // oxlint-disable-next-line promise/avoid-new -- Node child process completion uses events.
  await new Promise((resolve) => {
    const started = Date.now();
    const fd = openSync(path.join(out, `${stage.name}.log`), 'w');
    const [command, ...args] = stage.command;
    if (!command) {
      throw new Error(`Missing command: ${stage.name}`);
    }
    const child = spawn(command, args, { cwd: stage.cwd, stdio: ['ignore', fd, fd] });
    closeSync(fd);
    child.on('error', (error) => {
      resolve({ ...stage, ended: Date.now(), error: error.message, started, state: 'failed' });
    });
    child.on('close', (exitCode, signal) => {
      resolve({
        ...stage,
        ended: Date.now(),
        exitCode,
        signal,
        started,
        state: exitCode === 0 && signal === null ? 'passed' : 'failed',
      });
    });
  });

export const executeGraph = async (stages: Stage[], out: string): Promise<StageResult[]> => {
  mkdirSync(out, { recursive: true });
  const names = new Set(stages.map((stage) => stage.name));
  if (
    names.size !== stages.length ||
    stages.some((stage) => stage.needs.some((name) => !names.has(name)))
  ) {
    throw new Error('Duplicate stage or unknown prerequisite');
  }
  const pending = new Map(stages.map((stage) => [stage.name, stage]));
  const running = new Map<string, Promise<StageResult>>();
  const results = new Map<string, StageResult>();
  while (pending.size > 0 || running.size > 0) {
    for (const [name, stage] of pending) {
      if (
        stage.needs.some((dependency) =>
          ['failed', 'blocked'].includes(results.get(dependency)?.state ?? ''),
        )
      ) {
        results.set(name, { ...stage, ended: Date.now(), state: 'blocked' });
        pending.delete(name);
      } else if (
        running.size < 4 &&
        stage.needs.every((dependency) => results.get(dependency)?.state === 'passed')
      ) {
        pending.delete(name);
        running.set(name, runChild(stage, out));
      }
    }
    writeFileSync(path.join(out, 'events.json'), JSON.stringify([...results.values()], null, 2));
    if (running.size === 0) {
      if (pending.size > 0) {
        throw new Error('Cyclic prerequisites');
      }
      break;
    }
    // oxlint-disable-next-line no-await-in-loop -- Admit dependents only after a prerequisite finishes.
    const result = await Promise.race(running.values());
    running.delete(result.name);
    results.set(result.name, result);
    console.log(
      `${result.name}: ${result.state} (${result.exitCode ?? result.error ?? 'blocked'})`,
    );
  }
  return [...results.values()];
};

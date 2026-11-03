import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  classifyEmailScan,
  classifyGeneratedEdit,
  classifyGitSafety,
  editTargets,
  strictest,
} from '@maestria/shared-hook-policy';
import type { Decision, ShellContext } from '@maestria/shared-hook-policy';

/** The `tools/pre-execute` decisions this guard returns, from `@deepseek-ai/dsh-tools`. */
export type GuardDecision =
  | { readonly kind: 'deny'; readonly reason: string }
  | {
      readonly kind: 'ask';
      readonly reason: string;
      readonly displayReason: { readonly en: string };
    };

const branchIn =
  (cwd: string) =>
  (directory?: string): string | undefined => {
    let branch: string | undefined;
    try {
      branch = execFileSync(
        'git',
        ['-C', path.resolve(cwd, directory ?? '.'), 'branch', '--show-current'],
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 },
      ).trim();
    } catch {
      // Not a repository, or git is missing: the branch is unknown.
    }
    return branch === '' ? undefined : branch;
  };

const readIn =
  (cwd: string) =>
  (file: string): string | undefined => {
    try {
      return readFileSync(path.resolve(cwd, file), 'utf-8');
    } catch {
      return undefined;
    }
  };

const stringField = (input: unknown, key: string): string | undefined => {
  const value: unknown =
    typeof input === 'object' && input !== null ? Reflect.get(input, key) : undefined;
  return typeof value === 'string' ? value : undefined;
};

/** The shared hook policy's verdict for one tool call; `allow` for tools it does not cover. */
export const classifyCall = (name: string, args: unknown, cwd: string): Decision => {
  if (name === 'bash') {
    const command = stringField(args, 'command');
    if (command === undefined) {
      return { reason: '', verdict: 'allow' };
    }
    const context: ShellContext = { currentBranch: branchIn(cwd), readFile: readIn(cwd) };
    return strictest([classifyGitSafety(command, context), classifyEmailScan(command, context)]);
  }
  if (name === 'edit' || name === 'write') {
    return classifyGeneratedEdit(editTargets(args), readIn(cwd));
  }
  return { reason: '', verdict: 'allow' };
};

/** A deny or ask the host can apply, or undefined to let the call through. */
export const toPreToolDecision = (decision: Decision): GuardDecision | undefined => {
  const reason = `maestria: ${decision.reason}.`;
  if (decision.verdict === 'block') {
    return { kind: 'deny', reason };
  }
  if (decision.verdict === 'ask') {
    return { displayReason: { en: reason }, kind: 'ask', reason };
  }
  return undefined;
};

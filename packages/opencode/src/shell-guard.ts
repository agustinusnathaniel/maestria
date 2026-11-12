import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { Plugin } from '@opencode/plugin/effect';
import { Error as ToolError } from '@opencode/plugin/promise/tool';
import { classifyEnvDump, classifyGitSafety, strictest } from '@maestria/shared-hook-policy';
import type { Decision } from '@maestria/shared-hook-policy';

/** Current branch of the repository at `directory`, or undefined outside a repository. */
const branchIn =
  (root: string) =>
  (directory?: string): string | undefined => {
    let branch: string | undefined;
    try {
      branch = execFileSync(
        'git',
        ['-C', path.resolve(root, directory ?? '.'), 'branch', '--show-current'],
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 },
      ).trim();
    } catch {
      // Not a repository, or git is missing: the branch is unknown.
    }
    return branch === '' ? undefined : branch;
  };

const shellCommand = (input: unknown): string | undefined => {
  const command: unknown =
    typeof input === 'object' && input !== null ? Reflect.get(input, 'command') : undefined;
  return typeof command === 'string' ? command : undefined;
};

const reason = (decision: Decision): string => `maestria: ${decision.reason}.`;

/**
 * Shell safety on OpenCode's shell tool: `tool.execute.before` blocks hook bypasses before the
 * command runs, and `permission.evaluate` turns risky history edits and whole-environment dumps
 * into a native approval prompt. An explicit config deny is final and never reaches the evaluate
 * hook.
 */
export const registerShellGuard = (
  ctx: Pick<Plugin.Context, 'permission' | 'tool'>,
  projectRoot: string,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerShellGuardEffect() {
    const context = { currentBranch: branchIn(projectRoot) };
    const classify = (command: string): Decision =>
      strictest([classifyGitSafety(command, context), classifyEnvDump(command)]);

    yield* ctx.tool.hook('execute.before', (event) => {
      const command = shellCommand(event.input);
      if (event.tool !== 'shell' || command === undefined) {
        return Effect.void;
      }
      const decision = classify(command);
      return decision.verdict === 'block'
        ? Effect.fail(new ToolError({ message: reason(decision) }))
        : Effect.void;
    });

    yield* ctx.permission.hook('evaluate', (event) =>
      Effect.sync(() => {
        if (event.action !== 'shell' || event.effect === 'deny') {
          return;
        }
        const decision = classify(event.resources.join(' '));
        if (decision.verdict === 'allow') {
          return;
        }
        event.effect = decision.verdict === 'block' ? 'deny' : 'ask';
        event.message = reason(decision);
      }),
    );
  });

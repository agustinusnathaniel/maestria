/**
 * Shared tool interceptor utilities for Maestria platform packages.
 *
 * Pure TypeScript — no platform-specific dependencies.
 * Imported by both @maestria/omp and @maestria/pi to eliminate duplication.
 *
 * @module
 */

import type { LandingReviewPhase, MaestriaState } from './state-core.js';

/**
 * Dangerous bash command patterns that should always be blocked,
 * regardless of mode or specialist role.
 */
export const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /dd\s+if=/,
  />\s*\/dev\/sd/,
  /chmod\s+-R\s+777\s+\//,
  /mkfs\.\w+/,
  /:(){ :\|:& };:/,
  />\s*\/etc\/(passwd|shadow|sudoers)/,
  /\beval\b/,
  /wget\s+-O\s*-\s*\|\s*(bash|sh)/,
  /curl\s+.*\|\s*(bash|sh)/,
  /crontab\s+-r/,
];

/** Tool names that can mutate files or execute commands. */
export const WRITE_TOOL_NAMES = new Set([
  'write',
  'write_file',
  'edit',
  'edit_file',
  'patch',
  'create',
  'delete',
  'delete_file',
  'rename',
  'rename_file',
  'mkdir',
  'make_directory',
  'move',
  'copy',
  'bash',
  'terminal',
  'shell',
  'run',
  'process',
  'command',
]);

export function isWriteToolName(toolName: string): boolean {
  return WRITE_TOOL_NAMES.has(toolName);
}

function splitCommand(command: string): string[] | undefined {
  if (command.includes('\0') || /[\r\n;&|`$<>]/.test(command)) return undefined;
  const trimmed = command.trim();
  return trimmed ? trimmed.split(/\s+/) : undefined;
}

function commandFromInput(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const command = (input as Record<string, unknown>).command;
  return typeof command === 'string' ? command : undefined;
}

const SHIPPING_ATTEMPT_PATTERN =
  /\b(?:git(?:\s+\S+){0,8}\s+(?:add|commit|push|merge|rebase|reset|clean|branch)\b|gh\s+pr\s+(?:create|edit|merge|close|delete)\b|hub\s+pull-request\b|glab\s+mr\s+(?:create|edit|merge|close|delete)\b)/i;

/**
 * Detect a shipping attempt without trying to prove that the shell form is
 * safe. This intentionally errs toward blocking: wrappers, flags, and shell
 * compounds must be denied before an approved command parser gets a chance
 * to accept anything.
 */
export function isLandingReviewShippingAttempt(input: unknown): boolean {
  const command = commandFromInput(input);
  return typeof command === 'string' && SHIPPING_ATTEMPT_PATTERN.test(command);
}

function isPrimaryBranchReference(value: string): boolean {
  return /(?:^|[/=:])(?:main|master|trunk)(?:$|[/~^])/.test(value.toLowerCase());
}

function isHeadReference(value: string): boolean {
  return value.toLowerCase() === 'head' || /(?:^|[/=:])head(?:$|[/~^])/.test(value.toLowerCase());
}

function hasDeniedFlag(words: readonly string[], flags: readonly string[]): boolean {
  return words.some((word) => {
    const lower = word.toLowerCase();
    return flags.some(
      (flag) => lower === flag || (flag.startsWith('--') && lower.startsWith(`${flag}=`)),
    );
  });
}

function isApprovedPullRequest(words: readonly string[]): boolean {
  if (words[0] !== 'gh' || words[1] !== 'pr') return false;
  if (words[2] !== 'create' && words[2] !== 'edit') return false;
  const args = words.slice(3);
  if (args.length === 0) return false;

  let base: string | undefined;
  let head: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const word = args[index];
    if (word === '--repo' || word.startsWith('--repo=')) return false;
    if (word === '--merge' || word === '--close' || word === '--delete') return false;
    if (word === '--base' || word === '--head') {
      const value = args[index + 1];
      if (!value) return false;
      if (word === '--base') base = value;
      else head = value;
      index += 1;
      continue;
    }
    if (word.startsWith('--base=')) {
      base = word.slice(7);
      if (!base) return false;
      continue;
    }
    if (word.startsWith('--head=')) {
      head = word.slice(7);
      if (!head) return false;
    }
  }

  if (words[2] === 'edit') return base === undefined && head === undefined;
  return Boolean(base && head && isPrimaryBranchReference(base) && !isPrimaryBranchReference(head));
}

function isApprovedPush(words: readonly string[]): boolean {
  if (
    hasDeniedFlag(words, ['-f', '--force', '--force-with-lease', '-d', '--delete']) ||
    words.some((word) => word.startsWith('-') && word !== '-u' && word !== '--set-upstream')
  ) {
    return false;
  }

  const args = words.slice(2).filter((word) => !word.startsWith('-'));
  if (args.length !== 2) return false;

  const refspec = args[1];
  const refParts = refspec.split(':');
  if (refParts.length > 2 || refParts.some((ref) => !ref)) return false;
  return refParts.every((ref) => !isHeadReference(ref) && !isPrimaryBranchReference(ref));
}

export function isLandingReviewShippingCommand(input: unknown): boolean {
  const command = commandFromInput(input);
  if (!command) return false;
  const words = splitCommand(command);
  if (!words) return false;

  if (words[0] === 'vp' && (words[1] === 'check' || words[1] === 'test')) return true;
  if (words[0] === 'git' && words[1] === 'add') {
    const args = words.slice(2);
    return (
      args.length > 0 && args.every((word) => word === '-A' || word === '--all' || word === '.')
    );
  }
  if (words[0] === 'git' && (words[1] === 'status' || words[1] === 'diff')) {
    return !words.some((word) => word === '--output' || word.startsWith('--output='));
  }
  if (words[0] === 'git' && words[1] === 'commit') {
    const args = words.slice(2);
    if (args.length < 2 || hasDeniedFlag(args, ['--amend', '--no-verify', '--no-gpg-sign'])) {
      return false;
    }
    let messageArgument = false;
    for (let index = 0; index < args.length; index += 1) {
      const word = args[index];
      if (word === '-m' || word === '--message' || word === '-F' || word === '--file') {
        if (messageArgument || !args[index + 1] || args[index + 1].startsWith('-')) {
          return false;
        }
        messageArgument = true;
        index += 1;
      } else if (word !== '-a' && word !== '--all') {
        return false;
      }
    }
    return messageArgument;
  }
  if (words[0] === 'git' && words[1] === 'push') {
    return isApprovedPush(words);
  }
  if (words[0] === 'gh' && words[1] === 'pr') return isApprovedPullRequest(words);
  return false;
}

export async function isLandingReviewShippingCommandOnNonPrimaryBranch(
  input: unknown,
  readCurrentBranch: () => Promise<unknown>,
): Promise<boolean> {
  if (!isLandingReviewShippingCommand(input)) return false;

  const command = commandFromInput(input);
  const words = command ? splitCommand(command) : undefined;
  if (!words || words[0] !== 'git' || !['commit', 'push'].includes(words[1] ?? '')) return true;

  try {
    const branch = await readCurrentBranch();
    return (
      typeof branch === 'string' &&
      branch.trim().length > 0 &&
      !isHeadReference(branch.trim()) &&
      !isPrimaryBranchReference(branch.trim())
    );
  } catch {
    return false;
  }
}

export function isLandingReviewShippingMutation(input: unknown): boolean {
  const command = commandFromInput(input);
  if (!command) return false;
  const words = splitCommand(command);
  if (!words) return false;
  return (
    (words[0] === 'git' && (words[1] === 'add' || words[1] === 'commit' || words[1] === 'push')) ||
    (words[0] === 'gh' && words[1] === 'pr' && (words[2] === 'create' || words[2] === 'edit'))
  );
}

/**
 * Return whether a dispatch input is the single permitted landing reviewer
 * handoff. Missing or compound dispatch inputs fail closed.
 */
export function isLandingReviewDispatch(
  toolName: string,
  input: unknown,
  dispatchTools: readonly string[],
): boolean {
  if (!dispatchTools.includes(toolName) || !input || typeof input !== 'object') return false;
  const args = input as Record<string, unknown>;
  if (args.tasks !== undefined || typeof args.task !== 'string' || !args.task.trim()) return false;

  return (
    args.agent === 'reviewer' ||
    args.agent_type === 'reviewer' ||
    args.subagent_type === 'reviewer' ||
    args.subagentType === 'reviewer'
  );
}

/**
 * Return a mode-policy block reason, or undefined when the tool is allowed.
 *
 * Root fein/sonar sessions are dispatch-only. Blitz allows direct root tools
 * but blocks every platform dispatch tool so no specialist can be spawned.
 * Sonar's write restriction applies to root and specialist sessions alike.
 */
export function getModeToolBlockReason(
  mode: MaestriaState['mode'],
  toolName: string,
  isRootSession: boolean,
  dispatchTools: readonly string[],
  rootDispatchTools: readonly string[] = dispatchTools,
  landingReview: LandingReviewPhase = 'execution',
  input?: unknown,
): string | undefined {
  const shippingAttempt = isLandingReviewShippingAttempt(input);
  const approvedShippingCommand = shippingAttempt && isLandingReviewShippingCommand(input);
  if (shippingAttempt) {
    if (!isRootSession) {
      return `Tool '${toolName}' is blocked because only the root session may ship an approved artifact.`;
    }
    if (landingReview !== 'approved') {
      return `Tool '${toolName}' is blocked before landing review approval. Commit, push, and PR operations require a trusted reviewer verdict.`;
    }
    if (!approvedShippingCommand) {
      return `Tool '${toolName}' is blocked after landing review approval. Only bounded shipping commands are allowed.`;
    }
  }

  if (isRootSession && landingReview !== 'execution' && !approvedShippingCommand) {
    if (landingReview === 'approved') {
      return `Tool '${toolName}' is blocked after landing review approval. Only bounded shipping commands are allowed.`;
    }
    return `Tool '${toolName}' is blocked while landing review is ${landingReview}. A trusted reviewer verdict is required before shipping.`;
  }

  if (mode === 'sonar' && isWriteToolName(toolName)) {
    return `Tool '${toolName}' is blocked in sonar mode. Research mode is read-only.`;
  }

  if (mode === null && isRootSession && dispatchTools.includes(toolName)) {
    if (
      landingReview === 'execution' &&
      rootDispatchTools.includes(toolName) &&
      isLandingReviewDispatch(toolName, input, dispatchTools)
    ) {
      return undefined;
    }
    return `Tool '${toolName}' is blocked in direct mode. Only the trusted landing reviewer dispatch is permitted.`;
  }

  if (mode === 'blitz' && dispatchTools.includes(toolName)) {
    if (
      isRootSession &&
      landingReview === 'execution' &&
      rootDispatchTools.includes(toolName) &&
      isLandingReviewDispatch(toolName, input, dispatchTools)
    ) {
      return undefined;
    }
    return `Tool '${toolName}' is blocked in blitz mode. Blitz runs directly without specialist dispatch.`;
  }

  if (
    isRootSession &&
    (mode === 'fein' || mode === 'sonar') &&
    !rootDispatchTools.includes(toolName)
  ) {
    return `Tool '${toolName}' is blocked for the orchestrator. Use a dispatch tool for ${mode} mode.`;
  }

  return undefined;
}

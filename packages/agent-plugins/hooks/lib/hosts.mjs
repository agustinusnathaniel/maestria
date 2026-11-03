// Host adapters for maestria's hook jobs: read each host's stdin payload and write its decision
// format. `claude` covers Claude Code and ZCode, which share hooks/hooks.json and its output.
import { execFileSync } from 'node:child_process';
import { closeSync, openSync, readFileSync, readSync } from 'node:fs';
import path from 'node:path';

/** @typedef {Record<string, unknown>} HookInput */
/** @typedef {{ readonly reason: string, readonly verdict: 'allow' | 'ask' | 'block' }} Decision */

export const HOSTS = new Set(['claude', 'codex', 'cursor', 'devin', 'kimi']);

const HEAD_BYTES = 4096;

/**
 * @param {unknown} value - parsed JSON
 * @returns {value is HookInput} whether it is a JSON object
 */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * @param {unknown} value - a payload or environment value
 * @returns {string | undefined} the value when it is a non-empty string
 */
const nonEmpty = (value) => (typeof value === 'string' && value !== '' ? value : undefined);

/** @returns {Promise<HookInput>} the stdin payload, or an empty object when it is not JSON */
export const readInput = async () => {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += String(chunk);
  }
  try {
    /** @type {unknown} */
    const value = JSON.parse(raw);
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
};

/**
 * The project directory of the session that fired the hook.
 * @param {HookInput} input - the hook payload
 * @returns {string} the session's project directory
 */
export const sessionDirectory = (input) => {
  const roots = input.workspace_roots;
  return (
    nonEmpty(input.cwd) ??
    nonEmpty(process.env.CLAUDE_PROJECT_DIR) ??
    nonEmpty(process.env.CURSOR_PROJECT_DIR) ??
    nonEmpty(process.env.DEVIN_PROJECT_DIR) ??
    (Array.isArray(roots) ? nonEmpty(roots[0]) : undefined) ??
    process.cwd()
  );
};

/**
 * @param {HookInput} input - the hook payload
 * @returns {string} the shell command a tool or shell hook is about to run
 */
export const shellCommand = (input) => {
  const toolInput = input.tool_input;
  return (
    nonEmpty(input.command) ?? (isRecord(toolInput) ? nonEmpty(toolInput.command) : undefined) ?? ''
  );
};

/**
 * @param {string} cwd - the session's project directory
 * @returns {{ currentBranch: (directory?: string) => string | undefined, readFile: (file: string) => string | undefined }} lookups for the git policy
 */
export const shellContext = (cwd) => ({
  currentBranch: (directory) => {
    /** @type {string | undefined} */
    let branch;
    try {
      branch = nonEmpty(
        execFileSync(
          'git',
          ['-C', path.resolve(cwd, directory ?? '.'), 'branch', '--show-current'],
          {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 3000,
          },
        ).trim(),
      );
    } catch {
      // Not a repository, or git is missing: the branch is unknown.
    }
    return branch;
  },
  readFile: (file) => {
    /** @type {string | undefined} */
    let text;
    try {
      text = readFileSync(path.resolve(cwd, file), 'utf-8');
    } catch {
      // Unreadable files contribute no text.
    }
    return text;
  },
});

/**
 * The first few kilobytes of a file, or undefined when it does not exist yet.
 * @param {string} cwd - the session's project directory
 * @returns {(file: string) => string | undefined} a reader for a file's head
 */
export const readHeadIn = (cwd) => (file) => {
  /** @type {number | undefined} */
  let descriptor;
  /** @type {string | undefined} */
  let head;
  try {
    descriptor = openSync(path.resolve(cwd, file), 'r');
    const buffer = Buffer.alloc(HEAD_BYTES);
    head = buffer.toString('utf-8', 0, readSync(descriptor, buffer, 0, HEAD_BYTES, 0));
  } catch {
    // A file that does not exist yet has no head.
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
    }
  }
  return head;
};

/** @param {unknown} value - the JSON response for the host */
const print = (value) => {
  process.stdout.write(`${JSON.stringify(value)}\n`);
};

const NEEDS_APPROVAL =
  "It needs the user's explicit approval and this host cannot ask for it: stop, ask the user, and continue only if they approve.";

/**
 * Report a tool decision. Hosts or events without an ask decision turn ask into block with a
 * message that approval is needed; `askable` is false for Cursor's preToolUse, which does not
 * enforce ask.
 * @param {string} host - the host adapter name
 * @param {Decision} decision - the policy decision
 * @param {{ askable?: boolean }} [options] - whether this host and event can ask the user
 */
export const respondToTool = (
  host,
  decision,
  { askable = host === 'claude' || host === 'cursor' } = {},
) => {
  const verdict = decision.verdict === 'ask' && !askable ? 'block' : decision.verdict;
  const reason =
    verdict === decision.verdict
      ? `maestria: ${decision.reason}.`
      : `maestria: ${decision.reason}. ${NEEDS_APPROVAL}`;
  if (host === 'cursor') {
    print(
      verdict === 'allow'
        ? { permission: 'allow' }
        : {
            agent_message: reason,
            permission: verdict === 'ask' ? 'ask' : 'deny',
            user_message: reason,
          },
    );
    return;
  }
  if (verdict === 'allow') {
    return;
  }
  if (host === 'devin') {
    print({ decision: 'block', reason });
    return;
  }
  print({
    hookSpecificOutput: {
      ...(host === 'kimi' ? {} : { hookEventName: 'PreToolUse' }),
      permissionDecision: verdict === 'ask' ? 'ask' : 'deny',
      permissionDecisionReason: reason,
    },
  });
};

/**
 * Add text to the session context at session start; nothing is printed for empty text.
 * @param {string} host - the host adapter name
 * @param {string} text - context to add
 */
export const respondWithContext = (host, text) => {
  if (host === 'cursor') {
    print(text === '' ? {} : { additional_context: text });
  } else if (text !== '') {
    print({ hookSpecificOutput: { additionalContext: text, hookEventName: 'SessionStart' } });
  }
};

/**
 * Run a hook job for the host named in argv. A failing job never blocks the session: hooks
 * reinforce the rules, which still apply when a hook does not run.
 * @param {(host: string, input: HookInput, args: string[]) => void} job - the hook job
 */
export const runJob = async (job) => {
  const [host = '', ...args] = process.argv.slice(2);
  if (!HOSTS.has(host)) {
    process.stderr.write(`maestria hook: unknown host ${host}\n`);
    return;
  }
  try {
    job(host, await readInput(), args);
  } catch (error) {
    process.stderr.write(
      `maestria hook: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    if (host === 'cursor') {
      print({ permission: 'allow' });
    }
  }
};

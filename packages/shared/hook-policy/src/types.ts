// Shared decision types for maestria's hook policy. Imported by every policy
// module and re-exported through the package entry; see ./index.ts.
export type Verdict = 'allow' | 'ask' | 'block';

export interface Decision {
  readonly reason: string;
  readonly verdict: Verdict;
}

export interface ShellContext {
  /** Current branch of the repository at `directory` (the session cwd when undefined). */
  readonly currentBranch: (directory?: string) => string | undefined;
  /** Text of a file named in the command, relative to the session cwd; undefined when unreadable. */
  readonly readFile?: (file: string) => string | undefined;
}

export const ALLOW: Decision = { reason: '', verdict: 'allow' };

const RANK: Record<Verdict, number> = { allow: 0, ask: 1, block: 2 };

/** The strictest decision wins; the first reason at that level is kept. */
export const strictest = (decisions: readonly Decision[]): Decision => {
  let worst = ALLOW;
  for (const decision of decisions) {
    if (RANK[decision.verdict] > RANK[worst.verdict]) {
      worst = decision;
    }
  }
  return worst;
};

export const ask = (reason: string): Decision => ({ reason, verdict: 'ask' });
export const block = (reason: string): Decision => ({ reason, verdict: 'block' });

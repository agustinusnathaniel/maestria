import { describe, it, expect } from 'vite-plus/test';
import {
  getModeToolBlockReason,
  isLandingReviewShippingAttempt,
  isLandingReviewShippingCommand,
  isLandingReviewShippingCommandOnNonPrimaryBranch,
} from '../src/tools-core.js';

describe('getModeToolBlockReason', () => {
  const piDispatchTools = ['maestria_subagent', 'subagent'];

  it('allows direct root tools in blitz but blocks dispatch tools', () => {
    expect(getModeToolBlockReason('blitz', 'edit', true, piDispatchTools)).toBeUndefined();
    expect(getModeToolBlockReason('blitz', 'maestria_subagent', true, piDispatchTools)).toContain(
      'blocked in blitz mode',
    );
  });

  it('allows only the trusted reviewer dispatch in direct root execution', () => {
    expect(
      getModeToolBlockReason(
        null,
        'maestria_subagent',
        true,
        ['maestria_subagent', 'subagent'],
        ['maestria_subagent'],
        'execution',
        { agent: 'reviewer', task: 'inspect the landing diff' },
      ),
    ).toBeUndefined();
    expect(
      getModeToolBlockReason(
        null,
        'subagent',
        true,
        ['maestria_subagent', 'subagent'],
        ['maestria_subagent'],
        'execution',
        { agent: 'reviewer', task: 'inspect the landing diff' },
      ),
    ).toContain('direct mode');
    expect(
      getModeToolBlockReason(
        null,
        'bash',
        true,
        ['maestria_subagent', 'subagent'],
        ['maestria_subagent'],
        'execution',
        { command: 'git commit -m ship' },
      ),
    ).toContain('before landing review approval');
  });

  it('allows exactly one root reviewer handoff from blitz', () => {
    expect(
      getModeToolBlockReason(
        'blitz',
        'maestria_subagent',
        true,
        piDispatchTools,
        ['maestria_subagent'],
        'execution',
        { agent: 'reviewer', task: 'inspect the landing diff' },
      ),
    ).toBeUndefined();
    expect(
      getModeToolBlockReason(
        'blitz',
        'maestria_subagent',
        true,
        piDispatchTools,
        ['maestria_subagent'],
        'execution',
        { agent: 'builder', task: 'change the implementation' },
      ),
    ).toContain('blocked in blitz mode');
    expect(
      getModeToolBlockReason(
        'blitz',
        'subagent',
        true,
        piDispatchTools,
        ['maestria_subagent'],
        'reviewing',
        { agent: 'reviewer', task: 'review again' },
      ),
    ).toContain('trusted reviewer verdict');
    expect(
      getModeToolBlockReason(
        'blitz',
        'maestria_subagent',
        false,
        piDispatchTools,
        ['maestria_subagent'],
        'execution',
        { agent: 'reviewer', task: 'inspect' },
      ),
    ).toContain('blocked in blitz mode');
  });

  it('blocks landing shipping until a trusted verdict is approved', () => {
    expect(
      getModeToolBlockReason(
        'blitz',
        'bash',
        true,
        piDispatchTools,
        ['maestria_subagent'],
        'reviewing',
        { command: 'git push origin HEAD' },
      ),
    ).toContain('before landing review approval');
    expect(
      getModeToolBlockReason(
        'blitz',
        'bash',
        true,
        piDispatchTools,
        ['maestria_subagent'],
        'reviewing',
        { command: 'gh pr create --fill' },
      ),
    ).toContain('before landing review approval');
    expect(
      getModeToolBlockReason(
        'blitz',
        'bash',
        true,
        piDispatchTools,
        ['maestria_subagent'],
        'reviewing',
        { command: 'gh pr edit 42 --title ship' },
      ),
    ).toContain('before landing review approval');
    expect(
      getModeToolBlockReason(
        'blitz',
        'bash',
        true,
        piDispatchTools,
        ['maestria_subagent'],
        'reviewing',
        { command: 'npm test' },
      ),
    ).toContain('trusted reviewer verdict');
    expect(
      getModeToolBlockReason(
        'blitz',
        'bash',
        false,
        piDispatchTools,
        ['maestria_subagent'],
        'reviewing',
        {
          command: 'command git -C repo commit --no-verify -m ship && git push --force origin main',
        },
      ),
    ).toContain('root session');
    expect(
      getModeToolBlockReason(
        'blitz',
        'edit',
        true,
        piDispatchTools,
        ['maestria_subagent'],
        'reviewing',
      ),
    ).toContain('trusted reviewer verdict');
    expect(
      getModeToolBlockReason(
        'blitz',
        'bash',
        true,
        piDispatchTools,
        ['maestria_subagent'],
        'reviewing',
        { command: 'git push && rm -rf /' },
      ),
    ).toContain('trusted reviewer verdict');
  });

  it('allows only bounded shipping commands after approval', () => {
    const args = [
      'blitz',
      'bash',
      true,
      piDispatchTools,
      ['maestria_subagent'],
      'approved',
    ] as const;
    expect(getModeToolBlockReason(...args, { command: 'git commit -m ship' })).toBeUndefined();
    expect(getModeToolBlockReason(...args, { command: 'git push origin feature' })).toBeUndefined();
    expect(
      getModeToolBlockReason(...args, {
        command: 'gh pr create --base main --head feature',
      }),
    ).toBeUndefined();
    expect(getModeToolBlockReason(...args, { command: 'git push --force origin HEAD' })).toContain(
      'bounded shipping',
    );
    expect(getModeToolBlockReason(...args, { command: 'git push origin main' })).toContain(
      'bounded shipping',
    );
    expect(
      getModeToolBlockReason(...args, { command: 'git push origin HEAD && npm test' }),
    ).toContain('bounded shipping');
    expect(getModeToolBlockReason(...args, { command: 'npm test' })).toContain('bounded shipping');
    expect(getModeToolBlockReason(...args, undefined)).toContain('bounded shipping');
  });

  it('keeps landing review enforcement isolated from child sessions', () => {
    expect(
      getModeToolBlockReason(
        'blitz',
        'edit',
        false,
        piDispatchTools,
        ['maestria_subagent'],
        'reviewing',
      ),
    ).toBeUndefined();
    expect(
      getModeToolBlockReason(
        'blitz',
        'bash',
        false,
        piDispatchTools,
        ['maestria_subagent'],
        'reviewing',
        { command: 'npm test' },
      ),
    ).toBeUndefined();
    expect(
      getModeToolBlockReason(
        'blitz',
        'bash',
        false,
        piDispatchTools,
        ['maestria_subagent'],
        'reviewing',
        { command: 'git push origin feature' },
      ),
    ).toContain('root session');
  });

  it('separates broad shipping-attempt detection from approved validation', () => {
    expect(
      isLandingReviewShippingAttempt({ command: 'env GIT_TRACE=1 git -C repo commit -m x' }),
    ).toBe(true);
    expect(
      isLandingReviewShippingAttempt({ command: 'gh pr create --base main --head feature' }),
    ).toBe(true);
    expect(isLandingReviewShippingAttempt({ command: 'git status --short' })).toBe(false);
    expect(
      isLandingReviewShippingCommand({ command: 'gh pr create --base main --head feature' }),
    ).toBe(true);
    expect(
      isLandingReviewShippingCommand({ command: 'gh pr create --base feature --head main' }),
    ).toBe(false);
  });

  it('requires explicit primary base and non-primary head refs for PR creation', () => {
    const allowed = { command: 'gh pr create --base main --head feature/review' };
    expect(isLandingReviewShippingCommand(allowed)).toBe(true);
    expect(isLandingReviewShippingCommand({ command: 'gh pr create --fill' })).toBe(false);
    expect(isLandingReviewShippingCommand({ command: 'gh pr create --base main' })).toBe(false);
    expect(isLandingReviewShippingCommand({ command: 'gh pr create --head feature/review' })).toBe(
      false,
    );
    expect(
      isLandingReviewShippingCommand({
        command: 'gh pr create --base feature --head feature/review',
      }),
    ).toBe(false);
    expect(isLandingReviewShippingCommand({ command: 'gh pr edit 12 --base main' })).toBe(false);
    expect(isLandingReviewShippingCommand({ command: 'gh pr edit 12 --title ship' })).toBe(true);
  });

  it('requires explicit non-primary push refs and a verified non-primary commit branch', async () => {
    for (const command of [
      'git push origin',
      'git push origin HEAD',
      'git push origin main',
      'git push origin master',
      'git push origin feature:main',
    ]) {
      expect(isLandingReviewShippingCommand({ command })).toBe(false);
    }

    for (const branch of ['main', 'master']) {
      await expect(
        isLandingReviewShippingCommandOnNonPrimaryBranch(
          { command: 'git commit -m ship' },
          async () => branch,
        ),
      ).resolves.toBe(false);
    }
    await expect(
      isLandingReviewShippingCommandOnNonPrimaryBranch(
        { command: 'git commit -m ship' },
        async () => undefined,
      ),
    ).resolves.toBe(false);
    await expect(
      isLandingReviewShippingCommandOnNonPrimaryBranch(
        { command: 'git push origin feature' },
        async () => 'feature/review',
      ),
    ).resolves.toBe(true);
  });

  it('denies shipping from a non-root reviewer even after approval', () => {
    expect(
      getModeToolBlockReason(
        'blitz',
        'terminal',
        false,
        piDispatchTools,
        ['maestria_subagent'],
        'approved',
        { command: 'git commit -m ship' },
      ),
    ).toContain('root session');
  });

  it('keeps fein and sonar root sessions dispatcher-only', () => {
    expect(
      getModeToolBlockReason('fein', 'read', true, piDispatchTools, ['maestria_subagent']),
    ).toContain('blocked for the orchestrator');
    expect(
      getModeToolBlockReason('sonar', 'maestria_subagent', true, piDispatchTools),
    ).toBeUndefined();
  });

  it('blocks writes in sonar for specialist sessions too', () => {
    expect(getModeToolBlockReason('sonar', 'write', false, piDispatchTools)).toContain(
      'Research mode is read-only',
    );
    expect(getModeToolBlockReason('sonar', 'read', false, piDispatchTools)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vite-plus/test';
import {
  computeArtifactDigest,
  computeArtifactManifest,
  LandingReviewStateMachine,
  parseLandingReviewVerdict,
} from '@/landing-review.js';
import {
  isApprovedShippingCommand,
  isApprovedShippingCommandOnNonPrimaryBranch,
  isShippingCommand,
} from '@/shipping.js';

const digest = 'a'.repeat(64);
const verdict = {
  verdict: 'approved' as const,
  artifactDigest: digest,
  summary: 'safe',
  findings: [],
};

function armedMachine() {
  const machine = new LandingReviewStateMachine();
  machine.reset('root');
  machine.arm('root');
  return machine;
}

describe('landing-review state machine', () => {
  it('hashes current artifact content while ignoring Git metadata', async () => {
    let metadata = { before: 'old', additions: 1, deletions: 0 };
    const client = {
      session: {
        diff: async () => ({
          data: [{ file: 'src/file.ts', after: 'current content', ...metadata }],
        }),
      },
    };

    const first = await computeArtifactDigest(client, 'root', '/project');
    metadata = { before: 'different base', additions: 99, deletions: 3 };
    const afterCommit = await computeArtifactDigest(client, 'root', '/project');

    expect(afterCommit).toBe(first);
  });

  it('rejects unreadable or malformed artifact snapshots', async () => {
    await expect(
      computeArtifactDigest(
        { session: { diff: async () => ({ data: undefined }) } },
        'root',
        '/project',
      ),
    ).rejects.toThrow(/artifact data/);
    await expect(
      computeArtifactDigest(
        { session: { diff: async () => ({ data: [{ file: 'src/file.ts' }] }) } },
        'root',
        '/project',
      ),
    ).rejects.toThrow(/artifact file record/);
  });

  it('requires the armed -> reviewing -> identity-bound -> approved path', () => {
    const machine = armedMachine();
    expect(machine.get('root')?.state).toBe('armed');
    machine.claimReviewer('root');
    machine.setArtifactDigest('root', digest);
    machine.bindReviewer('root', 'reviewer');

    expect(machine.complete('root', 'reviewer', verdict, digest)).toBe('approved');
    expect(machine.get('root')).toMatchObject({
      state: 'approved',
      rootSessionID: 'root',
      reviewerSessionID: 'reviewer',
      artifactDigest: digest,
    });
  });

  it.each(['inactive', 'reviewing', 'rejected', 'failed', 'stale', 'approved'] as const)(
    'does not allow a second reviewer from %s',
    (state) => {
      const machine = new LandingReviewStateMachine();
      machine.reset('root');
      if (state !== 'inactive') machine.arm('root');
      if (['reviewing', 'rejected', 'failed', 'stale', 'approved'].includes(state)) {
        machine.claimReviewer('root');
        machine.setArtifactDigest('root', digest);
        machine.bindReviewer('root', 'reviewer');
      }
      if (state === 'rejected')
        machine.complete('root', 'reviewer', { ...verdict, verdict: 'rejected' }, digest);
      if (state === 'failed') machine.fail('root');
      if (state === 'stale') machine.complete('root', 'reviewer', verdict, 'b'.repeat(64));
      if (state === 'approved') machine.complete('root', 'reviewer', verdict, digest);

      expect(() => machine.claimReviewer('root')).toThrow();
    },
  );

  it('fails closed for malformed, mismatched, and wrong-identity verdicts', () => {
    const machine = armedMachine();
    machine.claimReviewer('root');
    machine.setArtifactDigest('root', digest);
    machine.bindReviewer('root', 'reviewer');

    expect(() => machine.complete('root', 'other', verdict, digest)).toThrow(/identity/);
    expect(machine.complete('root', 'reviewer', verdict, 'b'.repeat(64))).toBe('stale');

    const rejected = armedMachine();
    rejected.claimReviewer('root');
    rejected.setArtifactDigest('root', digest);
    rejected.bindReviewer('root', 'reviewer');
    expect(rejected.complete('root', 'reviewer', { ...verdict, verdict: 'rejected' }, digest)).toBe(
      'rejected',
    );
  });

  it('invalidates approved shipping when the artifact changes', () => {
    const machine = armedMachine();
    machine.claimReviewer('root');
    machine.setArtifactDigest('root', digest);
    machine.bindReviewer('root', 'reviewer');
    machine.complete('root', 'reviewer', verdict, digest);

    expect(machine.invalidateIfChanged('root', digest)).toBe(false);
    expect(machine.invalidateIfChanged('root', 'b'.repeat(64))).toBe(true);
    expect(machine.get('root')?.state).toBe('stale');
  });

  it('keeps approval across stage/commit metadata changes but rejects content changes and additions', async () => {
    let files = [{ file: 'src/file.ts', after: 'current content' }];
    const client = { session: { diff: async () => ({ data: files }) } };
    const machine = armedMachine();
    machine.claimReviewer('root');
    const reviewed = await computeArtifactManifest(client, 'root', '/project');
    machine.setArtifactManifest('root', reviewed);
    machine.bindReviewer('root', 'reviewer');
    machine.complete(
      'root',
      'reviewer',
      { ...verdict, artifactDigest: reviewed.digest },
      reviewed.digest,
      reviewed,
    );

    // Staging and committing change Git metadata, not the manifest.
    expect(
      machine.invalidateIfChanged(
        'root',
        reviewed.digest,
        await computeArtifactManifest(client, 'root', '/project'),
      ),
    ).toBe(false);

    files = [{ file: 'src/file.ts', after: 'changed content' }];
    expect(
      machine.invalidateIfChanged(
        'root',
        (await computeArtifactManifest(client, 'root', '/project')).digest,
        await computeArtifactManifest(client, 'root', '/project'),
      ),
    ).toBe(true);

    const addedMachine = armedMachine();
    addedMachine.claimReviewer('root');
    files = [{ file: 'src/file.ts', after: 'current content' }];
    const original = await computeArtifactManifest(client, 'root', '/project');
    addedMachine.setArtifactManifest('root', original);
    addedMachine.bindReviewer('root', 'reviewer');
    addedMachine.complete(
      'root',
      'reviewer',
      { ...verdict, artifactDigest: original.digest },
      original.digest,
      original,
    );
    files = [...files, { file: 'src/added.ts', after: 'new content' }];
    const withAdded = await computeArtifactManifest(client, 'root', '/project');
    expect(addedMachine.invalidateIfChanged('root', withAdded.digest, withAdded)).toBe(true);
  });

  it('leaves approved state terminally when digest validation fails', () => {
    const machine = armedMachine();
    machine.claimReviewer('root');
    machine.setArtifactDigest('root', digest);
    machine.bindReviewer('root', 'reviewer');
    machine.complete('root', 'reviewer', verdict, digest);

    machine.fail('root');

    expect(machine.get('root')?.state).toBe('failed');
    machine.fail('root');
    expect(machine.get('root')?.state).toBe('failed');
  });

  it('accepts only the exact verdict shape', () => {
    expect(parseLandingReviewVerdict(verdict)).toEqual(verdict);
    expect(parseLandingReviewVerdict({ ...verdict, extra: true })).toBeUndefined();
    expect(parseLandingReviewVerdict({ ...verdict, artifactDigest: 'short' })).toBeUndefined();
    expect(parseLandingReviewVerdict({ ...verdict, findings: ['ok', 1] })).toBeUndefined();
    expect(parseLandingReviewVerdict(JSON.stringify(verdict))).toBeUndefined();
  });
});

describe('approved shipping command language', () => {
  it('rejects force pushes, primary refs, target violations, and compounds', () => {
    expect(isShippingCommand('command git -C repo commit --no-verify -m ship')).toBe(true);
    expect(isShippingCommand('env GIT_OPTIONAL_LOCKS=0 git push origin feature')).toBe(true);
    expect(isShippingCommand("sh -c 'git commit -m ship'")).toBe(true);
    expect(isApprovedShippingCommand('git push --force origin feature')).toBe(false);
    expect(isApprovedShippingCommand('git push origin refs/heads/main')).toBe(false);
    expect(isApprovedShippingCommand('gh pr create --base main --head feature')).toBe(true);
    expect(isApprovedShippingCommand('gh pr create --head main')).toBe(false);
    expect(isApprovedShippingCommand('gh pr merge 12')).toBe(false);
    expect(isApprovedShippingCommand('git commit -m ship && git push origin feature')).toBe(false);
    expect(isShippingCommand('git commit -m ship && rm -rf /')).toBe(true);
  });

  it('requires explicit non-primary push refs and a verified non-primary commit branch', async () => {
    for (const command of [
      'git push origin',
      'git push origin HEAD',
      'git push origin main',
      'git push origin master',
      'git push origin feature:main',
    ]) {
      expect(isApprovedShippingCommand(command)).toBe(false);
    }
    for (const branch of ['main', 'master']) {
      await expect(
        isApprovedShippingCommandOnNonPrimaryBranch('git commit -m ship', async () => branch),
      ).resolves.toBe(false);
    }
    await expect(
      isApprovedShippingCommandOnNonPrimaryBranch('git commit -m ship', async () => undefined),
    ).resolves.toBe(false);
  });

  it('accepts ordinary validation and landing operations', () => {
    expect(isApprovedShippingCommand('vp check')).toBe(true);
    expect(isApprovedShippingCommand('vp test')).toBe(true);
    expect(isApprovedShippingCommand('git add -A')).toBe(true);
    expect(isApprovedShippingCommand('git commit -m "ship it"')).toBe(true);
    expect(isApprovedShippingCommand('git push origin feature')).toBe(true);
    expect(isApprovedShippingCommand('gh pr create --base main --head feature')).toBe(true);
    expect(isApprovedShippingCommand('gh pr edit 12 --title ship')).toBe(true);
  });
});

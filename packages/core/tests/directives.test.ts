import { describe, expect, it } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIRECTIVES_DIR = join(import.meta.dirname, '..', 'agent-directives');

function readDirective(...segments: string[]): string {
  return readFileSync(join(DIRECTIVES_DIR, ...segments), 'utf-8');
}

function readSection(document: string, heading: string): string {
  const start = document.indexOf(heading);
  expect(start, `missing section: ${heading}`).toBeGreaterThanOrEqual(0);
  const nextHeading = document.indexOf('\n## ', start + heading.length);
  return document.slice(start, nextHeading === -1 ? document.length : nextHeading);
}

describe('canonical directive safety contracts', () => {
  it('keeps universal safety floors and mode semantics intact', () => {
    const rules = readDirective('rules.md');
    const sonar = readDirective('commands', 'sonar.md');
    const fein = readDirective('commands', 'fein.md');
    const blitz = readDirective('commands', 'blitz.md');

    // Universal floors are non-waivable by any mode override.
    expect(rules).toMatch(
      /Mode overrides never waive safety, authorization, required review, or branch floors/,
    );

    // sonar is research-only and never implements.
    expect(sonar).toContain('## MODE: sonar (Research Only)');
    expect(sonar).toMatch(/Do not implement, write code, or create production files/);

    // fein requests the full route with required review.
    expect(fein).toContain('Activate the `full` route');
    expect(fein).toContain('required review floors');

    // blitz skips optional ceremony only and preserves every floor.
    expect(blitz).toContain('skipping optional reconnaissance and design ceremony');
    expect(blitz).toContain(
      'never waiving safety, authorization, required review, or branch floors',
    );
    expect(blitz).toContain('Escalate safety exceptions to the normal route');
  });

  it('blocks landing on unresolved findings within bounded autonomy', () => {
    const boundedAutonomy = readSection(readDirective('rules.md'), '## Bounded Autonomy');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(boundedAutonomy).toContain('Default budget: 3 rounds');
    expect(boundedAutonomy).toContain('hard cap of 5');
    expect(boundedAutonomy).toContain(
      'Any unresolved `[fix]` or `[escalate]` finding blocks termination, commit, merge, push, PR, and landing, including when the budget is exhausted',
    );
    expect(boundedAutonomy).toContain('Pivot once, then escalate');
    expect(orchestrator).toContain(
      'Unresolved `[fix]` or `[escalate]` findings always block termination and landing, including at budget exhaustion',
    );
    expect(orchestrator).toContain('Approve only when no `[fix]` or `[escalate]` remains');
  });

  it('scopes process cleanup to agent-owned work and forbids broad termination', () => {
    const lifecycle = readSection(readDirective('rules.md'), '## Process Lifecycle Ownership');

    expect(lifecycle).toContain('When the task ends, fails, is cancelled, or is abandoned');
    expect(lifecycle).toContain('stop any still-running work you started');
    expect(lifecycle).toMatch(/Never kill by broad name\/pattern/);
    expect(lifecycle).toContain('terminate user-owned or unrelated processes');
    expect(lifecycle).toContain(
      'Do not manage platform-owned child agents through shell process commands',
    );
  });

  it('retains completion evidence and the seven handoff fields', () => {
    const rules = readDirective('rules.md');
    const handoff = readDirective('skills', 'handoff.md');

    expect(rules).toContain('Before reporting completion, provide concrete termination evidence');
    expect(rules).toContain('An unverified result is not a completed handoff');
    for (const field of [
      'Goal',
      'Context',
      'Requirements',
      'Known problems',
      'Assumptions documented',
      'Success criteria',
      'Next step',
    ]) {
      expect(handoff).toContain(`**${field}**`);
    }
  });

  it('records goal/scope and classifies review findings without redefining the task', () => {
    const goalScope = readSection(readDirective('rules.md'), '## Goal and Scope Control');
    const reviewScope = readSection(readDirective('rules.md'), '## Review Scope');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(goalScope).toContain('Record the primary user outcome and the explicit non-goals');
    expect(goalScope).toContain(
      'in-scope fix, out-of-scope follow-up, platform limitation, or design-level blocker',
    );
    expect(goalScope).toContain(
      'Scope expansion requires a fresh design decision and updated acceptance criteria',
    );
    expect(reviewScope).toContain('category, severity, in-scope status, required action');
    expect(reviewScope).toContain(
      'do not automatically block the current unit unless they invalidate its acceptance criteria or create an immediate safety risk',
    );
    expect(reviewScope).toContain('record them as follow-ups');
    expect(orchestrator).toContain('Classify scope first');
    expect(orchestrator).toContain('record as follow-ups, do not expand the current unit');
  });

  it('orders security stops and design routing before builder work', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    // Security findings are never deferrable follow-ups, and the mandatory-stop
    // statement precedes any follow-up deferral path in the rules.
    expect(rules).toMatch(
      /Security, auth, or permission findings are never ordinary deferrable out-of-scope follow-ups/,
    );
    const securityFirst = rules.indexOf('never ordinary deferrable out-of-scope follow-ups');
    const deferralPath = rules.indexOf('otherwise defer it as a follow-up');
    expect(securityFirst).toBeGreaterThanOrEqual(0);
    expect(securityFirst).toBeLessThan(deferralPath);

    // Triage classifies security, then design blockers, then scope, then dispatch.
    const triageStart = orchestrator.indexOf('Collect and deduplicate findings');
    expect(triageStart).toBeGreaterThanOrEqual(0);
    const triage = orchestrator.slice(triageStart);
    const securityStop = triage.indexOf(
      'Security, auth, or permission findings are mandatory stops',
    );
    const designBlockers = triage.indexOf(
      'Design-level blockers route to `@architect` before any builder repair',
    );
    const classifyFirst = triage.indexOf('Classify scope first');
    const builderDispatch = triage.indexOf('dispatch `@builder`');
    const autoRepair = triage.indexOf('may be repaired automatically');
    expect(securityStop).toBeGreaterThanOrEqual(0);
    expect(designBlockers).toBeGreaterThanOrEqual(0);
    expect(classifyFirst).toBeGreaterThanOrEqual(0);
    expect(builderDispatch).toBeGreaterThanOrEqual(0);
    expect(autoRepair).toBeGreaterThanOrEqual(0);
    expect(securityStop).toBeLessThan(designBlockers);
    expect(securityStop).toBeLessThan(builderDispatch);
    expect(designBlockers).toBeLessThan(builderDispatch);
    expect(designBlockers).toBeLessThan(autoRepair);

    // The material checkpoint sequence stops on security before owner selection.
    const sequenceStart = orchestrator.indexOf('### Material Checkpoint Sequence');
    expect(sequenceStart).toBeGreaterThanOrEqual(0);
    const sequence = orchestrator.slice(sequenceStart);
    const checkpointSecurityStop = sequence.indexOf('Security stop');
    const neverDispatch = sequence.indexOf('never dispatch builder work');
    const proposeOwner = sequence.indexOf('Propose the next owner');
    expect(checkpointSecurityStop).toBeGreaterThanOrEqual(0);
    expect(neverDispatch).toBeGreaterThanOrEqual(0);
    expect(proposeOwner).toBeGreaterThanOrEqual(0);
    expect(checkpointSecurityStop).toBeLessThan(proposeOwner);
    expect(neverDispatch).toBeLessThan(proposeOwner);
  });

  it('scopes the branch/review prohibition to normal work with the preservation-only exception', () => {
    const commitSafety = readSection(readDirective('rules.md'), '## Commit and Branch Safety');
    const checkpointCommits = readSection(readDirective('rules.md'), '## Checkpoint Commits');

    // The protected-branch floor is unconditional.
    expect(commitSafety).toMatch(/Never commit or push to main/);
    // Normal work: an unresolved required review, authorization, or safety gate blocks push, PR, merge, and release.
    expect(commitSafety).toContain(
      'For normal work, never push, create a PR, merge, or release while a required review, authorization, or safety gate is unresolved',
    );
    // The narrow exception is a separately user-authorized checkpoint push, preservation-only.
    expect(commitSafety).toContain(
      'separately user-authorized feature-branch checkpoint push for preservation',
    );
    expect(commitSafety).toContain('cannot push protected branches');
    expect(commitSafety).toContain(
      'create or merge a PR, merge, release, or claim production readiness',
    );
    // A checkpoint push never authorizes PR/merge/release; final review and authorization remain required for shipping.
    expect(commitSafety).toContain(
      'final review plus the applicable authorization remain required for shipping',
    );
    expect(checkpointCommits).toContain('cannot satisfy final review or authorize shipping');
  });

  it('keeps checkpoint commits the narrow review exception with separate push/PR/merge/release gates', () => {
    const checkpointCommits = readSection(readDirective('rules.md'), '## Checkpoint Commits');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    // Normal commits require review approval; the explicit checkpoint is the only exception.
    expect(checkpointCommits).toMatch(/independent review approval before commit/);
    expect(checkpointCommits).toMatch(/only exception/);
    expect(checkpointCommits).toMatch(/preservation only/);
    // Checkpoint validation keeps scope/status/diff checks and excludes unrelated artifacts.
    expect(checkpointCommits).toMatch(/scope, status, and diff checks/);
    expect(checkpointCommits).toMatch(/exclude unrelated and untracked artifacts/);
    // Commit, push, PR, merge, and release are separate actions with separate gates.
    expect(checkpointCommits).toContain(
      'Commit, push, PR, merge, and release are separate actions',
    );
    expect(checkpointCommits).toMatch(/never auto-pushes, auto-creates a PR, merges, or releases/);
    expect(checkpointCommits).toMatch(/stops after the preservation commit/);
    expect(checkpointCommits).toMatch(/never enters the automatic push\/PR flow/);
    expect(checkpointCommits).toMatch(/unreviewed/);
    expect(checkpointCommits).toContain('does not mean the user prohibited pushing');
    // An authorized push preserves the unreviewed work but cannot merge or release.
    expect(checkpointCommits).toContain('separately authorizes pushing');
    expect(checkpointCommits).toContain('feature-branch push is allowed for preservation');
    expect(checkpointCommits).toMatch(/remains unreviewed and cannot merge or release/);
    expect(checkpointCommits).toContain('final review and the applicable authorization');
    // Normal reviewed work keeps the automatic push/PR policy; protected and unresolved floors block.
    expect(checkpointCommits).toContain('keeps the existing automatic push and PR policy');
    expect(checkpointCommits).toContain(
      'Protected branches and unresolved safety, security, or authorization floors remain blocked',
    );
    // No docs-only shortcut, no shipping authority, and floors are not waived.
    expect(checkpointCommits).toMatch(/Docs-only is not an unreviewed commit shortcut/);
    expect(checkpointCommits).toMatch(/cannot satisfy final review or authorize shipping/);
    expect(checkpointCommits).toMatch(/cannot be waived/);

    // The orchestrator checkpoint section mirrors the same separate-action gates.
    expect(orchestrator).toMatch(
      /The checkpoint path stops after the preservation commit and never enters the automatic push\/PR flow/,
    );
    expect(orchestrator).toContain('Commit, push, PR, merge, and release are separate actions');
    expect(orchestrator).toContain(
      'automatic push and PR steps never apply to a checkpoint commit',
    );
    expect(orchestrator).toContain('feature-branch push is allowed for preservation');
    expect(orchestrator).toMatch(
      /remains unreviewed, cannot claim production readiness, and cannot merge or release/,
    );
    expect(orchestrator).toContain('keeps the automatic push and PR policy');
    expect(orchestrator).toMatch(/never extends to commit/);
  });
});

import { describe, expect, it } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIRECTIVES_DIR = join(import.meta.dirname, '..', 'agent-directives');
const PACKAGES_DIR = join(DIRECTIVES_DIR, '..', '..');

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
  it('keeps sonar research-only and implementation-forbidden', () => {
    const sonar = readDirective('commands', 'sonar.md');

    expect(sonar).toContain('## MODE: sonar (Research Only)');
    expect(sonar).toMatch(/research-only mode/i);
    expect(sonar).toMatch(/Do not implement, write code, or create production files/);
  });

  it('keeps fein on the full route with required review', () => {
    const fein = readDirective('commands', 'fein.md');

    expect(fein).toContain('Activate the `full` route');
    expect(fein).toContain('required review floors');
  });

  it('keeps blitz limited to optional ceremony while preserving safety floors', () => {
    const blitz = readDirective('commands', 'blitz.md');

    expect(blitz).toContain('skipping optional reconnaissance and design ceremony');
    expect(blitz).toContain(
      'never waiving safety, authorization, required review, or branch floors',
    );
    expect(blitz).toContain('Escalate safety exceptions to the normal route');
    expect(blitz).toContain(
      'Use direct only for explanation/discovery or platform-supported non-code work',
    );
    expect(blitz).toContain('Route code changes through a permitted `@builder`');
  });

  it('routes code changes away from direct execution on permission-limited platforms', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(orchestrator).toContain('code changes use `focused` and a permitted `@builder`');
    expect(orchestrator).not.toContain('direct execution where the host supports it');
  });

  it('blocks landing with unresolved reviewer findings within bounded autonomy', () => {
    const boundedAutonomy = readSection(readDirective('rules.md'), '## Bounded Autonomy');

    expect(boundedAutonomy).toContain('Default budget: 3 rounds');
    expect(boundedAutonomy).toContain('hard cap of 5');
    expect(boundedAutonomy).toContain('Any unresolved `[fix]` or `[escalate]` finding blocks');
    expect(boundedAutonomy).toContain('never silently waives required review, safety');
  });

  it('scopes process cleanup to agent-owned work and forbids broad termination', () => {
    const lifecycle = readSection(readDirective('rules.md'), '## Process Lifecycle Ownership');

    expect(lifecycle).toContain('When the task ends, fails, is cancelled, or is abandoned');
    expect(lifecycle).toContain('stop any still-running work you started');
    expect(lifecycle).toMatch(/Never kill by broad name\/pattern/);
    expect(lifecycle).toContain('user-owned or unrelated processes');
    expect(lifecycle).toContain('platform-owned child agents');
  });

  it('retains all seven handoff contract fields', () => {
    const handoff = readDirective('skills', 'handoff.md');

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

  it('requires completion evidence and authorization checkpoints globally', () => {
    const rules = readDirective('rules.md');

    expect(rules).toContain('Before reporting completion, provide concrete termination evidence');
    expect(rules).toContain('documented assumptions');
    expect(rules).toContain('validation evidence/results');
    expect(rules).toContain('seven-field brief in `skills/handoff.md`');
    for (const checkpoint of [
      'security boundaries',
      'authentication or permissions',
      'data migrations or possible data loss',
      'production-impacting changes',
      'irreversible operations',
    ]) {
      expect(rules).toContain(checkpoint);
    }
    expect(rules).toContain(
      'Stop autonomous repair and obtain the applicable user, project, or platform authorization',
    );
    expect(rules).toContain('Ordinary ambiguity is not a checkpoint');
    expect(rules).toContain('Never commit or push to main');
    expect(rules).toContain('.maestria/workflow.md');
    expect(rules).toContain('on an unrecognized branch, ask first');
  });

  it('keeps specialist handoffs linked to the universal contract', () => {
    const builder = readDirective('specialists', 'builder.md');
    const architect = readDirective('specialists', 'architect.md');
    const planner = readDirective('specialists', 'planner.md');

    for (const prompt of [builder, architect, planner]) {
      expect(prompt).toContain('universal Handoff Contract in `rules.md` and `skills/handoff.md`');
    }
    expect(builder).toContain('Do not report completion without concrete termination evidence');
    expect(builder).not.toContain('Verification results');
  });

  it('preserves blind-review access restrictions', () => {
    const blindReview = readSection(readDirective('rules.md'), '## Blind Review');

    expect(blindReview).toContain('receives the requirements, acceptance criteria, and diff');
    expect(blindReview).toContain('Do not provide builder-authored summaries');
    expect(blindReview).toContain('inherited access lists');
    expect(blindReview).toContain('reviews against the acceptance criteria and diff alone');
  });

  it('preserves specialist-specific iteration bounds without replacing bounded autonomy', () => {
    const specialistBounds = [
      ['specialists/adventurer.md', 'Max 3 exploration approaches'],
      ['specialists/architect.md', 'Max 3 evidence-gathering rounds'],
      ['specialists/planner.md', 'Max 3 plan revisions'],
      ['specialists/diagnose.md', 'Max 3 diagnostic hypothesis or fix attempts'],
      ['specialists/reviewer.md', 'Max 3 re-reviews'],
      ['specialists/writer.md', 'Max 3 proofread-revise cycles'],
    ] as const;

    for (const [path, bound] of specialistBounds) {
      const directive = readDirective(...path.split('/'));
      expect(directive).toContain(bound);
      expect(directive).toContain('universal `rules.md#bounded-autonomy` budget');
    }
  });

  it('restores branch recognition in the orchestrator contract', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(orchestrator).toContain('Check your branch');
    expect(orchestrator).toContain('On an unrecognized branch, ask first');
    expect(orchestrator).toContain('Never commit or push to a protected branch');
  });

  it('preserves safety-qualified generated platform wording', () => {
    const cursorOrchestrator = readFileSync(
      join(PACKAGES_DIR, 'cursor/skills/orchestrator/SKILL.md'),
      'utf-8',
    );
    const hermesOrchestrator = readFileSync(
      join(PACKAGES_DIR, 'hermes/src/maestria_hermes/skills/orchestrator/SKILL.md'),
      'utf-8',
    );

    expect(cursorOrchestrator).toContain('Assumptions documented, Success criteria');
    expect(cursorOrchestrator).not.toContain('Known problems, Assumptions, Success criteria');
    expect(hermesOrchestrator).toContain(
      'code changes on Hermes are performed by a trusted top-level fein session',
    );
    expect(hermesOrchestrator).not.toContain('code changes route through a permitted `builder`');
    expect(hermesOrchestrator).toContain('code changes use `focused` and a permitted `builder`');
    expect(hermesOrchestrator).not.toContain(
      'direct work is limited to explanation, discovery and platform-supported non-code work. changes',
    );
    expect(hermesOrchestrator).not.toContain('non-code work; changes route');
    expect(hermesOrchestrator).not.toContain('skip gates');
    expect(hermesOrchestrator).toContain('no native review-state or landing gate');
    expect(hermesOrchestrator).toContain('Review enforcement is advisory here');
    expect(hermesOrchestrator).not.toContain('MAESTRIA_ROLE');
    expect(hermesOrchestrator).toContain('Delegated children are read/research/LLM-only');
    expect(hermesOrchestrator).not.toContain('trusted native `subagent_start` lifecycle state');
    expect(hermesOrchestrator).not.toContain('PermissionRole');
  });

  it('records the primary outcome and non-goals and classifies findings by scope', () => {
    const goalScope = readSection(readDirective('rules.md'), '## Goal and Scope Control');

    expect(goalScope).toContain('primary user outcome');
    expect(goalScope).toContain('explicit non-goals');
    expect(goalScope).toContain(
      'in-scope fix, out-of-scope follow-up, platform limitation, or design-level blocker',
    );
    expect(goalScope).toContain(
      'Scope expansion requires a fresh design decision and updated acceptance criteria',
    );
    expect(goalScope).toContain('otherwise defer it as a follow-up');
  });

  it('circuit-breaks repeated non-progress into architecture escalation', () => {
    const boundedAutonomy = readSection(readDirective('rules.md'), '## Bounded Autonomy');

    expect(boundedAutonomy).toContain('Pivot once, then escalate');
    expect(boundedAutonomy).toContain('stop and escalate to an architecture decision');
    expect(boundedAutonomy).toContain(
      'Do not spend the repair budget on unrelated platform or runtime work',
    );
    expect(boundedAutonomy).toContain('Security, auth, or permission findings are mandatory stops');
    expect(boundedAutonomy).toContain('never repair or follow-up work');
    expect(boundedAutonomy).toContain(
      'Completion is measured against the user outcome plus the acceptance criteria',
    );
  });

  it('requires reviewers to classify findings without silently redefining the task', () => {
    const reviewScope = readSection(readDirective('rules.md'), '## Review Scope');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(reviewScope).toContain('category, severity, in-scope status, required action');
    expect(reviewScope).toContain('do not automatically block the current unit');
    expect(reviewScope).toContain('record them as follow-ups');
    expect(reviewScope).toContain('route to `@architect`');
    expect(orchestrator).toContain('Classify scope first');
    expect(orchestrator).toContain('record as follow-ups, do not expand the current unit');
  });

  it('keeps security findings as mandatory stops and classifies design before fix triage', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const triageStart = orchestrator.indexOf('Collect and deduplicate findings');
    expect(triageStart).toBeGreaterThanOrEqual(0);
    const triage = orchestrator.slice(triageStart);

    // Security, auth, or permission findings are stops - never deferrable follow-ups.
    expect(rules).toMatch(
      /Security, auth, or permission findings are never ordinary deferrable out-of-scope follow-ups/,
    );
    expect(rules).toContain('Security, auth, or permission findings are mandatory stops');
    // The security stop is stated before any follow-up deferral path.
    const nonDeferrable = rules.indexOf('never ordinary deferrable out-of-scope follow-ups');
    const deferralPath = rules.indexOf('otherwise defer it as a follow-up');
    expect(nonDeferrable).toBeGreaterThanOrEqual(0);
    expect(deferralPath).toBeGreaterThanOrEqual(0);
    expect(nonDeferrable).toBeLessThan(deferralPath);
    // The triage stops on security before dispatching any builder work, and the
    // security stop step never defers a security finding as a follow-up.
    expect(orchestrator).toContain('Security, auth, or permission findings are mandatory stops');
    const securityStop = triage.indexOf(
      'Security, auth, or permission findings are mandatory stops',
    );
    const builderDispatch = triage.indexOf('dispatch `@builder`');
    const classifyFirst = triage.indexOf('Classify scope first');
    const designBlockers = triage.indexOf(
      'Design-level blockers route to `@architect` before any builder repair',
    );
    const autoRepair = triage.indexOf('may be repaired automatically');
    expect(securityStop).toBeGreaterThanOrEqual(0);
    expect(builderDispatch).toBeGreaterThanOrEqual(0);
    expect(classifyFirst).toBeGreaterThanOrEqual(0);
    expect(designBlockers).toBeGreaterThanOrEqual(0);
    expect(autoRepair).toBeGreaterThanOrEqual(0);
    expect(securityStop).toBeLessThan(builderDispatch);
    expect(triage.slice(0, classifyFirst)).not.toContain('record as follow-ups');
    // Design-level blockers route to `@architect` before any builder dispatch or repair.
    expect(classifyFirst).toBeLessThan(builderDispatch);
    expect(designBlockers).toBeLessThan(builderDispatch);
    expect(designBlockers).toBeLessThan(autoRepair);
  });

  it('keeps checkpoint commits the narrow exception to review-before-commit', () => {
    const checkpointCommits = readSection(readDirective('rules.md'), '## Checkpoint Commits');

    // Normal commits still require review approval; the checkpoint is the only exception.
    expect(checkpointCommits).toMatch(/review approval before commit/);
    expect(checkpointCommits).toMatch(/only exception/);
    expect(checkpointCommits).toMatch(/preservation only/);
    // Checkpoint validation keeps scope/status/diff checks and excludes unrelated artifacts.
    expect(checkpointCommits).toMatch(/scope, status, and diff checks/);
    expect(checkpointCommits).toMatch(/exclude unrelated and untracked artifacts/);
    // Labelled unreviewed, no default push/PR, no shipping authority.
    expect(checkpointCommits).toMatch(/unreviewed/);
    expect(checkpointCommits).toContain('not production-ready');
    expect(checkpointCommits).toMatch(/do not default-push or create a PR/);
    // The checkpoint path stops after the preservation commit; push/PR need separate authorization and final review.
    expect(checkpointCommits).toMatch(/stops after the preservation commit/);
    expect(checkpointCommits).toMatch(/never enters the automatic push\/PR flow/);
    expect(checkpointCommits).toMatch(/separate authorization and final review/);
    expect(checkpointCommits).toMatch(/cannot satisfy final review or authorize shipping/);
    // No docs-only shortcut: the exemption is review-only, never commit approval.
    expect(checkpointCommits).toMatch(/Docs-only is not an unreviewed commit shortcut/);
    expect(checkpointCommits).toMatch(/review dispatch only, never to commit approval/);
    // Safety, security, and authorization floors are not waived.
    expect(checkpointCommits).toMatch(/cannot be waived/);
  });

  it('runs a material-checkpoint scope sequence covering every reported event', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const start = orchestrator.indexOf('### Material Checkpoint Sequence');
    expect(start).toBeGreaterThanOrEqual(0);
    const sequence = orchestrator.slice(start);

    expect(sequence).toMatch(/Restate the primary user outcome and the explicit non-goals/);
    expect(sequence).toMatch(/Check scope/);
    expect(sequence).toMatch(/Classify findings/);
    expect(sequence).toMatch(/Propose the next owner/);
    expect(sequence).toMatch(/Stop when the outcome is met/);
    // The sequence covers every material event the checkpoints contract reports.
    for (const event of [
      'route selected',
      'delegation completed, blocked, or failed',
      'verification result',
      'review verdict',
      'commit, push, or PR result',
    ]) {
      expect(sequence).toContain(event);
    }
    // Non-applicable events are skipped, not forced.
    expect(sequence).toMatch(/only applicable events/);
  });

  it('stops on security before owner selection in the material checkpoint sequence', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const start = orchestrator.indexOf('### Material Checkpoint Sequence');
    expect(start).toBeGreaterThanOrEqual(0);
    const sequence = orchestrator.slice(start);

    const securityStop = sequence.indexOf('Security stop');
    const neverDispatch = sequence.indexOf('never dispatch builder work');
    const proposeOwner = sequence.indexOf('Propose the next owner');
    expect(securityStop).toBeGreaterThanOrEqual(0);
    expect(neverDispatch).toBeGreaterThanOrEqual(0);
    expect(proposeOwner).toBeGreaterThanOrEqual(0);
    // The mandatory security stop/authorization branch precedes owner selection.
    expect(securityStop).toBeLessThan(proposeOwner);
    expect(neverDispatch).toBeLessThan(proposeOwner);
  });

  it('never lets docs-only or checkpoint commits shortcut commit review', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const specialistOwnership = orchestrator.indexOf('### Specialist Ownership');
    const commitProtocol = orchestrator.indexOf('## Commit Protocol');
    expect(specialistOwnership).toBeGreaterThanOrEqual(0);
    expect(commitProtocol).toBeGreaterThanOrEqual(0);
    const routing = orchestrator.slice(0, specialistOwnership);
    const protocol = orchestrator.slice(commitProtocol);

    // The docs-only review exemption never extends to commit.
    expect(routing).toMatch(/do not automatically require review/);
    expect(routing).toMatch(/never extends to commit/);
    expect(routing).toContain('docs-only is not an unreviewed commit shortcut');
    expect(routing).not.toMatch(/docs-only[^.]*commit without review/);
    // The checkpoint commit path stops after preservation and never auto-pushes/PRs.
    expect(protocol).toMatch(/### Checkpoint Commits/);
    expect(protocol).toMatch(/stops after the preservation commit/);
    expect(protocol).toMatch(/never enters the automatic push\/PR flow/);
    expect(protocol).toMatch(/separate authorization and final review/);
    // The checkpoint path has no automatic push or PR step of its own.
    const checkpointCommits = protocol.indexOf('### Checkpoint Commits');
    expect(checkpointCommits).toBeGreaterThanOrEqual(0);
    const checkpointPath = protocol.slice(checkpointCommits);
    expect(checkpointPath).not.toMatch(/push automatically/i);
    expect(checkpointPath).not.toMatch(/auto-create/i);
  });
});

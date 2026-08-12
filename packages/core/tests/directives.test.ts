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

  it('bounds work units, failed outputs, and context rollover', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const iterationLimits = readDirective('skills', 'iteration-limits.md');

    expect(rules).toContain('## Work Unit and Child Budgets');
    expect(rules).toContain('finite, positive route child-dispatch budget');
    expect(rules).toContain('finite, non-negative child-task repair budget');
    expect(rules).toContain('an invalid override is a blocked route');
    expect(rules).toContain('decrement before dispatching and never reset silently');
    expect(rules).toContain('success, blocked, failed, cancelled, or abandoned');
    expect(rules).toContain(
      'Empty, malformed, unavailable, or blocked specialist output is not success',
    );
    expect(rules).toContain('at most one changed-brief recovery');
    expect(rules).toContain('second empty or blocked result trips the task circuit breaker');
    expect(rules).toContain('ownership/identity, scoped stop method');
    expect(rules).toContain('terminal-state or exit verification');
    expect(rules).toContain('retained log/artifact location');
    expect(rules).toContain('report `none started` when applicable');
    expect(rules).toContain('Before compaction or context rollover');
    expect(rules).toContain('child statuses and remaining budgets');

    const sessionFlow = readSection(orchestrator, '## Session Flow');
    expect(sessionFlow).toContain('Declare the work-unit ledger');
    expect(sessionFlow).toContain('within the declared budgets');
    expect(sessionFlow).toContain('A changed outcome starts a new work unit');
    expect(orchestrator).toContain('blocked route, never approval');
    expect(orchestrator).toContain('one owning delegation plus only its required reviewer');
    expect(orchestrator).toContain(
      'one thinker, one integrated worker batch, and one general reviewer by default',
    );
    expect(iterationLimits).toContain('finite route and child-task budgets');
    expect(iterationLimits).toContain('trip the circuit breaker');

    expect(sessionFlow.indexOf('Declare the work-unit ledger')).toBeLessThan(
      sessionFlow.indexOf('Delegate'),
    );
    expect(rules.indexOf('Allow at most one changed-brief recovery')).toBeLessThan(
      rules.indexOf('second empty or blocked result trips the task circuit breaker'),
    );
  });

  it('recovers from dispatch failures without mutating code or consuming repair budget', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    // A failed delegation is not idle: preserve the ledger and dispatch at most one
    // recovery attempt for the same child, with a corrected brief when the cause is identifiable.
    expect(rules).toContain('preserve the work ledger and artifacts');
    expect(rules).toContain('at most one recovery attempt for the same child');
    expect(rules).toContain('a materially corrected brief when the cause is identifiable');
    expect(orchestrator).toContain('**Dispatch failure fallback.**');
    expect(orchestrator).toContain('Apply the universal Context Management recovery contract');

    // Continue read-only exploration, planning, and reporting while the child is unavailable.
    expect(rules).toContain(
      'continue independent read-only exploration, planning, and result reporting where useful',
    );
    expect(orchestrator).toContain('independent read-only work may continue');

    // Never mutate code as a fallback and never waive review or safety floors.
    expect(rules).toContain(
      'Never mutate code directly as a fallback and never waive review or safety floors',
    );
    expect(orchestrator).toContain(
      'Never mutate code as a fallback or waive route, review, or safety floors',
    );

    // Transient provider/transport failures are not substantive progress and consume no
    // repair budget, but every attempt still counts against dispatch-attempt accounting.
    expect(rules).toContain(
      'Transient attempts do not count as substantive repair progress and consume no repair/review budget',
    );
    expect(rules).toContain('every attempt still counts against dispatch-attempt accounting');
    expect(orchestrator).toContain(
      'Transient failures consume no repair budget but count as dispatch attempts',
    );
  });

  it('records a failed dispatch as terminal before any recovery and treats recovery as a new attempt for the same child', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    // The failed attempt becomes terminal blocked or failed before a recovery dispatch.
    expect(rules).toContain('record it as terminal `blocked` or `failed` first');
    expect(orchestrator).toContain(
      'terminally record unavailable, malformed, or timed-out delegations before recovery',
    );

    // Recovery remains one bounded attempt shared by changed briefs and dispatch recovery.
    expect(rules).toContain('Recovery is a new attempt for the same child, not dependent work');
    expect(rules).toContain(
      "counts against the child's single recovery allowance shared with the changed-brief rule",
    );
    expect(rules).toContain(
      'Allow at most one changed-brief recovery per child when new evidence justifies it',
    );
    expect(orchestrator).toContain('use one shared recovery allowance');

    // If recovery fails, preserve the terminal delta and stop dependent work.
    expect(rules).toContain(
      'If recovery fails, preserve the terminal delta and stop dependent work',
    );
    expect(orchestrator).toContain('failed recovery stops dependent work');

    // Validate records failed or cancelled attempts as terminal before any recovery dispatch.
    expect(orchestrator).toContain(
      'record failed or cancelled attempts as terminal before any recovery dispatch',
    );
  });

  it('never retries intentional cancellation while bounding infrastructure-cancellation retries', () => {
    const workUnit = readSection(readDirective('rules.md'), '## Work Unit and Child Budgets');
    const context = readSection(readDirective('rules.md'), '## Context Management');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    // Runtime-classified infrastructure cancellations are transient and get at most one
    // bounded retry with backoff or reduced concurrency - a finite, not unbounded, bound.
    expect(workUnit).toContain(
      'Provider overload, header timeouts, transport failures, and runtime-classified infrastructure cancellations are transient',
    );
    expect(workUnit).toContain('at most one bounded retry with backoff or reduced concurrency');

    // User-requested or platform-intentional cancellation is terminal and never retried or continued.
    expect(workUnit).toContain(
      'User-requested or platform-intentional cancellation is terminal and is never retried or continued',
    );
    expect(context).toContain(
      'Intentional user or platform cancellation is terminal `cancelled` and is never retried or continued',
    );
    expect(orchestrator).toContain(
      'Intentional user or platform cancellation is terminal `cancelled` and never retried or continued',
    );
    expect(context).toContain(
      'Empty, malformed, unavailable, or blocked specialist output is not success',
    );
    expect(context).toContain('a second empty or blocked result trips the task circuit breaker');

    // The old unbounded shorthand is gone from the budget section.
    expect(workUnit).not.toContain('cancellations are infrastructure-transient');
    expect(workUnit).not.toContain('retry with bounded backoff or reduce concurrency');
  });

  it('defaults budgets for simple routes and continues the same work unit on routine messages', () => {
    const workUnit = readSection(readDirective('rules.md'), '## Work Unit and Child Budgets');
    const sessionFlow = readSection(
      readDirective('specialists', 'orchestrator.md'),
      '## Session Flow',
    );
    const iterationLimits = readDirective('skills', 'iteration-limits.md');

    // Default routes use implicit finite defaults; explicit declarations are for
    // fan-out, non-default children, or repair extensions. A missing ledger line is not a blocked route.
    expect(workUnit).toContain('Default routes run on the finite default budgets implicitly');
    expect(workUnit).toContain('one owning specialist plus only its required reviewer');
    expect(workUnit).toContain(
      'Declare explicit finite route and child-task budgets only for fan-out, non-default children, or repair extensions',
    );
    expect(workUnit).toContain('A missing ceremonial ledger line is not a blocked route');
    expect(workUnit).toContain('when a safe default route is obvious');
    expect(iterationLimits).toContain(
      'Declare and decrement finite route and child-task budgets only for fan-out, non-default children, or repair extensions',
    );

    // Bounded repair defaults survive, and adaptive repair is accounted in the internal handoff/checkpoint.
    expect(workUnit).toContain('3 repair rounds, hard-capped at 5');
    expect(workUnit).toContain(
      'account for remaining budgets in the internal handoff and checkpoint updates',
    );

    // Continuation: greeting/status/explanation/continuation is not a new work unit and
    // does not reset budgets or force re-routing; only a changed outcome restarts the unit.
    expect(workUnit).toContain(
      'A greeting, status check, explanation, or continuation of the same outcome is not a new work unit',
    );
    expect(workUnit).toContain('it does not reset budgets and does not force re-routing');
    expect(workUnit).toContain('Only a changed outcome starts a fresh route');
    expect(sessionFlow).toContain(
      'A greeting, status check, explanation, or continuation of the same outcome is not a new work unit',
    );
    expect(sessionFlow).toContain('does not reset budgets and does not force re-routing');
    expect(sessionFlow).toContain('A changed outcome starts a new work unit');
    expect(sessionFlow).toContain('using finite default shapes');
    expect(sessionFlow).not.toContain(
      'finite route budget, and child-task budgets before delegation',
    );
  });

  it('defines finite default shapes for every route with one-initial one-recovery accounting', () => {
    const workUnit = readSection(readDirective('rules.md'), '## Work Unit and Child Budgets');
    const fanOut = readSection(
      readDirective('specialists', 'orchestrator.md'),
      '### Parallel Fan-Out',
    );

    // Every route has an explicit, finite default shape.
    expect(workUnit).toContain('`direct` uses zero child dispatches');
    expect(workUnit).toContain(
      '`focused` uses one owning specialist plus only its required reviewer',
    );
    expect(workUnit).toContain(
      '`full` uses one thinker, one integrated worker batch, and one general reviewer',
    );
    expect(workUnit).toContain('with a risk lens only when evidenced and explicitly added');
    expect(workUnit).toContain(
      '`sonar` uses one owning read-only specialist plus at most one distinct read-only specialist',
    );

    // The finite defaults apply and are counted internally without numeric budget fields.
    expect(workUnit).toContain('the finite defaults apply and are counted internally');
    expect(workUnit).toContain('without requiring numeric budget fields');

    // Each planned child gets one initial dispatch and at most one recovery dispatch,
    // so recovery is finite and included in the route budget.
    expect(workUnit).toContain('one initial dispatch and at most one recovery dispatch');
    expect(workUnit).toContain('recovery is finite and included in the route budget');

    // Repair rounds are separate from dispatch recovery.
    expect(workUnit).toContain(
      '3 repair rounds, hard-capped at 5, extended only on observable progress',
    );
    expect(workUnit).toContain('separate from dispatch recovery');

    // The orchestrator fan-out section mirrors the focused and full default shapes.
    expect(fanOut).toContain(
      '`focused` uses one owning delegation plus only its required reviewer',
    );
    expect(fanOut).toContain(
      '`full` uses one thinker, one integrated worker batch, and one general reviewer by default',
    );
  });

  it('keeps the composition summary aligned with the universal recovery and budget rules', () => {
    const composition = readDirective('COMPOSITION.md');
    const rules = readDirective('rules.md');

    // Route defaults are summarized with the same finite shapes, not a weaker shorthand.
    expect(composition).toContain('`direct` zero dispatches');
    expect(composition).toContain(
      '`focused` one owning specialist plus only its required reviewer',
    );
    expect(composition).toContain(
      '`full` one thinker, one integrated worker batch, one general reviewer',
    );
    expect(composition).toContain(
      '`sonar` one owning read-only specialist plus at most one distinct read-only specialist',
    );
    expect(composition).toContain(
      'each planned child gets one initial dispatch and at most one recovery dispatch',
    );

    // Recovery mirrors the universal terminal-before-recovery and one-recovery bounds.
    expect(composition).toContain('record it terminal blocked or failed first');
    expect(composition).toContain('at most one recovery dispatch for the same child');
    expect(composition).toContain('otherwise one bounded transport retry');
    expect(composition).toContain('intentional cancellation is terminal and never retried');
    expect(composition).toContain('if recovery fails, preserve the delta and stop dependent work');

    // The weak "retry once" shorthand without conditions is not used.
    expect(composition).not.toContain('retry once with a corrected brief');
    expect(rules).not.toContain('retry at most once with a materially corrected brief');
  });

  it('does not frame user questions as normal routed progress', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(orchestrator).not.toContain('progress is made through delegation and user questions');
    expect(orchestrator).toContain(
      'user input is sought only at universal authorization checkpoints and genuine user-required intent boundaries',
    );
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

  it('retains the non-negotiable ship-docs-with-code contract', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(rules).toContain("**!!! Don't anthropomorphize effort**");
    expect(rules).toContain('**!!! Write for humans**');
    expect(rules).toContain('Surface materially relevant incidental findings');
    expect(rules).toContain('If a platform URL-fetch operation hangs');
    expect(rules).toContain('**!!! Ship docs with code**');
    expect(rules).toContain(
      'Any `packages/` change or behavior-affecting change MUST have a corresponding changeset',
    );
    expect(rules).toContain('Keep docs, changelogs, and changesets in sync with the change');
    expect(rules).toContain(
      'After every builder task that lands a code change, use the Work Results table',
    );
    expect(orchestrator).toContain('Work Results table');
    expect(orchestrator).toContain('**!!! Never implement routed code changes yourself.**');
    expect(orchestrator).toContain('Each delegation owns one coherent outcome');
    expect(orchestrator).toContain('If the user rejects the approach twice in a row');
    expect(orchestrator).toContain('Git mutations remain route-scoped');
    expect(orchestrator).toContain('**!!! Docs Audit**');
    expect(orchestrator).toContain(
      'any `packages/` change or behavior-affecting change MUST have a corresponding changeset',
    );
  });

  it('keeps canonical directives independent of projection paths and host permissions', () => {
    const directiveFiles = [
      'rules.md',
      'skills/iteration-limits.md',
      'specialists/adventurer.md',
      'specialists/architect.md',
      'specialists/builder.md',
      'specialists/diagnose.md',
      'specialists/orchestrator.md',
      'specialists/planner.md',
      'specialists/reviewer.md',
      'specialists/writer.md',
    ];
    const canonical = directiveFiles.map((file) => readDirective(...file.split('/'))).join('\n');

    // Projection paths and permission/tool names belong to sync.config.ts, not core.
    expect(canonical).not.toContain('skills/handoff.md');
    expect(canonical).not.toMatch(/`rules\.md(?:#|`)/);
    expect(canonical).not.toContain('bash allow-list');
    expect(canonical).not.toContain('bash permissions are `ask`');
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
    // Normal work: unresolved required review, authorization, or safety gates block lifecycle actions.
    expect(commitSafety).toContain(
      'Never push, create a PR, merge, or release while a required review, authorization, or safety gate is unresolved',
    );
    // The narrow exception is a separately user-authorized checkpoint push, preservation-only.
    expect(commitSafety).toContain(
      'A feature-branch checkpoint push may preserve unreviewed work only when separately authorized',
    );
    expect(commitSafety).toContain('cannot push protected branches');
    expect(commitSafety).toContain(
      'create or merge a PR, merge, release, or claim production readiness',
    );
    // A checkpoint push never authorizes PR/merge/release; final review and authorization remain required for shipping.
    expect(commitSafety).toContain(
      'it cannot push protected branches, create or merge a PR, merge, release, or claim production readiness',
    );
    expect(checkpointCommits).toContain('cannot satisfy final review or authorize shipping');
  });

  it('permits autonomous reviewed commits while keeping lifecycle actions separate', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const commitSafety = readSection(rules, '## Commit and Branch Safety');

    expect(commitSafety).toContain(
      'may commit completed, validated work autonomously after the required independent review',
    );
    expect(commitSafety).toContain(
      'No additional user confirmation is required for the commit itself',
    );
    expect(commitSafety).toContain(
      'push, PR creation, merge, and release remain subject to their own project and platform authorization',
    );
    expect(orchestrator).toContain(
      'the orchestrator may authorize one autonomous routine commit on a recognized feature branch',
    );
    expect(orchestrator).not.toContain('explicit user commit request in the current turn');
    expect(orchestrator).not.toContain('authorization resets to zero after the commit');
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
    expect(checkpointCommits).toMatch(/never enters the configured push\/PR flow/);
    expect(checkpointCommits).toMatch(/unreviewed/);
    expect(checkpointCommits).toContain('does not mean the user prohibited pushing');
    // An authorized push preserves the unreviewed work but cannot merge or release.
    expect(checkpointCommits).toContain('separately authorizes pushing');
    expect(checkpointCommits).toContain('feature-branch push is allowed for preservation');
    expect(checkpointCommits).toMatch(/remains unreviewed and cannot merge or release/);
    expect(checkpointCommits).toContain('final review and the applicable authorization');
    // Normal reviewed work follows configured project/platform policy; protected and unresolved floors block.
    expect(checkpointCommits).toContain('follows the project and platform push/PR policy');
    expect(checkpointCommits).toContain(
      'Protected branches and unresolved safety, security, or authorization floors remain blocked',
    );
    // No docs-only shortcut, no shipping authority, and floors are not waived.
    expect(checkpointCommits).toMatch(/docs-only review exemption does not waive validation/);
    expect(checkpointCommits).toMatch(/cannot satisfy final review or authorize shipping/);
    expect(checkpointCommits).toMatch(/cannot be waived/);

    // The orchestrator checkpoint section mirrors the same separate-action gates.
    expect(orchestrator).toMatch(
      /The checkpoint path stops after the preservation commit and never enters the configured push\/PR flow/,
    );
    expect(orchestrator).toContain('Commit, push, PR, merge, and release are separate actions');
    expect(orchestrator).toContain(
      'configured push and PR steps never apply to a checkpoint commit',
    );
    expect(orchestrator).toContain('feature-branch push is allowed for preservation');
    expect(orchestrator).toMatch(
      /remains unreviewed, cannot claim production readiness, and cannot merge or release/,
    );
    expect(orchestrator).toContain('follows the project and platform push/PR policy');
    expect(orchestrator).toMatch(/never extends to commit/);
    expect(orchestrator).not.toContain('Push automatically');
    expect(orchestrator).not.toContain('Auto-create on the first push');
    expect(orchestrator).toContain('platform provides an authorized push integration');
    expect(orchestrator).toContain('platform provides an authorized PR integration');
  });

  it('orders fan-out, the integration barrier, and sequential review lenses', () => {
    const parallel = readSection(readDirective('rules.md'), '## Parallelization');
    const fanOut = readSection(
      readDirective('specialists', 'orchestrator.md'),
      '### Parallel Fan-Out',
    );
    const reviewDispatch = readSection(
      readDirective('specialists', 'orchestrator.md'),
      '## Review Dispatch and Triage',
    );

    // Universal parallelization safety stays owned by the universal rules contract.
    expect(parallel).toContain('different scopes only');
    expect(parallel).toContain('single writer or sequential execution');
    expect(parallel).toContain('two builders on overlapping files');
    expect(parallel).toContain('reviewers concurrently on the same change');

    // Fan-out covers only independent, non-overlapping builder or thinker work
    // and keeps one writer per file or module via the universal rules.
    expect(fanOut).toContain('independent, non-overlapping work within the declared budget');
    expect(fanOut).toContain('One writer per file or module');
    expect(fanOut).toContain('universal parallelization safety contract');

    // The integration barrier collects and reconciles outputs before review.
    const barrier = fanOut.indexOf('integration barrier');
    expect(barrier).toBeGreaterThanOrEqual(0);
    expect(barrier).toBeLessThan(fanOut.indexOf('before review'));
    expect(fanOut).toContain('Collect and reconcile all parallel outputs');

    // The integration barrier precedes the general review dispatch in the sequence.
    const barrierInDispatch = reviewDispatch.indexOf('integration barrier');
    const generalInDispatch = reviewDispatch.indexOf('general reviewer first');
    expect(barrierInDispatch).toBeGreaterThanOrEqual(0);
    expect(barrierInDispatch).toBeLessThan(generalInDispatch);

    // General reviewer runs first, then risk-matched lenses sequentially;
    // never concurrent reviewers against the same change.
    const general = reviewDispatch.indexOf('general reviewer first');
    const lenses = reviewDispatch.indexOf('risk-matched lenses');
    expect(general).toBeGreaterThanOrEqual(0);
    expect(general).toBeLessThan(lenses);
    expect(reviewDispatch).toContain('never concurrent reviewers against the same change');

    // The universal clause is not restated as a full clause in the orchestrator.
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    expect(orchestrator).not.toContain('single writer or sequential execution');
    expect(orchestrator).not.toContain('two builders on overlapping files');

    // Review is batched after integration, never per builder task.
    expect(orchestrator).not.toContain('after every builder task');
  });

  it('specifies delegation outcomes and termination instead of activity sequences', () => {
    const outcomeSpecs = readSection(
      readDirective('specialists', 'orchestrator.md'),
      '### Outcome Specs Over Activity Specs',
    );

    expect(outcomeSpecs).toContain('goal, constraints, acceptance criteria');
    expect(outcomeSpecs).toContain('termination condition');
    expect(outcomeSpecs).toContain('Do not prescribe generic tool sequences');
    expect(outcomeSpecs).toContain('Requirements constraint, not the Goal');
  });

  it('keeps assumptions and evidence separate and rechecks the primary outcome', () => {
    const hygiene = readSection(
      readDirective('specialists', 'orchestrator.md'),
      '### Cognitive Hygiene',
    );

    expect(hygiene).toContain('Keep assumptions, evidence, and findings separate');
    expect(hygiene).toContain('stale plan after requirements or evidence change');
    expect(hygiene).toContain('re-check the primary outcome at checkpoints');
    expect(hygiene).toContain('builder narratives out of reviewer access lists');
  });

  it('orders the session flow from route to final handoff with stop semantics', () => {
    const flow = readSection(readDirective('specialists', 'orchestrator.md'), '## Session Flow');

    for (const stage of [
      'Route',
      'Load rules',
      'Delegate',
      'Validate',
      'Review and triage',
      'Commit, push, PR gates',
      'Hand off',
    ]) {
      expect(flow).toContain(`**${stage}**`);
    }
    expect(flow).toContain('`sonar` stops after research with no implementation');
    expect(flow).toContain('checkpoint commits stop after the preservation commit');
  });

  it('reports result fields at signature level with change markers', () => {
    const resultReporting = readSection(readDirective('rules.md'), '## Context Management');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(resultReporting).toContain('outcome summary');
    expect(resultReporting).toContain('changed files by signature or interface');
    expect(resultReporting).toContain('verification evidence');
    expect(resultReporting).toContain('blockers or follow-ups');
    expect(resultReporting).toContain('next step');
    // The marker legend is owned by the universal result-reporting contract in rules.md.
    expect(resultReporting).toMatch(/`\+` new, `~` modified, `-` deleted, `!` breaking/);
    expect(resultReporting).toContain('`(test)` for test files');
    // The orchestrator references the legend without restating it.
    expect(orchestrator).toContain('result marker legend');
    expect(orchestrator).not.toMatch(/`\+` new, `~` modified, `-` deleted, `!` breaking/);
    expect(orchestrator).not.toContain('`(test)` for test files');
    expect(orchestrator).toContain('Completion evidence follows the universal Handoff Contract');
    // The universal field list stays owned by rules.md, not restated as a clause here.
    expect(orchestrator).not.toContain('outcome summary, changed files at signature level');
  });
});

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
});

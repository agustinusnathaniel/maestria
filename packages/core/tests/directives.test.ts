import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const DIRECTIVES_DIR = path.join(import.meta.dirname, '..', 'agent-directives');

const readDirective = (...segments: string[]): string =>
  readFileSync(path.join(DIRECTIVES_DIR, ...segments), 'utf-8');

describe('canonical directive behavioral contracts', () => {
  it('preserves safety, authorization, acceptance, branch, and sync floors', () => {
    const rules = readDirective('rules.md');

    expect(rules).toMatch(/match effort to stakes/iu);
    expect(rules).toMatch(/prefer reuse over reinvention/iu);
    expect(rules).toMatch(/safety and authorization/iu);
    expect(rules).toMatch(/security.*permission|permission.*security/iu);
    expect(rules).toMatch(/observable evidence/iu);
    expect(rules).toMatch(/protected-branch|protected branch/iu);
    expect(rules).toMatch(/routine delivery is autonomous/iu);
    expect(rules).toMatch(/stop and verify them before completion/iu);
    expect(rules).toMatch(/maker\/checker/iu);
    expect(rules).toMatch(/canonical source invariant/iu);
    expect(rules).toMatch(/project's authoritative source/iu);
    expect(rules).not.toContain('packages/core/agent-directives/');
    expect(rules).toMatch(/sync check/iu);
  });

  it('keeps maker/checker review blind and distinguishes blocking findings', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const reviewer = readDirective('specialists', 'reviewer.md');

    expect(rules).toMatch(/implementer must not approve its own work/iu);
    expect(rules).toMatch(
      /requirements, acceptance criteria, relevant diff, and available validation or behavior evidence/iu,
    );
    expect(rules).toMatch(/maker claims|maker-authored narrative/iu);
    expect(rules).toContain('in-scope defects');
    expect(rules).toMatch(/repaired autonomously/iu);
    expect(rules).toMatch(/out-of-scope/iu);
    expect(rules).toContain('follow-ups');
    expect(orchestrator).toContain('[escalate]');
    expect(orchestrator).toMatch(/blocks completion only when/iu);
    expect(orchestrator).toContain('acceptance, safety');
    expect(orchestrator).toContain('authorization');
    expect(reviewer).toMatch(/label `\[fix\]` only for a concrete blocker/iu);
    expect(reviewer).toMatch(/after a repair, re-review only the repaired scope/iu);
  });

  it('keeps rendered evidence distinct from builds and attachment support', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const builder = readDirective('specialists', 'builder.md');
    const rootSkill = readFileSync(
      path.join(DIRECTIVES_DIR, '..', '..', '..', 'skills', 'create-pull-request', 'SKILL.md'),
      'utf-8',
    );

    expect(rules).toMatch(/rendered appearance and interactions need rendered checks/iu);
    expect(rules).toMatch(/do not waive an explicit user or project evidence requirement/iu);
    // Core keeps the compact router: scope, briefs trigger, and skill pointer.
    expect(orchestrator).toMatch(/documentation sites and visible CLI output/iu);
    expect(orchestrator).toMatch(
      /include the evidence requirement in implementation and review briefs/iu,
    );
    expect(orchestrator).toMatch(/load the available `create-pull-request` skill/iu);
    // The capture/publication detail lives once in the root skill.
    expect(rootSkill).toMatch(/headless capture/iu);
    expect(rootSkill).toMatch(/terminal transcript/iu);
    expect(rootSkill).toMatch(/upload is unavailable.*preserve the local artifact/iu);
    expect(rootSkill).toMatch(/unnecessary with a concrete reason/iu);
    expect(rootSkill).toMatch(/explicit user or project.*requirement/iu);
    expect(builder).toMatch(/evidence artifacts and unresolved verification gaps/iu);
    expect(builder).not.toMatch(/tests or type checks to confirm correctness/iu);
  });

  it('keeps bounded repair, progress detection, and fail-loud stopping', () => {
    const rules = readDirective('rules.md');
    const iteration = readDirective('skills', 'iteration-limits.md');

    expect(rules).toMatch(
      /one independent review and.*only when blockers exist.*one repair\/re-review pass/iu,
    );
    expect(rules).toMatch(/named blocker remains unresolved|new material regression/iu);
    expect(iteration).toMatch(/no more than three repair\/re-review passes/iu);
    expect(iteration).toMatch(/`\[fix\]` means blocking\/material/iu);
    expect(iteration).toMatch(/final verification/iu);
    expect(iteration).toMatch(/and stop/iu);
    expect(rules).toMatch(/observable progress/iu);
    expect(rules).toMatch(/repeated causes.*no new evidence|no new evidence.*repeated causes/iu);
    expect(rules).toMatch(/do not loop silently/iu);
    expect(iteration).toMatch(/verifiable termination condition/iu);
    expect(iteration).toMatch(/change strategy or escalate/iu);
    expect(iteration).toMatch(/Tried X, Y, Z/u);
  });

  it('keeps approval boundaries narrow without weakening security floors', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(rules).toMatch(/security.*boundaries are mandatory stops/iu);
    expect(rules).toMatch(/ordinary in-scope security defects may be repaired autonomously/iu);
    expect(rules).toMatch(/routine delivery is autonomous/iu);
    expect(rules).toMatch(/without asking whether to perform those steps/iu);
    expect(rules).toMatch(/these are delivery mechanics, not approval checkpoints/iu);
    expect(orchestrator).toMatch(
      /do not ask whether to create or use a feature branch, commit, push, or create a PR/iu,
    );
  });

  it('states precedence, pause naming, and output economy', () => {
    const rules = readDirective('rules.md');

    expect(rules).toMatch(/safety and authorization floors first/iu);
    expect(rules).toMatch(/explicit user instructions/iu);
    expect(rules).toMatch(/project rules and skill methodology/iu);
    expect(rules).toMatch(/name the blocking skill or instruction/iu);
    expect(rules).toMatch(/evidence or input needed to continue/iu);
    expect(rules).toMatch(/concise plain-text findings with file and line references/iu);
    expect(rules).toMatch(/verification limits, delivery state, and blocker or next step/iu);
  });

  it('separates route choice from host execution authority', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(orchestrator).toContain('host runtime defines');
    expect(orchestrator).toContain('direct work is unavailable or disallowed');
    expect(orchestrator).toContain('direct work is available');
    expect(orchestrator).toMatch(/never bypass runtime role boundaries/iu);
    expect(orchestrator).toContain(
      'When an outer supervisor owns repository selection, scheduling, retries, or lifecycle, treat those as external inputs and do not duplicate that orchestration inside the route.',
    );
    for (const route of ['direct', 'focused', 'full']) {
      expect(orchestrator).toContain(`| \`${route}\` |`);
    }

    // Durable concepts, not prose inventory: both files, root-only order,
    // host-supplied reuse, normal absence, surfaced read errors, subordination.
    expect(orchestrator).toContain('.maestria/workflow.md');
    expect(orchestrator).toContain('.maestria/rules.md');
    expect(orchestrator.indexOf('.maestria/workflow.md')).toBeLessThan(
      orchestrator.indexOf('.maestria/rules.md'),
    );
    expect(orchestrator).toMatch(/root only/iu);
    expect(orchestrator).toMatch(/host has not already supplied/iu);
    expect(orchestrator).toMatch(/absence is normal/iu);
    expect(orchestrator).toMatch(/surfaced.*requested rather than silently overridden/iu);
    expect(orchestrator).toMatch(/subordinate guidance/iu);
    expect(orchestrator).toMatch(/global safety and host authorization/iu);

    // Runtime-specific enforcement belongs in adapters, not the portable core.
    expect(orchestrator).not.toMatch(
      /\b(?<platform>OpenCode|OMP|Kimi Code|Hermes|Cursor|Claude Code|Pi)\b/u,
    );
  });

  it('carries required documentation through briefs to reconciliation and blocks acceptance when missing', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(rules).toMatch(/carry them through briefs to final reconciliation/iu);
    expect(rules).toMatch(/part of acceptance/iu);
    expect(orchestrator).toMatch(
      /carry required documentation per the global documentation and changesets contract/iu,
    );
    expect(orchestrator).toMatch(/documentation[\s\S]*?changesets/iu);
  });

  it('keeps the documentation contract portable without unconditional mandates', () => {
    const rules = readDirective('rules.md');
    const section = rules.slice(rules.indexOf('### Documentation and changesets'));

    expect(section).not.toMatch(/apps\/docs|CHANGELOG\.mdx?|\.changeset\/|docs\//u);
    expect(rules).not.toMatch(
      /every change.*changeset|changeset.*every change|all packages.*changeset|changeset.*all packages/iu,
    );
    expect(rules).not.toMatch(/every change.*ADR|ADR.*every change|mandatory ADR/iu);
    expect(rules).not.toMatch(
      /update.*every category|every category.*update|all four.*must.*update/iu,
    );
  });
});

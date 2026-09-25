import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const DIRECTIVES_DIR = path.join(import.meta.dirname, '..', 'agent-directives');

const readDirective = (...segments: string[]): string =>
  readFileSync(path.join(DIRECTIVES_DIR, ...segments), 'utf-8');

const assertOrdered = (document: string, headings: string[]): void => {
  let previous = -1;
  for (const heading of headings) {
    const current = document.indexOf(heading);
    expect(current, `missing heading: ${heading}`).toBeGreaterThanOrEqual(0);
    expect(current, `${heading} is out of order`).toBeGreaterThan(previous);
    previous = current;
  }
};

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

  it('requires a mandatory human-facing output contract in the global rules', () => {
    const rules = readDirective('rules.md');

    expect(rules).toMatch(/!!![^\n]*(?:human[- ]facing|human[- ]readable|people|output)/iu);
    for (const scope of [
      /human[- ]facing (?:text|output)|text output/iu,
      /(?:agent )?responses?|status updates?|questions?/iu,
      /code (?:output|comments?|docstrings?)|comments?\s*[/&,]\s*docstrings?/iu,
      /commit messages?/iu,
      /PR\s+(?:titles?|descriptions?)/iu,
    ]) {
      expect(rules).toMatch(scope);
    }

    expect(rules).toMatch(/U\+2014/iu);
    expect(rules).toMatch(
      /(?:never|do not|avoid|prohibit|forbid)[\s\S]{0,120}(?:U\+2014|em dash)|(?:U\+2014|em dash)[\s\S]{0,120}(?:never|do not|avoid|prohibit|forbid)/iu,
    );
    expect(rules).toMatch(
      /(?:ASCII(?:[- ](?:only|alternative|punctuation))?|hyphen-minus)[\s\S]{0,160}(?:alternative|comma|colon|parenthes|instead|replace)|(?:comma|colon|parenthes)[\s\S]{0,160}(?:ASCII|hyphen-minus|instead|replace)/iu,
    );
    expect(rules).toMatch(
      /(?:preserve|leave intact|except|do not alter)[\s\S]{0,180}(?:code|syntax|literal|quoted|user[- ]provided)|(?:code|syntax|literal|quoted|user[- ]provided)[\s\S]{0,180}(?:preserve|leave intact|except|do not alter)/iu,
    );
  });

  it('covers delivery-facing text in every specialist directive', () => {
    const deliveryDirectives = [
      'adventurer',
      'architect',
      'builder',
      'diagnose',
      'orchestrator',
      'planner',
      'reviewer',
      'writer',
    ].map((role) => readDirective('specialists', `${role}.md`));

    for (const directive of deliveryDirectives) {
      expect(directive).toMatch(
        /(?:human[- ]facing|delivery[- ]facing)[\s\S]{0,240}(?:commit messages?|PR\s+(?:titles?|descriptions?))|(?:commit messages?|PR\s+(?:titles?|descriptions?))[\s\S]{0,240}(?:human[- ]facing|delivery[- ]facing)/iu,
      );
      expect(directive).toMatch(/U\+2014|EM DASH/iu);
    }
  });

  it('keeps mode semantics distinct without weakening universal floors', () => {
    const rules = readDirective('rules.md');
    const fein = readDirective('commands', 'fein.md');
    const sonar = readDirective('commands', 'sonar.md');
    const blitz = readDirective('commands', 'blitz.md');

    expect(rules).toMatch(/modes.*never\s+waive|modes.*cannot.*waive/iu);
    expect(fein).toMatch(/`full` route/iu);
    expect(fein).toMatch(/review/iu);
    expect(sonar).toMatch(/research-only|read-only/iu);
    expect(sonar).toMatch(/do not implement|no implementation/iu);
    expect(blitz).toMatch(/low-risk|optional.*ceremony/iu);
    expect(blitz).toMatch(/direct.*host permits|host permits.*direct/iu);
    expect(blitz).toMatch(/otherwise delegate.*specialist|otherwise.*permitted specialist/iu);
    expect(blitz).not.toMatch(/route code changes through.*builder|all code.*builder/iu);
    expect(blitz).toMatch(/safety.*authorization|authorization.*safety/iu);
    expect(blitz).toMatch(/review|branch/iu);
  });

  it('orders outcome, delegation, acceptance, repair, authorization, and source rules', () => {
    const rules = readDirective('rules.md');

    assertOrdered(rules, [
      '## Outcome and Scope',
      '## Delegation and Context',
      '## Acceptance and Blind Review',
      '## Bounded Repair and Fail-Loud Behavior',
      '## Authorization, Lifecycle, and Branches',
      '## Canonical Source Invariant',
    ]);

    expect(rules).toMatch(/primary user outcome/u);
    expect(rules).toMatch(/acceptance evidence/u);
    expect(rules).toMatch(/ordinary ambiguity/iu);
    expect(rules).toMatch(/out-of-scope/iu);
    expect(rules).toContain('follow-ups');
  });

  it('continues incomplete work and freezes scope across delegations', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const iteration = readDirective('skills', 'iteration-limits.md');

    expect(rules).toMatch(/orchestrator owns continuation for implementation and delivery work/iu);
    expect(rules).toMatch(/not a user checkpoint/iu);
    expect(rules).toMatch(
      /research-only, planning-only, explicitly read-only, and host-blocked work/iu,
    );
    expect(rules).toMatch(/empty, malformed, or incomplete.*recovery attempt/iu);
    expect(rules).toMatch(/freeze the outcome, acceptance criteria, non-goals/iu);
    expect(rules).toMatch(/do not reset a review or repair budget/iu);
    expect(orchestrator).toMatch(/parent session owns continuation until.*terminal artifact/iu);
    expect(orchestrator).toMatch(/freeze the outcome, acceptance, non-goals, and repair limits/iu);
    expect(iteration).toMatch(/same user outcome/iu);
    expect(iteration).toMatch(/adjacent findings as follow-ups/iu);
  });

  it('makes PR creation the normal implementation delivery step', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(rules).toMatch(/for implementation work, continue through validation/iu);
    expect(rules).toMatch(/complete commit, push, and PR creation without routine approval asks/iu);
    expect(rules).toMatch(/completion requires every planned slice/iu);
    expect(rules).toMatch(
      /research-only, planning-only, explicitly read-only, and host-blocked work/iu,
    );
    expect(orchestrator).toMatch(/for implementation work, own the delivery path/iu);
    expect(orchestrator).toMatch(
      /follow the global delivery contract through the complete PR set/iu,
    );
  });

  it('supports verified incremental commits and reviewable PR slices', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const planner = readDirective('specialists', 'planner.md');
    const prSkill = readFileSync(
      path.join(DIRECTIVES_DIR, '..', '..', '..', 'skills', 'create-pull-request', 'SKILL.md'),
      'utf-8',
    );

    expect(rules).toMatch(/commit coherent, verified slices at useful review or rollback points/iu);
    expect(rules).toMatch(/verify the final diff before delivery/iu);
    expect(rules).toMatch(
      /plan PR boundaries early around independently acceptable, verifiable changes/iu,
    );
    expect(rules).toMatch(
      /implementation reveals another such slice.*split the diff before PR delivery/iu,
    );
    expect(rules).toMatch(/stack only when a later slice depends on an earlier one/iu);
    expect(orchestrator).toMatch(
      /independently review each meaningful PR diff and their combined behavior/iu,
    );
    expect(planner).toMatch(/propose commit and PR boundaries with verification for each slice/iu);
    expect(prSkill).toMatch(/each PR's scope, acceptance evidence, base branch, prerequisites/iu);
  });

  it('shows architect or planner designs to the user before dependent implementation', () => {
    const architect = readDirective('specialists', 'architect.md');
    const planner = readDirective('specialists', 'planner.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(architect).toMatch(/include a concise design brief/iu);
    expect(planner).toMatch(/planning briefs state.*language the user can understand/iu);
    expect(orchestrator).toMatch(
      /present the proposed design or plan to the user before dependent edits/iu,
    );
    expect(orchestrator).toMatch(/continue under the existing authorization rules/iu);
  });

  it('uses material, outcome-oriented handoffs rather than a fixed schema', () => {
    const rules = readDirective('rules.md');
    const handoff = readDirective('skills', 'handoff.md');

    for (const concept of [
      /outcome/iu,
      /context and constraints/iu,
      /acceptance and evidence/iu,
      /assumptions or blockers/iu,
      /next step/iu,
    ]) {
      expect(handoff).toMatch(concept);
    }
    expect(rules).toMatch(/only the material needed to act/iu);
    expect(handoff).not.toMatch(/seven fields|write `none`|every handoff ends/iu);
    expect(rules).not.toMatch(/exact closing sentence|seven-field brief/iu);
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
    expect(rules).toMatch(/complete commit, push, and PR creation without routine approval asks/iu);
    expect(orchestrator).toMatch(/complete PR set without asking for routine approval/iu);
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

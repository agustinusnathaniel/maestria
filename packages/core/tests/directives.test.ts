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
    expect(rules).toMatch(/scripts\/sync-all/u);
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
    expect(orchestrator).toMatch(/freeze acceptance, non-goals, and repair limits/iu);
    expect(iteration).toMatch(/same user outcome/iu);
    expect(iteration).toMatch(/adjacent findings as follow-ups/iu);
  });

  it('makes PR creation the normal implementation delivery step', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(rules).toMatch(/for implementation work, continue through validation/iu);
    expect(rules).toMatch(/create a reviewable PR without ceremonial approval/iu);
    expect(rules).toMatch(
      /research-only, planning-only, explicitly read-only, and host-blocked work/iu,
    );
    expect(orchestrator).toMatch(/for implementation work, own the delivery path/iu);
    expect(orchestrator).toMatch(/without ceremonial approval/iu);
    expect(orchestrator).toMatch(
      /do not stop at a local diff, commit, pushed branch, or `PR pending`/iu,
    );
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

  it('separates route choice from host execution authority', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    assertOrdered(orchestrator, [
      '## Runtime Authority',
      '## Routing',
      '## Specialist Ownership',
      '## Role-Based Pipeline',
      '## Review and Triage',
      '## Workflow and Delegation',
      '## Mode Precedence',
      '## Commit and Session Flow',
    ]);

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

    // Runtime-specific enforcement belongs in adapters, not the portable core.
    expect(orchestrator).not.toMatch(
      /\b(?<platform>OpenCode|OMP|Kimi Code|Hermes|Cursor|Claude Code|Pi)\b/u,
    );
  });

  it('does not reintroduce the removed runtime ledger or checkpoint protocol', () => {
    const canonical = [
      readDirective('rules.md'),
      readDirective('specialists', 'orchestrator.md'),
      readDirective('COMPOSITION.md'),
      readDirective('skills', 'handoff.md'),
      readDirective('skills', 'iteration-limits.md'),
    ].join('\n');

    expect(canonical).not.toMatch(/work[- ]unit ledger|child[- ]dispatch budget/iu);
    expect(canonical).not.toMatch(/circuit breaker|terminal report|remaining budgets/iu);
    expect(canonical).not.toMatch(/material checkpoint sequence|result marker/iu);
    expect(canonical).not.toMatch(/none started|exact closing phrase|seven literal fields/iu);
    expect(canonical).not.toMatch(/zero dispatches|one initial dispatch|one recovery dispatch/iu);
  });

  it('retains role methodology without generic process boilerplate', () => {
    const roles: Record<string, string> = {
      adventurer: '## Mission',
      architect: '## Phase 1: Understand the Problem',
      builder: '## Scope',
      diagnose: '## Step 1: Error -> Source Location',
      planner: '## Plan Structure',
      reviewer: '## Principles',
      writer: '## Structure',
    };
    const genericBoilerplate =
      /Follow the universal Handoff Contract|universal bounded-autonomy|Platform tool restrictions|Max 3 .*universal/iu;

    for (const [role, heading] of Object.entries(roles)) {
      const directive = readDirective('specialists', `${role}.md`);
      expect(directive).toContain(heading);
      expect(directive).not.toMatch(genericBoilerplate);
    }
  });

  it('keeps structural judgment evidence-led and diagnostic persistence proportional', () => {
    const builder = readDirective('specialists', 'builder.md');
    const diagnose = readDirective('specialists', 'diagnose.md');
    const planner = readDirective('specialists', 'planner.md');

    expect(builder).toMatch(/keep seams local to the feature/iu);
    expect(builder).toMatch(/visible repetition.*callers become simpler/iu);
    expect(planner).toMatch(/enabling refactor.*explicit, separately verifiable phase/iu);
    expect(planner).toMatch(/acceptance evidence and rollback point/iu);
    expect(planner).not.toMatch(/don't refactor while adding features/iu);
    expect(diagnose).toMatch(/preserve durable diagnostic lessons/iu);
    expect(diagnose).toMatch(/create one only when.*durable future value/iu);
    expect(diagnose.match(/preserve durable diagnostic lessons/giu)).toHaveLength(1);
  });

  it('keeps composition guidance human-facing and cross-platform', () => {
    const composition = readDirective('COMPOSITION.md');

    expect(composition).toMatch(/Pipeline Composition/u);
    expect(composition).toMatch(/Maker\/Checker Split/u);
    expect(composition).toMatch(/High-Agency Execution/u);
    expect(composition).toMatch(/Canonical Sync/u);
    expect(composition).toContain('runtime');
    expect(composition).toContain('tools');
    expect(composition).not.toMatch(/finite.*budget|circuit breaker|recovery dispatch/iu);
  });
});

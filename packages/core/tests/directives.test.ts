import { describe, expect, it } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIRECTIVES_DIR = join(import.meta.dirname, '..', 'agent-directives');

function readDirective(...segments: string[]): string {
  return readFileSync(join(DIRECTIVES_DIR, ...segments), 'utf-8');
}

function assertOrdered(document: string, headings: string[]): void {
  let previous = -1;
  for (const heading of headings) {
    const current = document.indexOf(heading);
    expect(current, `missing heading: ${heading}`).toBeGreaterThanOrEqual(0);
    expect(current, `${heading} is out of order`).toBeGreaterThan(previous);
    previous = current;
  }
}

describe('canonical directive behavioral contracts', () => {
  it('preserves safety, authorization, acceptance, branch, and sync floors', () => {
    const rules = readDirective('rules.md');

    expect(rules).toMatch(/match effort to stakes/i);
    expect(rules).toMatch(/prefer reuse over reinvention/i);
    expect(rules).toMatch(/safety and authorization/i);
    expect(rules).toMatch(/security.*permission|permission.*security/i);
    expect(rules).toMatch(/observable evidence/i);
    expect(rules).toMatch(/protected-branch|protected branch/i);
    expect(rules).toMatch(/routine delivery is autonomous/i);
    expect(rules).toMatch(/stop and verify them before completion/i);
    expect(rules).toMatch(/maker\/checker/i);
    expect(rules).toMatch(/canonical source invariant/i);
    expect(rules).toMatch(/scripts\/sync-all/);
    expect(rules).toMatch(/sync check/i);
  });

  it('requires a mandatory human-facing output contract in the global rules', () => {
    const rules = readDirective('rules.md');

    expect(rules).toMatch(/!!![^\n]*(?:human[- ]facing|human[- ]readable|people|output)/i);
    for (const scope of [
      /human[- ]facing (?:text|output)|text output/i,
      /(?:agent )?responses?|status updates?|questions?/i,
      /code (?:output|comments?|docstrings?)|comments?\s*[/&,]\s*docstrings?/i,
      /commit messages?/i,
      /PR\s+(?:titles?|descriptions?)/i,
    ]) {
      expect(rules).toMatch(scope);
    }

    expect(rules).toMatch(/U\+2014/i);
    expect(rules).toMatch(
      /(?:never|do not|avoid|prohibit|forbid)[\s\S]{0,120}(?:U\+2014|em dash)|(?:U\+2014|em dash)[\s\S]{0,120}(?:never|do not|avoid|prohibit|forbid)/i,
    );
    expect(rules).toMatch(
      /(?:ASCII(?:[- ](?:only|alternative|punctuation))?|hyphen-minus)[\s\S]{0,160}(?:alternative|comma|colon|parenthes|instead|replace)|(?:comma|colon|parenthes)[\s\S]{0,160}(?:ASCII|hyphen-minus|instead|replace)/i,
    );
    expect(rules).toMatch(
      /(?:preserve|leave intact|except|do not alter)[\s\S]{0,180}(?:code|syntax|literal|quoted|user[- ]provided)|(?:code|syntax|literal|quoted|user[- ]provided)[\s\S]{0,180}(?:preserve|leave intact|except|do not alter)/i,
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
        /(?:human[- ]facing|delivery[- ]facing)[\s\S]{0,240}(?:commit messages?|PR\s+(?:titles?|descriptions?))|(?:commit messages?|PR\s+(?:titles?|descriptions?))[\s\S]{0,240}(?:human[- ]facing|delivery[- ]facing)/i,
      );
      expect(directive).toMatch(/U\+2014|EM DASH/i);
    }
  });

  it('keeps mode semantics distinct without weakening universal floors', () => {
    const rules = readDirective('rules.md');
    const fein = readDirective('commands', 'fein.md');
    const sonar = readDirective('commands', 'sonar.md');
    const blitz = readDirective('commands', 'blitz.md');

    expect(rules).toMatch(/modes.*never\s+waive|modes.*cannot.*waive/i);
    expect(fein).toMatch(/`full` route/i);
    expect(fein).toMatch(/review/i);
    expect(sonar).toMatch(/research-only|read-only/i);
    expect(sonar).toMatch(/do not implement|no implementation/i);
    expect(blitz).toMatch(/low-risk|optional.*ceremony/i);
    expect(blitz).toMatch(/direct.*host permits|host permits.*direct/i);
    expect(blitz).toMatch(/otherwise delegate.*specialist|otherwise.*permitted specialist/i);
    expect(blitz).not.toMatch(/route code changes through.*builder|all code.*builder/i);
    expect(blitz).toMatch(/safety.*authorization|authorization.*safety/i);
    expect(blitz).toMatch(/review|branch/i);
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

    expect(rules).toMatch(/primary user outcome/);
    expect(rules).toMatch(/acceptance evidence/);
    expect(rules).toMatch(/ordinary ambiguity/i);
    expect(rules).toMatch(/out-of-scope/i);
    expect(rules).toContain('follow-ups');
  });

  it('continues incomplete work and freezes scope across delegations', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const iteration = readDirective('skills', 'iteration-limits.md');

    expect(rules).toMatch(/orchestrator owns continuation for implementation and delivery work/i);
    expect(rules).toMatch(/not a user checkpoint/i);
    expect(rules).toMatch(
      /research-only, planning-only, explicitly read-only, and host-blocked work/i,
    );
    expect(rules).toMatch(/empty, malformed, or incomplete.*recovery attempt/i);
    expect(rules).toMatch(/freeze the outcome, acceptance criteria, non-goals/i);
    expect(rules).toMatch(/do not reset a review or repair budget/i);
    expect(orchestrator).toMatch(/parent session owns continuation until.*terminal artifact/i);
    expect(orchestrator).toMatch(/freeze acceptance, non-goals, and repair limits/i);
    expect(iteration).toMatch(/same user outcome/i);
    expect(iteration).toMatch(/adjacent findings as follow-ups/i);
  });

  it('makes PR creation the normal implementation delivery step', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(rules).toMatch(/for implementation work, continue through validation/i);
    expect(rules).toMatch(/create a reviewable PR without ceremonial approval/i);
    expect(rules).toMatch(
      /research-only, planning-only, explicitly read-only, and host-blocked work/i,
    );
    expect(orchestrator).toMatch(/for implementation work, own the delivery path/i);
    expect(orchestrator).toMatch(/without ceremonial approval/i);
    expect(orchestrator).toMatch(
      /do not stop at a local diff, commit, pushed branch, or `PR pending`/i,
    );
  });

  it('uses material, outcome-oriented handoffs rather than a fixed schema', () => {
    const rules = readDirective('rules.md');
    const handoff = readDirective('skills', 'handoff.md');

    for (const concept of [
      /outcome/i,
      /context and constraints/i,
      /acceptance and evidence/i,
      /assumptions or blockers/i,
      /next step/i,
    ]) {
      expect(handoff).toMatch(concept);
    }
    expect(rules).toMatch(/only the material needed to act/i);
    expect(handoff).not.toMatch(/seven fields|write `none`|every handoff ends/i);
    expect(rules).not.toMatch(/exact closing sentence|seven-field brief/i);
  });

  it('keeps maker/checker review blind and distinguishes blocking findings', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const reviewer = readDirective('specialists', 'reviewer.md');

    expect(rules).toMatch(/implementer must not approve its own work/i);
    expect(rules).toMatch(
      /requirements, acceptance criteria, relevant diff, and available validation or behavior evidence/i,
    );
    expect(rules).toMatch(/maker claims|maker-authored narrative/i);
    expect(rules).toContain('in-scope defects');
    expect(rules).toMatch(/repaired autonomously/i);
    expect(rules).toMatch(/out-of-scope/i);
    expect(rules).toContain('follow-ups');
    expect(orchestrator).toContain('[escalate]');
    expect(orchestrator).toMatch(/blocks completion only when/i);
    expect(orchestrator).toContain('acceptance, safety');
    expect(orchestrator).toContain('authorization');
    expect(reviewer).toMatch(/label `\[fix\]` only for a concrete blocker/i);
    expect(reviewer).toMatch(/after a repair, re-review only the repaired scope/i);
  });

  it('keeps bounded repair, progress detection, and fail-loud stopping', () => {
    const rules = readDirective('rules.md');
    const iteration = readDirective('skills', 'iteration-limits.md');

    expect(rules).toMatch(
      /one independent review and.*only when blockers exist.*one repair\/re-review pass/i,
    );
    expect(rules).toMatch(/named blocker remains unresolved|new material regression/i);
    expect(iteration).toMatch(/no more than three repair\/re-review passes/i);
    expect(iteration).toMatch(/`\[fix\]` means blocking\/material/i);
    expect(iteration).toMatch(/final verification/i);
    expect(iteration).toMatch(/and stop/i);
    expect(rules).toMatch(/observable progress/i);
    expect(rules).toMatch(/repeated causes.*no new evidence|no new evidence.*repeated causes/i);
    expect(rules).toMatch(/do not loop silently/i);
    expect(iteration).toMatch(/verifiable termination condition/i);
    expect(iteration).toMatch(/change strategy or escalate/i);
    expect(iteration).toMatch(/Tried X, Y, Z/);
  });

  it('keeps approval boundaries narrow without weakening security floors', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(rules).toMatch(/security.*boundaries are mandatory stops/i);
    expect(rules).toMatch(/ordinary in-scope security defects may be repaired autonomously/i);
    expect(rules).toMatch(/routine delivery is autonomous/i);
    expect(rules).toMatch(/without asking whether to perform those steps/i);
    expect(rules).toMatch(/these are delivery mechanics, not approval checkpoints/i);
    expect(orchestrator).toMatch(
      /do not ask whether to create or use a feature branch, commit, push, or create a PR/i,
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
    expect(orchestrator).toMatch(/never bypass runtime role boundaries/i);
    expect(orchestrator).toContain(
      'When an outer supervisor owns repository selection, scheduling, retries, or lifecycle, treat those as external inputs and do not duplicate that orchestration inside the route.',
    );
    for (const route of ['direct', 'focused', 'full']) {
      expect(orchestrator).toContain(`| \`${route}\` |`);
    }

    // Runtime-specific enforcement belongs in adapters, not the portable core.
    expect(orchestrator).not.toMatch(/\b(OpenCode|OMP|Kimi Code|Hermes|Cursor|Claude Code|Pi)\b/);
  });

  it('does not reintroduce the removed runtime ledger or checkpoint protocol', () => {
    const canonical = [
      readDirective('rules.md'),
      readDirective('specialists', 'orchestrator.md'),
      readDirective('COMPOSITION.md'),
      readDirective('skills', 'handoff.md'),
      readDirective('skills', 'iteration-limits.md'),
    ].join('\n');

    expect(canonical).not.toMatch(/work[- ]unit ledger|child[- ]dispatch budget/i);
    expect(canonical).not.toMatch(/circuit breaker|terminal report|remaining budgets/i);
    expect(canonical).not.toMatch(/material checkpoint sequence|result marker/i);
    expect(canonical).not.toMatch(/none started|exact closing phrase|seven literal fields/i);
    expect(canonical).not.toMatch(/zero dispatches|one initial dispatch|one recovery dispatch/i);
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
      /Follow the universal Handoff Contract|universal bounded-autonomy|Platform tool restrictions|Max 3 .*universal/i;

    for (const [role, heading] of Object.entries(roles)) {
      const directive = readDirective('specialists', `${role}.md`);
      expect(directive).toContain(heading);
      expect(directive).not.toMatch(genericBoilerplate);
    }
  });

  it('keeps composition guidance human-facing and cross-platform', () => {
    const composition = readDirective('COMPOSITION.md');

    expect(composition).toMatch(/Pipeline Composition/);
    expect(composition).toMatch(/Maker\/Checker Split/);
    expect(composition).toMatch(/High-Agency Execution/);
    expect(composition).toMatch(/Canonical Sync/);
    expect(composition).toContain('runtime');
    expect(composition).toContain('tools');
    expect(composition).not.toMatch(/finite.*budget|circuit breaker|recovery dispatch/i);
  });
});

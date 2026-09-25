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

  it('reconciles delivery with accepted requirements on every implementation route', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(orchestrator).toMatch(/independent reviewer.*every route, including direct/iu);
    expect(orchestrator).toMatch(/original request and accepted follow-ups/iu);
    // Glue-tolerant: the reconciliation list may render inline or as bullets;
    // pin the items in order plus the evidence qualifier, not the separators.
    expect(orchestrator).toMatch(
      /required artifacts[\s\S]*?repository checks[\s\S]*?review[\s\S]*?documentation[\s\S]*?changesets[\s\S]*?PR-body evidence with readback when visual evidence applies/iu,
    );
    expect(orchestrator).toMatch(/complete in-scope omissions within existing authorization/iu);
    expect(orchestrator).toMatch(/unmet requirements as incomplete or blocked/iu);
    expect(orchestrator).toMatch(/PR or reviewer approval alone does not establish completion/iu);
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

  it('keeps project workflow loading concise, root-only, and subordinate', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');

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

  it('keeps implementation and migration judgment evidence-led', () => {
    const builder = readDirective('specialists', 'builder.md');
    const diagnose = readDirective('specialists', 'diagnose.md');
    const planner = readDirective('specialists', 'planner.md');

    expect(builder).toMatch(/trust boundaries.*validate and normalize/iu);
    expect(builder).toMatch(/authoritative security enforcement/iu);
    expect(builder).toMatch(/keep seams local to the feature/iu);
    expect(builder).toMatch(/visible repetition.*callers become simpler/iu);
    expect(builder).toMatch(/shared interface.*trace every caller.*supported usage mode/iu);
    expect(builder).toMatch(/one executable source of truth or automated drift check/iu);
    expect(planner).toMatch(/enabling refactor.*explicit, separately verifiable phase/iu);
    expect(planner).toMatch(/acceptance evidence and rollback point/iu);
    expect(planner).toMatch(
      /migrations spanning many call sites or modules.*representative slice/iu,
    );
    expect(planner).toMatch(/compatibility shim.*removal condition/iu);
    expect(planner).not.toMatch(/don't refactor while adding features/iu);
    expect(diagnose).toMatch(/preserve durable diagnostic lessons/iu);
    expect(diagnose).toMatch(/create one only when.*durable future value/iu);
    expect(diagnose.match(/preserve durable diagnostic lessons/giu)).toHaveLength(1);
  });

  it('keeps assigned outcomes complete and diagnosis evidence-led', () => {
    const builder = readDirective('specialists', 'builder.md');
    const diagnose = readDirective('specialists', 'diagnose.md');

    expect(builder).toMatch(/identify ownership for the remaining work/iu);
    expect(builder).toMatch(/never present one selected slice as completion/iu);
    expect(diagnose).toMatch(/old line alone does not establish/iu);
    expect(diagnose).not.toMatch(/bug was always there|find ALL similar problems/iu);
    expect(diagnose).toMatch(/assignment and host permit repair/iu);
  });

  it('permits necessary coverage without automatic extra approval or skill loads', () => {
    const rules = readDirective('rules.md');
    const writer = readDirective('specialists', 'writer.md');
    const architect = readDirective('specialists', 'architect.md');

    expect(rules).toMatch(/without requiring another approval solely for the file/iu);
    expect(rules).toMatch(/consequential side effects.*applicable authorization/iu);
    expect(writer).not.toMatch(/Always:/u);
    expect(architect).not.toMatch(/Always:/u);
    expect(writer).toMatch(/retain useful examples, rationale, and caveats/iu);
  });

  it('keeps documentation current and operationally verifiable', () => {
    const writer = readDirective('specialists', 'writer.md');

    expect(writer).toMatch(/factual claims.*current code\/config/iu);
    expect(writer).toMatch(/operator-critical instructions.*runnable check/iu);
    expect(writer).toMatch(/expected success or failure signal/iu);
    expect(writer).toMatch(/verify the termination condition once before handoff/iu);
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

  it('routes PR title/body conventions to the methodology skill and keeps core floors', () => {
    const rules = readDirective('rules.md');
    const rootSkill = readFileSync(
      path.join(DIRECTIVES_DIR, '..', '..', '..', 'skills', 'create-pull-request', 'SKILL.md'),
      'utf-8',
    );

    // Core keeps the outcome/evidence/review/authorization floors plus the
    // router: project template precedence, opt-out stop, load-available
    // skill before drafting, absent fallback, and post-push refresh/readback.
    expect(rules).toMatch(/core owns the outcome, evidence, review, and authorization/iu);
    expect(rules).toMatch(/`create-pull-request` methodology skill/iu);
    expect(rules).toMatch(/load the available skill before drafting/iu);
    expect(rules).toMatch(/follow the project template when one applies/iu);
    expect(rules).toMatch(/stop on explicit project opt-out/iu);
    expect(rules).toMatch(/missing skill never blocks delivery/iu);
    expect(rules).toMatch(/read back the published body before reporting delivery complete/iu);
    // The literal procedure lives once in the root skill, not in core.
    expect(rules).not.toContain('## Summary');
    expect(rules).not.toMatch(/Work Results table/iu);
    // Exact pins for the true literal contract: the title form plus the
    // literal `##` headings in contract order with the Changes table columns.
    expect(rootSkill).toMatch(/explicit Conventional Commits title/iu);
    expect(rootSkill).toMatch(/do not infer it from commit message format/iu);
    assertOrdered(rootSkill, [
      '## Summary',
      '## Changes',
      '## Verification',
      '## Visual evidence',
      '## Breaking changes',
    ]);
    expect(rootSkill).toMatch(/\|\s*`?File`?\s*\|\s*What changed\s*\|\s*Why\s*\|/u);
    // Modal floor guard: the explicit-title qualifier must not weaken into inference.
    expect(rootSkill).not.toMatch(/title may be inferred/iu);
    // Standalone contract: the root skill works installed alone, so the
    // whole body must not require Maestria core roles, roster, adapters,
    // or generated paths, and availability stays with the caller.
    expect(rootSkill).not.toMatch(
      /core owns|core authorization|delivery owner|orchestrator|roster|runtime adapter|agent-directives|global-rules/iu,
    );
    expect(rootSkill).not.toMatch(/if this skill is absent|minimal fallback/iu);
  });

  it('carries visual classification through briefs and keeps capture, handoff, publication, and readback distinct', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const rootSkill = readFileSync(
      path.join(DIRECTIVES_DIR, '..', '..', '..', 'skills', 'create-pull-request', 'SKILL.md'),
      'utf-8',
    );

    // Classification at acceptance, carried into implementation and review briefs.
    expect(rules).toMatch(
      /classify visual evidence as required.*or not applicable with a concrete reason/iu,
    );
    // Core keeps the compact router: classification, briefs trigger, skill
    // pointer, and the missing-evidence floor.
    expect(orchestrator).toMatch(/or not applicable with a concrete reason/iu);
    expect(orchestrator).toMatch(
      /include the evidence requirement in implementation and review briefs/iu,
    );
    expect(orchestrator).toMatch(/load the available `create-pull-request` skill/iu);
    expect(orchestrator).toMatch(/missing required evidence blocks acceptance/iu);
    // The skill classifies first, then carries the full conditional
    // procedure inline in the same file.
    expect(rootSkill).toMatch(/not applicable.*concrete reason/iu);
    expect(rootSkill).not.toMatch(/references\/visual-evidence\.md/iu);
    // Handoff carries paths plus captions plus coverage gaps; the reviewer
    // checks that coverage against the changed surface.
    expect(rootSkill).toMatch(/paths plus captions plus coverage gaps/iu);
    expect(rootSkill).toMatch(/reviewer checks that coverage against the changed surface/iu);
    // Role split: a reviewer covers rendered coverage while the drafting
    // agent reads back the actual published body (procedure lives in the skill).
    expect(rootSkill).toMatch(/read back the published body/iu);
    expect(rootSkill).toMatch(/read back the actual PR body yourself/iu);
    // Distinct stages: a local path alone never satisfies PR-body publication.
    expect(rootSkill).toMatch(
      /capture, handoff, publication in the PR body, and readback are distinct stages/iu,
    );
    expect(rootSkill).toMatch(/a local path alone does not satisfy PR-body publication/iu);
    // Missing required evidence reports incomplete with the checked
    // limitation; the relation pin (not mere wording presence) is what must hold.
    expect(rules).toMatch(/missing required evidence blocks acceptance/iu);
    expect(rules).toMatch(/means incomplete, not completed-with-limits/iu);
    expect(rootSkill).toMatch(
      /do not report delivery as complete until the evidence is published in the PR body/iu,
    );
    // Modal floor guard: the publication requirement must not weaken into optionality.
    expect(rootSkill).not.toMatch(/may claim delivery complete/iu);
    expect(orchestrator).not.toMatch(/may claim delivery complete/iu);
    // Core no longer duplicates the detailed procedure.
    expect(orchestrator).not.toMatch(/headless capture/iu);
    expect(orchestrator).not.toMatch(/paths plus captions/iu);
  });

  it('refreshes PR evidence after pushes and later visual changes', () => {
    const rules = readDirective('rules.md');
    const rootSkill = readFileSync(
      path.join(DIRECTIVES_DIR, '..', '..', '..', 'skills', 'create-pull-request', 'SKILL.md'),
      'utf-8',
    );

    // Post-push cumulative update plus readback: the procedure lives in the
    // skill; core keeps the router refresh sentence.
    expect(rootSkill).toMatch(
      /after any push that changes the cumulative diff or verification evidence/iu,
    );
    expect(rootSkill).toMatch(
      /update the title and body to match, then read back the published body/iu,
    );
    expect(rules).toMatch(/after any push that changes diff or verification/iu);
    // Freshness: replace affected captures, drop obsolete references, and
    // refresh only affected evidence without rewriting history as current.
    expect(rootSkill).toMatch(
      /when a later change affects captured appearance or behavior, replace affected captures/iu,
    );
    expect(rootSkill).toMatch(/remove obsolete or redundant PR body references/iu);
    expect(rootSkill).toMatch(/refresh only affected content, not every commit/iu);
    expect(rootSkill).toMatch(
      /refresh only affected evidence, not every commit or unrelated file/iu,
    );
    expect(rootSkill).toMatch(/keep intentional clearly labeled before baselines/iu);
    expect(rootSkill).toMatch(/never present a historical before as current/iu);
  });

  it('routes the doc-impact procedure to the standalone docs-update skill', () => {
    const rules = readDirective('rules.md');
    const rootSkill = readFileSync(
      path.join(DIRECTIVES_DIR, '..', '..', '..', 'skills', 'docs-update', 'SKILL.md'),
      'utf-8',
    );

    // Core keeps the obligation plus the router: acceptance, briefs carry,
    // load-available pointer, and the missing-skill fallback.
    expect(rules).toMatch(/required affected docs are part of acceptance/iu);
    expect(rules).toMatch(/carry them through briefs to final reconciliation/iu);
    expect(rules).toMatch(/`docs-update` methodology skill/iu);
    expect(rules).toMatch(/missing skill never blocks ordinary docs work/iu);
    // The four-category procedure lives once in the root skill, not in core.
    expect(rules).not.toMatch(/internal docs, user-facing docs/iu);
    expect(rootSkill).toMatch(
      /internal docs, user-facing docs, changelog or release notes, and required changesets/iu,
    );
    assertOrdered(rootSkill, [
      'Scope the change',
      'Assess each category separately',
      'Edit only affected sources',
      'Verify claims',
      'Summarize',
    ]);
    // Standalone contract: no core roles, roster, adapters, or self-absence fallback.
    expect(rootSkill).not.toMatch(
      /delivery owner|orchestrator|roster|runtime adapter|agent-directives|writer agent/iu,
    );
    expect(rootSkill).not.toMatch(/if this skill is absent|missing skill never blocks/iu);
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

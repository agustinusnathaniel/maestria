import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { extractSection } from '@/lib/transforms.js';

const DIRECTIVES_DIR = path.join(import.meta.dirname, '..', 'agent-directives');

const readDirective = (...segments: string[]): string =>
  readFileSync(path.join(DIRECTIVES_DIR, ...segments), 'utf-8');

const readSkill = (name: string): string => readDirective('skills', name, 'SKILL.md');

const countWords = (text: string): number => text.split(/\s+/u).filter(Boolean).length;

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
  it('keeps always-on directives within their word budgets', () => {
    expect(countWords(readDirective('rules.md'))).toBeLessThanOrEqual(1250);
    expect(countWords(readDirective('specialists', 'main-loop.md'))).toBeLessThanOrEqual(925);
  });

  it('preserves safety, authorization, acceptance, branch, and sync floors', () => {
    const rules = readDirective('rules.md');

    expect(rules).toMatch(/match effort to stakes/iu);
    expect(rules).toMatch(/negative result counts only from a source that could have shown/iu);
    expect(rules).toMatch(/never email or name/iu);
    expect(readSkill('implement')).toMatch(/prefer reuse over reinvention/iu);
    expect(rules).toMatch(/safety and authorization/iu);
    expect(rules).toMatch(/security.*permission|permission.*security/iu);
    expect(rules).toMatch(/observable evidence/iu);
    expect(rules).toMatch(/protected-branch|protected branch/iu);
    expect(rules).toMatch(/commit only on a non-protected feature branch/iu);
    expect(rules).toMatch(/create a feature branch from it before your first commit/iu);
    expect(rules).toMatch(/stop and verify them before completion/iu);
    expect(rules).toMatch(/maker\/checker/iu);
    expect(rules).toMatch(/canonical source invariant/iu);
    expect(rules).toMatch(/project's authoritative source/iu);
    expect(rules).not.toContain('packages/core/agent-directives/');
    expect(rules).toMatch(/never hand-edit generated outputs/iu);
  });

  it('keeps mode semantics distinct without weakening universal floors', () => {
    const rules = readDirective('rules.md');
    const fein = readDirective('commands', 'fein.md');
    const sonar = readDirective('commands', 'sonar.md');
    const blitz = readDirective('commands', 'blitz.md');

    expect(rules).toMatch(/modes.*never\s+waive|modes.*cannot.*waive/iu);
    expect(fein).toMatch(/full method/iu);
    expect(fein).toMatch(/recon.*architecture-plan/iu);
    expect(fein).toMatch(/main loop/iu);
    expect(fein).toMatch(/review/iu);
    expect(sonar).toMatch(/research-only|read-only/iu);
    expect(sonar).toMatch(/change no files and dispatch no subagents/iu);
    expect(sonar).toMatch(/do not implement/iu);
    expect(blitz).toMatch(/low-risk|optional.*ceremony/iu);
    expect(blitz).toMatch(/main loop/iu);
    expect(blitz).toMatch(/otherwise report the host limit/iu);
    expect(blitz).not.toMatch(/permitted specialist/iu);
    expect(blitz).toMatch(/recon.*architecture-plan/iu);
    expect(blitz).toMatch(/safety.*authorization|authorization.*safety/iu);
    expect(blitz).toMatch(/review|branch/iu);
  });

  it('orders the rules into every-agent, implementation, writing, and main-session parts', () => {
    const rules = readDirective('rules.md');

    assertOrdered(rules, [
      '# Every Agent',
      '## Universal Floors',
      '## Scope',
      '## Authorization Stops',
      '# Implementation and Review',
      '## Acceptance and Blind Review',
      '# Writing Changes',
      '## Branches, Commits, and Hooks',
      '## Canonical Source Invariant',
      '## Fail-Loud Repair',
      '# Main Session',
      '## Outcome',
      '## Delegation and Context',
      '## Precedence and Shipping',
    ]);

    expect(rules).toMatch(/primary user outcome/u);
    expect(rules).toMatch(/acceptance evidence/u);
    expect(rules).toMatch(/ordinary ambiguity/iu);
    expect(rules).toMatch(/out-of-scope/iu);
    expect(rules).toContain('follow-ups');
  });

  it('keeps delivery-owner policy out of the rules every specialist embeds', () => {
    const rules = readDirective('rules.md');
    const mainLoop = readDirective('specialists', 'main-loop.md');

    expect(rules).not.toMatch(/^## Modes$/mu);
    expect(rules).not.toMatch(/routine delivery is autonomous|without routine approval asks/iu);
    expect(rules).not.toMatch(/plan PR boundaries early/iu);
    expect(mainLoop).not.toMatch(/plan PR boundaries early/iu);
    expect(mainLoop).toMatch(/^## Modes$/mu);
  });

  it('continues incomplete work and freezes scope across delegations', () => {
    const rules = readDirective('rules.md');
    const mainLoop = readDirective('specialists', 'main-loop.md');
    const iteration = readSkill('review-loop');

    expect(mainLoop).toMatch(/routine delivery is autonomous/iu);
    expect(rules).toMatch(
      /research-only, planning-only, explicitly read-only, and host-blocked work/iu,
    );
    expect(readSkill('handoff')).toMatch(/empty, malformed, or incomplete.*recovery attempt/iu);
    expect(rules).toMatch(/freeze the outcome, acceptance criteria, non-goals/iu);
    expect(mainLoop).toMatch(/at most three repair passes per outcome, never reset/iu);
    expect(iteration).toMatch(/do not reset a review or repair budget/iu);
    expect(mainLoop).toMatch(/you own continuation and the delivery path/iu);
    expect(mainLoop).toMatch(/incomplete todos.*are not user checkpoints/iu);
    expect(iteration).toMatch(/same user outcome/iu);
    expect(iteration).toMatch(/adjacent findings become follow-ups/iu);
  });

  it('makes PR creation the normal implementation delivery step', () => {
    const rules = readDirective('rules.md');
    const mainLoop = readDirective('specialists', 'main-loop.md');

    expect(mainLoop).toMatch(/continue through validation, review, and delivery/iu);
    expect(mainLoop).toMatch(
      /complete commit, push, and PR creation without routine approval asks/iu,
    );
    expect(mainLoop).toMatch(/completion requires every planned slice/iu);
    expect(rules).toMatch(
      /research-only, planning-only, explicitly read-only, and host-blocked work/iu,
    );
    expect(mainLoop).toMatch(
      /for implementation work, you own continuation and the delivery path/iu,
    );
  });

  it('supports verified incremental commits and reviewable PR slices', () => {
    const rules = readDirective('rules.md');
    const mainLoop = readDirective('specialists', 'main-loop.md');
    const prSkill = readSkill('create-pull-request');

    expect(rules).toMatch(/commit coherent, verified slices at useful review or rollback points/iu);
    expect(rules).toMatch(/verify the final diff before delivery/iu);
    expect(prSkill).toMatch(
      /plan PR boundaries early around independently acceptable, verifiable changes/iu,
    );
    expect(prSkill).toMatch(
      /implementation reveals another such slice.*split the diff before PR delivery/iu,
    );
    expect(prSkill).toMatch(/stack only when a later slice depends on an earlier one/iu);
    expect(mainLoop).toMatch(/`create-pull-request`: when planning PR boundaries/iu);
    expect(mainLoop).toMatch(
      /independently review each meaningful PR diff and their combined behavior/iu,
    );
    expect(prSkill).toMatch(/each PR's scope, acceptance evidence, base branch, prerequisites/iu);
  });

  it('shows architecture-plan designs to the user before dependent implementation', () => {
    const plan = readSkill('architecture-plan');

    expect(plan).toMatch(/present it\*\* to the user before dependent edits/iu);
    expect(plan).toMatch(/continue under the existing authorization rules/iu);
  });

  it('maps every method skill the main loop routes to, one line each', () => {
    const routing = extractSection(readDirective('specialists', 'main-loop.md'), 'Routing') ?? '';

    for (const [skill, trigger] of [
      ['recon', /before changing code you have not read/iu],
      ['architecture-plan', /trade-offs/iu],
      ['diagnose', /bug, regression, failure, or crash/iu],
      ['implement', /before writing or changing code or tests/iu],
      ['docs-update', /before finishing a change to behavior/iu],
      ['create-pull-request', /drafting, publishing, or refreshing a PR/iu],
      ['review-loop', /sending a change to review/iu],
      ['handoff', /before briefing another agent or session/iu],
    ] as const) {
      const line = routing.split('\n').find((entry) => entry.startsWith(`- \`${skill}\`:`));
      expect(line, `missing skill map line: ${skill}`).toBeDefined();
      expect(line).toMatch(trigger);
      expect(readSkill(skill)).toMatch(new RegExp(`^name: ${skill}$`, 'mu'));
    }
    expect(routing).toMatch(/missing skill never blocks the work or waives/iu);
  });

  it('uses material, outcome-oriented handoffs rather than a fixed schema', () => {
    const handoff = readSkill('handoff');

    for (const concept of [
      /outcome/iu,
      /constraints/iu,
      /acceptance criteria and evidence/iu,
      /assumptions/iu,
      /next step/iu,
    ]) {
      expect(handoff).toMatch(concept);
    }
    expect(readDirective('rules.md')).toMatch(
      /before handoff or compaction, preserve the outcome[^.]*blockers[^.]*next step/iu,
    );
    expect(handoff).toMatch(/only the material needed to act/iu);
    expect(handoff).toMatch(/one recovery attempt with a changed brief/iu);
    expect(handoff).toMatch(/keep a tracker that closes each task with its evidence/iu);
    expect(handoff).not.toMatch(/seven fields|write `none`|every handoff ends|seven-field brief/iu);
  });

  it('keeps maker/checker review blind and distinguishes blocking findings', () => {
    const rules = readDirective('rules.md');
    const mainLoop = readDirective('specialists', 'main-loop.md');
    const reviewer = readDirective('specialists', 'reviewer.md');
    const reviewLoop = readSkill('review-loop');

    expect(rules).toMatch(/implementer must not approve its own work/iu);
    expect(rules).toMatch(
      /requirements, acceptance criteria, relevant diff, and available validation or behavior evidence/iu,
    );
    expect(rules).toMatch(/maker claims|maker-authored narrative/iu);
    expect(rules).toContain('in-scope defects');
    expect(rules).toMatch(/repaired autonomously/iu);
    expect(reviewLoop).toContain('[escalate]');
    expect(reviewLoop).toMatch(/blocks completion only when/iu);
    expect(reviewLoop).toContain('acceptance, safety');
    expect(reviewLoop).toMatch(/never your own assessment of it/iu);
    expect(mainLoop).toMatch(/empty or blocked review is not approval/iu);
    expect(mainLoop).toMatch(/never concurrent reviews/iu);
    expect(rules).toMatch(/label `\[fix\]` only for a concrete blocker/iu);
    expect(reviewer).toMatch(/global Acceptance and Blind Review contract/iu);
    expect(reviewer).toMatch(/after a repair, re-review only the repaired scope/iu);
    expect(reviewer).toMatch(/happening, real but unobserved, edge case/iu);
    expect(reviewer).toMatch(/fix now, fix when touching, ask first/iu);
  });

  it('keeps rendered evidence distinct from builds and attachment support', () => {
    const rules = readDirective('rules.md');
    const prSkill = readSkill('create-pull-request');

    expect(rules).toMatch(/rendered appearance and interactions need rendered checks/iu);
    expect(rules).toMatch(/do not waive an explicit user or project evidence requirement/iu);
    // Outcome decides at the start whether a rendered change needs visual evidence.
    expect(rules).toMatch(/whether a rendered change needs visual evidence, or why not/iu);
    // The capture/publication detail lives once in the root skill.
    expect(prSkill).toMatch(/headless capture/iu);
    expect(prSkill).toMatch(/terminal transcript/iu);
    expect(prSkill).toMatch(/upload is unavailable.*preserve the local artifact/iu);
    expect(prSkill).toMatch(/unnecessary with a concrete reason/iu);
  });

  it('keeps bounded repair, progress detection, and fail-loud stopping', () => {
    const rules = readDirective('rules.md');
    const iteration = readSkill('review-loop');

    expect(iteration).toMatch(
      /one independent review and.*only when blockers exist.*one repair\/re-review pass/iu,
    );
    expect(iteration).toMatch(/named blocker remains unresolved|new material regression/iu);
    expect(iteration).toMatch(/no more than three repair\/re-review passes/iu);
    expect(iteration).toMatch(/only `\[fix\]` blockers are repair work/iu);
    expect(iteration).toMatch(/final verification/iu);
    expect(iteration).toMatch(/and stop/iu);
    expect(rules).toMatch(/observable progress/iu);
    expect(rules).toMatch(/repeated causes.*no new evidence|no new evidence.*repeated causes/iu);
    expect(rules).toMatch(/do not loop silently/iu);
    expect(iteration).toMatch(/verifiable termination condition/iu);
    expect(rules).toMatch(/change strategy \(load `diagnose` for root-cause uncertainty/iu);
    expect(rules).toMatch(/Tried X, Y, Z/u);
  });

  it('keeps approval boundaries narrow without weakening security floors', () => {
    const rules = readDirective('rules.md');
    const mainLoop = readDirective('specialists', 'main-loop.md');

    expect(rules).toMatch(/security.*boundaries are mandatory stops/iu);
    expect(rules).toMatch(/ordinary in-scope security defects may be repaired autonomously/iu);
    expect(mainLoop).toMatch(/without routine approval asks/iu);
  });

  it('states precedence, pause naming, and milestone reporting', () => {
    const rules = readDirective('rules.md');
    const mainLoop = readDirective('specialists', 'main-loop.md');

    expect(rules).toMatch(/safety and authorization floors first/iu);
    expect(rules).toMatch(/explicit user instructions/iu);
    expect(rules).toMatch(/project rules and skill methodology/iu);
    expect(rules).toMatch(/name the blocking skill or instruction/iu);
    expect(rules).toMatch(/evidence or input needed to continue/iu);
    expect(mainLoop).toMatch(/verification limits, delivery state, and blocker or next step/iu);
  });

  it('separates split choice from host execution authority', () => {
    const mainLoop = readDirective('specialists', 'main-loop.md');

    // Canonical owner of the section heading. Platform suites asserted
    // 'Runtime Authority' against their own projections, which drift with the
    // canonical text and leave the heading itself unasserted if the canonical
    // test omits it.
    expect(mainLoop).toContain('Runtime Authority');
    expect(mainLoop).toMatch(/host decides what this session may do/iu);
    expect(mainLoop).toMatch(/report the limit and the step it blocks/iu);
    expect(mainLoop).toMatch(/never route around it/iu);
    expect(mainLoop).toMatch(/redo delegated work/iu);
    expect(mainLoop).not.toMatch(/delegate it to the permitted specialist/iu);
    expect(mainLoop).toMatch(/do recon, design, diagnosis, and implementation in this session/iu);
    expect(mainLoop).toMatch(/only split into another context/iu);
    expect(mainLoop).toMatch(/one blind `@reviewer` pass/iu);

    // Durable concepts, not prose inventory: both files, root-only order,
    // host-supplied reuse, normal absence, surfaced read errors, subordination.
    expect(mainLoop).toContain('.maestria/workflow.md');
    expect(mainLoop).toContain('.maestria/rules.md');
    expect(mainLoop.indexOf('.maestria/workflow.md')).toBeLessThan(
      mainLoop.indexOf('.maestria/rules.md'),
    );
    expect(mainLoop).toMatch(/root only/iu);
    expect(mainLoop).toMatch(/host has not already supplied/iu);
    expect(mainLoop).toMatch(/absence is normal/iu);
    expect(mainLoop).toMatch(/surfaced.*requested rather than silently overridden/iu);
    expect(mainLoop).toMatch(/subordinate guidance/iu);
    expect(mainLoop).toMatch(/global safety and host authorization/iu);

    // Runtime-specific enforcement belongs in adapters, not the portable core.
    expect(mainLoop).not.toMatch(
      /\b(?<platform>OpenCode|OMP|Kimi Code|Hermes|Cursor|Claude Code|Pi)\b/u,
    );
    // Canonical owner of the negated "pure dispatcher" guard: pi, omp, and
    // claude-code asserted this against their own projections, which drifts as
    // soon as the canonical directive says something different.
    expect(mainLoop).not.toMatch(/pure dispatcher|Never implement routed code changes yourself/iu);
  });

  it('carries required documentation through briefs to reconciliation and blocks acceptance when missing', () => {
    const rules = readDirective('rules.md');
    const mainLoop = readDirective('specialists', 'main-loop.md');

    expect(rules).toMatch(/acceptance evidence \(including affected docs and release notes/iu);
    expect(mainLoop).toMatch(/documentation[\s\S]*?changesets where the repository uses them/iu);
  });

  it('keeps the documentation contract portable without unconditional mandates', () => {
    const rules = readDirective('rules.md');

    expect(rules).not.toMatch(/apps\/docs|CHANGELOG\.mdx?|\.changeset\/|docs\//u);
    expect(rules).not.toMatch(
      /every change.*changeset|changeset.*every change|all packages.*changeset|changeset.*all packages/iu,
    );
    expect(rules).not.toMatch(/every change.*ADR|ADR.*every change|mandatory ADR/iu);
    expect(rules).not.toMatch(
      /update.*every category|every category.*update|all four.*must.*update/iu,
    );
  });
});

describe('OpenCode main-loop directives', () => {
  const shared = readDirective('specialists', 'main-loop.md');
  const loop = readDirective('specialists', 'main-loop.md');
  const modes = ['fein', 'sonar', 'blitz'].map((mode) => readDirective('commands', `${mode}.md`));

  it('does the work in the main loop with method skills and one blind reviewer', () => {
    for (const skill of ['recon', 'architecture-plan', 'diagnose', 'implement', 'review-loop']) {
      expect(loop).toContain(`\`${skill}\``);
    }
    expect(loop).toMatch(/one blind `@reviewer` pass/iu);
    expect(loop).not.toMatch(/thinker -> worker|focused or full route/iu);
    for (const mode of modes) {
      expect(mode).not.toMatch(
        /use only read-only `@adventurer`|thinker -> worker|focused or full route/iu,
      );
    }
    expect(modes[1]).toMatch(/change no files and dispatch no subagents/iu);
  });

  it('keeps every shared contract outside routing and specialist ownership', () => {
    for (const heading of [
      'Runtime Authority',
      'Modes',
      'Review and Triage',
      'Continuation and Delivery',
      'Reporting to the User',
    ]) {
      expect(loop).toContain(heading);
    }
    for (const section of ['Reporting to the User']) {
      expect(extractSection(loop, section)).toBe(extractSection(shared, section));
    }
    expect(loop).toMatch(/routine delivery is autonomous/iu);
    for (const clause of [
      'Meaningful work means behavior changes, public interfaces or configuration, multiple production files, or data, auth, or security impact',
      'Security, authentication, permissions, data migration or loss, production impact, irreversible changes, and unresolved safety ambiguity override `blitz`',
      'Completion requires every planned slice to have reviewed changes on a pushed branch and an open PR with its acceptance evidence.',
      'Before final verification, reconcile the original request and accepted follow-ups against the delivered result',
    ]) {
      expect(loop).toContain(clause);
    }
    expect(extractSection(loop, 'Modes')).toMatch(/override `blitz`/u);
    expect(readSkill('review-loop')).toContain(
      'Boundary-changing or safety findings stop for authorization',
    );
    expect(loop).toMatch(/rejects an approach twice, stop and re-evaluate/iu);
  });
});

import { describe, expect, it } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIRECTIVES_DIR = join(import.meta.dirname, '..', 'agent-directives');

function readDirective(...segments: string[]): string {
  return readFileSync(join(DIRECTIVES_DIR, ...segments), 'utf-8');
}

describe('canonical directive contracts', () => {
  it('allows direct builder delegation while preserving full-route review safeguards', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(orchestrator).toContain(
      'Direct `@builder` delegation is allowed for concrete atomic work with no identified uncertainty.',
    );
    expect(orchestrator).toContain(
      'Add prerequisite specialists only for identified investigation, decision, or diagnosis needs.',
    );
    expect(orchestrator).not.toContain(
      'touch code only after recon, design, planning, diagnosis, or review are complete',
    );
    expect(orchestrator).toContain(
      'In `focused` routes, run one independent `@reviewer` pass for non-trivial `@builder` work.',
    );
    expect(orchestrator).toContain(
      'In `full` routes, after every `@builder` task, run the review loop automatically.',
    );
    expect(orchestrator).toContain('Max 3 cycles');
    expect(orchestrator).toContain('FAIL LOUD');
    expect(orchestrator).toContain('the reviewer reviews against the acceptance criteria');
  });

  it('defines deterministic route triggers and focused review thresholds', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const complexityStart = orchestrator.indexOf('### Complexity Classification');
    const pipelineStart = orchestrator.indexOf('## Role-Based Pipeline');
    const complexity = orchestrator.slice(complexityStart, pipelineStart);

    expect(orchestrator).toContain('Pick the first applicable route below');
    expect(orchestrator).toContain(
      "| `full` | Explicit `fein`; two or more primary specialist outputs (the focused route's mandatory independent reviewer pass does not count); cross-package or cross-cutting work; complex or high-risk work; unclear requirements that need design plus implementation |",
    );
    expect(orchestrator).toContain(
      '| `focused` | One targeted specialist owns the required output, including one bounded implementation or investigation |',
    );
    expect(orchestrator).toContain(
      '| `direct` | Explanation, discovery without codebase work, or a tiny familiar low-risk change with no specialist output |',
    );
    expect(orchestrator).toContain(
      'changes behavior, changes a public interface or configuration, touches multiple production files, or involves data, auth, or security',
    );
    expect(orchestrator).toContain(
      'Docs-only changes, formatting or comments, test fixtures, and one-file mechanical non-behavioral edits do not automatically require review.',
    );
    expect(orchestrator).toContain('If the classification remains uncertain, review.');
    expect(orchestrator).toContain('Safety exceptions override `direct` and `blitz`');
    expect(complexity).toContain('describe the level of uncertainty and interaction');
    expect(complexity).toContain(
      'do not choose a route or override the Selective Routing trigger table above',
    );
    expect(complexity).not.toContain('Default route');
    expect(complexity).not.toMatch(/`(?:direct|focused|full)`/);
    expect(orchestrator).toContain('One targeted specialist owns the required output');
    expect(orchestrator).toContain(
      'one independent `@reviewer` pass for non-trivial `@builder` work',
    );
  });

  it('bounds full review to a general reviewer and matching risk lenses', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const reviewer = readDirective('specialists', 'reviewer.md');

    expect(orchestrator).toContain('dispatch one independent general `@reviewer`');
    expect(orchestrator).toContain('only when the requirements or diff show a matching risk');
    expect(orchestrator).toContain('Do not dispatch unrelated specialist lenses');
    expect(orchestrator).not.toContain('3-5 parallel lenses');
    expect(orchestrator).toContain('Max 3 cycles');
    expect(orchestrator).toContain('FAIL LOUD');
    expect(reviewer).toContain('The general reviewer must give a verdict for every category.');
    expect(reviewer).toContain(
      'A specialized lens gives verdicts only for its assigned scope plus directly relevant functional correctness, edge cases, and assumptions',
    );
    expect(reviewer).not.toContain(
      'relevant functional correctness, edge cases, assumptions, style, and test implications',
    );
    expect(reviewer).toContain('they do not issue verdicts for unrelated categories');
  });

  it('keeps the seven handoff fields concise and assumptions-first', () => {
    const handoff = readDirective('skills', 'handoff.md');
    const fields = [
      '**Goal**',
      '**Context**',
      '**Requirements**',
      '**Known problems**',
      '**Assumptions documented**',
      '**Success criteria**',
      '**Next step**',
    ];

    for (const field of fields) {
      expect(handoff).toContain(field);
    }

    expect(handoff).toContain('Keep values concise');
    expect(handoff).toContain('reference paths, outputs, and prior decisions');
    expect(handoff).toContain('Include material information only');
    expect(handoff).toContain('write `none` where a field does not apply');
    expect(handoff).toContain('exhaust available data, document the assumption, and proceed');
    expect(handoff).not.toContain('ask before proceeding');
  });

  it('scopes workflow context, skills, session choreography, and sonar fan-out', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const sonar = readDirective('commands', 'sonar.md');

    expect(orchestrator).toContain('once per session when not already present');
    expect(orchestrator).toContain('never add `@adventurer` solely for a direct turn');
    expect(orchestrator).toContain(
      'Name the role-prescribed and task-relevant skills in the brief',
    );
    expect(orchestrator).toContain(
      'Do not add a separate skill-management step unless the task itself calls for it.',
    );
    expect(orchestrator).not.toContain('`humanizer` always');
    expect(orchestrator).not.toContain('Proactive path (before every delegation)');
    expect(orchestrator).toContain('During active multi-step routed work');
    expect(orchestrator).toContain('without a next-step prompt or invitation for more work');

    expect(sonar).toContain('Start with the specialist that owns the research question.');
    expect(sonar).toContain(
      'Add a second specialist only for a distinct unresolved required output.',
    );
    expect(sonar).toContain('Do NOT implement, write code, or create any production files.');
  });

  it('limits routed progress updates to material checkpoint events', () => {
    const orchestrator = readDirective('specialists', 'orchestrator.md');
    const sessionFlowStart = orchestrator.indexOf('## Session Flow');
    const skillsStart = orchestrator.indexOf('## Skills for Subagents');
    const sessionFlow = orchestrator.slice(sessionFlowStart, skillsStart);

    expect(sessionFlow).toContain(
      'Use only these material checkpoint events for progress updates: route selected; delegation completed, blocked, or failed; verification result; review verdict; commit, push, or PR result.',
    );
    expect(sessionFlow).toContain(
      'Routine reads, searches, and tool calls that do not change the plan do not require a checkpoint or user-facing update.',
    );
    expect(sessionFlow).toContain(
      'Simple and direct turns report the outcome without a next-step prompt or invitation for more work.',
    );
  });

  it('keeps architecture evidence scoped and commit wording separated', () => {
    const architect = readDirective('specialists', 'architect.md');
    const planner = readDirective('specialists', 'planner.md');
    const composition = readDirective('COMPOSITION.md');

    expect(architect).toContain('gather enough evidence to distinguish the viable options');
    expect(architect).toContain('Consult each source category only where relevant');
    expect(architect).toContain('**!!! Read the docs first**');
    expect(architect).not.toContain('exhaust all available evidence');
    expect(planner).not.toContain('Commit with conventional commits');
    expect(composition).toContain('under the separate commit protocol');
  });

  it('preserves hard rules and platform caveats in canonical directives', () => {
    const rules = readDirective('rules.md');
    const orchestrator = readDirective('specialists', 'orchestrator.md');

    expect(rules).toContain("**!!! Don't assume**");
    expect(rules).toContain('**!!! Read the docs first**');
    expect(rules).toContain('**!!! Never leak internal context into public output**');
    expect(rules).toContain("**!!! Never delete what you didn't create**");
    expect(rules).toContain('**!!! Maker/checker split**');
    expect(rules).toContain('Handoffs assume nothing about the platform');
    expect(orchestrator).toContain(
      'platform capabilities determine what is guaranteed versus advisory',
    );
    expect(orchestrator).toContain(
      'the split is advisory - state the limitation, do not claim enforcement',
    );
  });
});

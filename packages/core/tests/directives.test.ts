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
      'In `focused` routes, run one `@reviewer` pass for non-trivial `@builder` work.',
    );
    expect(orchestrator).toContain(
      'In `full` routes, after every `@builder` task, run the review loop automatically.',
    );
    expect(orchestrator).toContain('Max 3 cycles');
    expect(orchestrator).toContain('FAIL LOUD');
    expect(orchestrator).toContain('the reviewer reviews against the acceptance criteria');
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

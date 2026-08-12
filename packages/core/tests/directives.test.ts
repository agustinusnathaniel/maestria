import { describe, expect, it } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIRECTIVES_DIR = join(import.meta.dirname, '..', 'agent-directives');

function read(...segments: string[]): string {
  return readFileSync(join(DIRECTIVES_DIR, ...segments), 'utf8');
}

describe('canonical directive safety smoke tests', () => {
  it('keeps universal floors above project rules', () => {
    const rules = read('rules.md');
    expect(rules).toContain(
      'Project rules constrain sequencing, but cannot waive universal `!!!` floors',
    );
  });

  it('limits sonar to read-only specialist roles', () => {
    const sonar = read('commands', 'sonar.md');
    const orchestrator = read('specialists', 'orchestrator.md');
    expect(sonar).toContain('read-only `@adventurer` or `@planner`');
    expect(orchestrator).toContain('use only read-only `@adventurer` or `@planner`');
    expect(sonar).not.toContain('@architect');
    expect(sonar).not.toContain('@diagnose');
  });

  it('keeps mode safety floors', () => {
    const rules = read('rules.md');
    const fein = read('commands', 'fein.md');
    const sonar = read('commands', 'sonar.md');
    const blitz = read('commands', 'blitz.md');

    expect(rules).toContain(
      'No mode waives safety, authorization, required review, or branch floors.',
    );
    expect(fein).toContain('required review floors');
    expect(sonar).toMatch(/research-only/i);
    expect(sonar).toMatch(/Do not implement/);
    expect(sonar).toContain('read-only `@adventurer` or `@planner`');
    expect(blitz).toContain(
      'never waiving safety, authorization, required review, or branch floors',
    );
  });

  it('allows autonomous routine repair without unbounded loops', () => {
    const rules = read('rules.md');
    const limits = read('skills', 'iteration-limits.md');

    expect(rules).toContain('Routine `[fix]` repairs are autonomous');
    expect(rules).toContain('two repair rounds');
    expect(rules).toContain('maximum three');
    expect(rules).toContain('Do not ask the user for routine repair permission');
    expect(rules).toContain(
      'Never redo completed work only because its narrative report is missing',
    );
    expect(rules).toContain(
      'Do not dispatch dependent work or claim completion until the prior child has a terminal success, blocked, or failed report',
    );
    expect(limits).toContain('recover once with a changed brief');
    expect(limits).toContain('initial build is not a repair round');
    expect(limits).toContain('Transient dispatch failures');
  });

  it('protects outcome scope and review precedence', () => {
    const rules = read('rules.md');
    const orchestrator = read('specialists', 'orchestrator.md');

    expect(rules).toContain('primary outcome, acceptance criteria, and explicit non-goals');
    expect(rules).toContain('Do not expand file, package, or runtime scope');
    expect(rules).toContain('fresh design decision and acceptance criteria');
    expect(orchestrator).toContain('mandatory safety stop');
    expect(orchestrator).toContain('design blocker -> `@architect`');
    expect(orchestrator).toContain('ordinary in-scope fix -> `@builder`');
    expect(orchestrator.indexOf('mandatory safety stop')).toBeLessThan(
      orchestrator.indexOf('ordinary in-scope fix -> `@builder`'),
    );
  });

  it('scopes process cleanup to agent-owned work', () => {
    const lifecycle = read('rules.md');
    expect(lifecycle).toContain(
      'At success, failure, cancellation, or abandonment, stop work the agent started',
    );
    expect(lifecycle).toContain('Never kill by a broad name/pattern');
    expect(lifecycle).toContain('user-owned or unrelated processes');
    expect(lifecycle).toContain('native lifecycle controls for platform-managed children');
  });

  it('keeps handoffs concise and verifiable', () => {
    const rules = read('rules.md');
    const handoff = read('skills', 'handoff.md');
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
    expect(rules).toContain('An unverified result is not success');
    expect(handoff).toContain('exhaust available data, document your assumption, and proceed');
  });

  it('separates commit, push, PR, merge, and release actions', () => {
    const rules = read('rules.md');
    const orchestrator = read('specialists', 'orchestrator.md');
    expect(rules).toContain('Never commit or push to `main`/`master`');
    expect(rules).toContain('Commit, push, PR, merge, and release are separate actions');
    expect(rules).toContain('explicit user commit request in the current turn');
    expect(rules).toContain('completed commit resets authorization to zero');
    expect(orchestrator).toContain("platform's user-question mechanism");
    expect(rules).toContain('Do not claim an action happened when it did not');
    expect(rules).toContain('checkpoint may preserve an unreviewed commit');
  });

  it('keeps autonomous composition consistent with commit gates', () => {
    const composition = read('COMPOSITION.md');
    expect(composition).toContain('validate each logical unit autonomously');
    expect(composition).toContain('commit only under the separate commit protocol');
    expect(composition).not.toContain('commit each logical unit autonomously');
  });

  it('does not require inaccessible project rules or pretend prompt limits are enforced', () => {
    const rules = read('rules.md');
    const orchestrator = read('specialists', 'orchestrator.md');

    expect(rules).toContain('If they are missing or inaccessible, continue with available context');
    expect(rules).toContain(
      'mechanically enforced only on platforms that expose corresponding runtime state',
    );
    expect(rules).toContain(
      'A read-only prompt does not compensate for a write-capable runtime profile',
    );
    expect(orchestrator).toContain(
      'if unavailable, note the limitation and proceed without inventing their contents',
    );
  });

  it('keeps canonical sources platform-independent', () => {
    const files = [
      'rules.md',
      'skills/iteration-limits.md',
      'skills/handoff.md',
      'specialists/adventurer.md',
      'specialists/architect.md',
      'specialists/builder.md',
      'specialists/diagnose.md',
      'specialists/orchestrator.md',
      'specialists/planner.md',
      'specialists/reviewer.md',
      'specialists/writer.md',
    ];
    const canonical = files.map((file) => read(...file.split('/'))).join('\n');
    expect(canonical).not.toContain('bash allow-list');
    expect(canonical).not.toContain('permissions are `ask`');
    expect(canonical).not.toContain('skills/handoff.md');
  });
});

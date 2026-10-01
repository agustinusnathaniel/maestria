import path from 'node:path';

import { Context } from '@deepseek-ai/cordis';
import { renderPrompt, SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { SkillService } from '@deepseek-ai/dsh-skill';
import { afterAll, describe, expect, it } from 'vite-plus/test';

import { MAESTRIA_SPECIALISTS, apply as maestriaApply } from '../src/index.js';

const EXPECTED_SKILLS = [
  'adventurer',
  'architect',
  'blitz',
  'builder',
  'diagnose',
  'fein',
  'global-rules',
  'handoff',
  'iteration-limits',
  'orchestrator',
  'planner',
  'reviewer',
  'sonar',
  'writer',
] as const;

const ALL_PERSONA_ROLES = ['orchestrator', ...MAESTRIA_SPECIALISTS] as const;

/**
 * Integration test against the real published DeepSeek Harness services.
 *
 * The unit suite in plugin.test.ts asserts the plugin contract against
 * explicit fakes; this suite mounts the actual `dsh-system-prompt` and
 * `dsh-skill` service classes under a real Cordis root and exercises the
 * composition path the Maestria agent preset uses — including the strict
 * `{{variable}}` persona interpolation through `renderPrompt`. It is the
 * strongest verification available without a live `dsh` deployment, and it
 * is the surface whose breakage a DSH RC update would cause.
 */

const SKILLS_DIR = path.resolve(import.meta.dirname, '../skills');
const ORCHESTRATOR_PERSONA_CONFIG = {
  persona: '{{maestria_orchestrator}}',
};

const maestriaPlugin = {
  apply: maestriaApply,
  inject: ['systemPrompt', 'skills'],
  name: 'maestria',
};

const startHarness = async () => {
  const ctx = new Context();
  const fibers = [
    ctx.plugin(SystemPrompt, {
      includeHarnessIdentity: true,
      ...ORCHESTRATOR_PERSONA_CONFIG,
    }),
    ctx.plugin(SkillService, {}),
    ctx.plugin(maestriaPlugin, { injectGlobalRules: true, skillsDir: SKILLS_DIR }),
  ];
  // Services publish when their mount fiber settles; assert only after that.
  await Promise.all(fibers);
  const dispose = async (): Promise<void> => {
    await Promise.all(
      fibers.toReversed().map(async (fiber) => {
        await fiber.dispose();
      }),
    );
  };
  return { ctx, dispose };
};

let teardown = async (): Promise<void> => {};

afterAll(async () => {
  await teardown();
});

describe('maestria plugin on real DSH host services', () => {
  it('mounts under the real systemPrompt and skills services and contributes the preset composition', async () => {
    const harness = await startHarness();
    teardown = harness.dispose;
    const { ctx } = harness;

    const assembly = await ctx.systemPrompt.assemble();

    const names = assembly.sections.map((section) => section.name);
    expect(names).toContain('deployment:persona');
    expect(names).toContain('maestria:global-rules');
    expect(names).toContain('maestria:routing');

    // Assembly sorts sections ascending by (order, name); the Maestria
    // contributions must appear in that relative order.
    const index = (name: string): number =>
      assembly.sections.findIndex((section) => section.name === name);
    expect(index('maestria:global-rules')).toBeGreaterThan(index('deployment:persona'));
    expect(index('maestria:routing')).toBeGreaterThan(index('maestria:global-rules'));

    const persona = assembly.sections.find((section) => section.name === 'deployment:persona');
    expect(persona?.text).toBe('{{maestria_orchestrator}}');

    for (const role of ALL_PERSONA_ROLES) {
      const body = assembly.variables[`maestria_${role}`];
      expect(body).toBeTruthy();
      expect(body?.startsWith('---')).toBe(false);
      expect(body?.startsWith('<!--')).toBe(false);
    }
  });

  it('renders the orchestrator persona and rules through strict prompt interpolation', async () => {
    const harness = await startHarness();
    teardown = harness.dispose;
    const { ctx } = harness;

    const assembly = await ctx.systemPrompt.assemble();
    const rendered = renderPrompt(assembly);

    expect(rendered).toContain('powered by the DeepSeek Harness SDK');
    expect(rendered).toContain('# Global Agent Rules');
    expect(rendered).toContain('Maestria workflow routing');
    // renderPrompt throws on unknown `{{...}}` groups; a rendered prompt that
    // still carries a group means interpolation silently degraded.
    expect(rendered).not.toContain('{{');
  });

  it('serves the generated skill tree through the real skills registry', async () => {
    const harness = await startHarness();
    teardown = harness.dispose;
    const { ctx } = harness;

    const summaries = await ctx.skills.list();
    const names = summaries.map((summary) => summary.name).toSorted();
    expect(names).toEqual([...EXPECTED_SKILLS].toSorted());

    const orchestrator = await ctx.skills.get('orchestrator');
    expect(orchestrator?.provider).toBe('maestria');
    expect(orchestrator?.content).toContain('DeepSeek Harness Integration');
    expect(orchestrator?.content.startsWith('<!--')).toBe(false);

    const specialistDefinitions = await Promise.all(
      MAESTRIA_SPECIALISTS.map(async (specialist) => await ctx.skills.get(specialist)),
    );
    for (const [index, definition] of specialistDefinitions.entries()) {
      expect(definition?.name).toBe(MAESTRIA_SPECIALISTS[index]);
      expect(definition?.invocation).toEqual({ modelInvocable: true, userInvocable: true });
    }
  });

  it('fails the composition loudly when a persona variable is missing', async () => {
    const ctx = new Context();
    const fiber = ctx.plugin(SystemPrompt, {
      includeHarnessIdentity: false,
      persona: '{{maestria_orchestrator}}',
    });
    await fiber;
    teardown = async () => {
      await fiber.dispose();
    };

    // No maestria plugin is mounted, so `maestria_orchestrator` is an unknown
    // reference; renderPrompt must throw rather than degrade the prompt.
    const assembly = await ctx.systemPrompt.assemble();
    expect(() => renderPrompt(assembly)).toThrow();
  });
});

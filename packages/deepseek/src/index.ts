import type { Context } from '@deepseek-ai/cordis';
import type { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools';
import type { WorkingDirectoryService } from '@deepseek-ai/dsh-working-directory';

import { classifyCall, toPreToolDecision } from './guard.js';
import { projectContext } from './project.js';
import { readPrompt, RULES_ORDER } from './prompts.js';

/**
 * maestria plugin for the `maestria` agent preset: the main loop as the `maestria_main_loop`
 * prompt variable the persona row references, the global rules as a system-prompt section,
 * project customization as runtime context, and the shared hook policy on `tools/pre-execute`.
 */
export const name = 'maestria';

export const inject = ['systemPrompt', 'workingDirectory'];

/** After the host's working-directory, sandbox, approval, and delegation contexts. */
export const PROJECT_CONTEXT_ORDER = 130;

type Host = Context & {
  readonly systemPrompt: SystemPrompt;
  readonly workingDirectory: WorkingDirectoryService;
};

/** The host provides both services (`inject`); the package imports host types only. */
export const apply = (ctx: Host): void => {
  const mainLoop = readPrompt('main-loop');
  ctx.systemPrompt.variable('maestria_main_loop', () => mainLoop);
  ctx.systemPrompt.section({
    interpolate: false,
    name: 'maestria:rules',
    order: RULES_ORDER,
    text: readPrompt('rules'),
  });
  ctx.systemPrompt.context({
    interpolate: false,
    name: 'maestria:project',
    order: PROJECT_CONTEXT_ORDER,
    required: true,
    text: ({ agent }) =>
      agent === undefined ? '' : projectContext(ctx.workingDirectory.get(agent.session)),
  });
  ctx.on(
    'tools/pre-execute',
    async (exec: ToolExecution, next: () => Promise<PreToolDecision>): Promise<PreToolDecision> => {
      if (exec.agent === undefined) {
        return await next();
      }
      const cwd = ctx.workingDirectory.get(exec.agent.session);
      return await (toPreToolDecision(classifyCall(exec.name, exec.arguments, cwd)) ?? next());
    },
  );
};

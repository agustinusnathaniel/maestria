import { defineCommand } from 'citty';
import { Effect, Exit, Cause } from 'effect';
import { isCancel, cancel, select } from '@clack/prompts';
import picocolors from 'picocolors';

import { groupMultiselect } from '@/lib/group-multiselect.js';
import { MAESTRIA_AGENTS, getModelConfigHandler, modelConfigHandlers } from '@/lib/model-config.js';
import type { AgentModels, ModelConfigHandler, ModelConfigLevel } from '@/lib/model-config.js';
import { createSpinner } from '@/lib/output.js';
import { commandExists } from '@/lib/shell.js';
import { validatePlatform, validateOrExit } from '@/lib/validation.js';

function exitError(message: string): never {
  console.error(`  ${picocolors.red('✗')} ${message}`);
  process.exit(1);
}

function exitCancel(): never {
  cancel('Cancelled.');
  process.exit(130);
}

/** Parse `--set adventurer=model,builder=` pairs. Empty model = inherit/unset. */
function parseSetPairs(input: string): AgentModels {
  const models: AgentModels = {};
  for (const pair of input.split(',')) {
    const eq = pair.indexOf('=');
    if (eq < 0) {
      exitError(
        `Invalid --set entry '${pair}'. Use <agent>=<model>, e.g. --set builder=opencode-go/deepseek-v4-flash. ` +
          `Use <agent>= (empty) to reset to inherit.`,
      );
    }
    const agent = pair.slice(0, eq).trim();
    const model = pair.slice(eq + 1).trim();
    if (!MAESTRIA_AGENTS.includes(agent as (typeof MAESTRIA_AGENTS)[number])) {
      exitError(`Unknown agent '${agent}'. Valid agents: ${MAESTRIA_AGENTS.join(', ')}`);
    }
    models[agent as keyof AgentModels] = model;
  }
  return models;
}

/** Run an effect and extract the error message (or exit with a generic message) */
async function runOrExit<T>(effect: Effect.Effect<T, unknown>, fallback: string): Promise<T> {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  const firstFailure = exit.cause.reasons.find(Cause.isFailReason);
  const message = (firstFailure?.error as { message?: string } | undefined)?.message;
  exitError(message ?? fallback);
}

function renderConfigureSummary(
  label: string,
  level: ModelConfigLevel,
  models: AgentModels,
): string {
  const lines: string[] = [];
  lines.push(picocolors.bold(`\n  ${label} agent models (${level})`));
  lines.push(picocolors.dim('  ─────────────────────────────────────'));
  for (const agent of MAESTRIA_AGENTS) {
    const model = models[agent];
    const value = model ? picocolors.green(model) : picocolors.dim('inherit (session model)');
    lines.push(`  ${picocolors.bold(agent.padEnd(10))} ${value}`);
  }
  return lines.join('\n') + '\n';
}

function renderCompactConfigure(models: AgentModels): string {
  return (
    Object.entries(models)
      .filter(([, model]) => model)
      .map(([agent, model]) => `${agent}=${model}`)
      .join('\n') + '\n'
  );
}

function renderConfigureJson(
  handler: ModelConfigHandler,
  level: ModelConfigLevel,
  models: AgentModels,
): string {
  const all: Record<string, string> = {};
  for (const agent of MAESTRIA_AGENTS) {
    all[agent] = models[agent] ?? '';
  }
  return JSON.stringify(
    { platform: handler.id, label: handler.label, level, models: all },
    null,
    2,
  );
}

export const configureCommand = defineCommand({
  meta: {
    name: 'configure',
    description: 'Configure per-agent models for a coding agent platform',
  },
  args: {
    platform: {
      type: 'positional',
      description:
        'Platform to configure. One of: opencode, pi, omp. Pass directly to skip interactive selection.',
      required: false,
    },
    global: {
      type: 'boolean',
      description: 'Configure the global (user-level) config. Default in interactive mode.',
      default: false,
    },
    project: {
      type: 'boolean',
      description:
        'Configure the project-level config (.opencode/ or .pi/agents/ or .omp/agents/).',
      default: false,
    },
    set: {
      type: 'string',
      description:
        'Set models non-interactively. Comma-separated <agent>=<model> pairs, e.g. ' +
        "'builder=opencode-go/deepseek-v4-flash'. Use <agent>= (empty value) to reset to inherit.",
      default: undefined,
    },
    json: {
      type: 'boolean',
      description:
        'Output results as JSON - structured machine-readable format optimized for AI agents and CI pipelines',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description:
        'Suppress spinner and non-essential output. Recommended for CI and non-interactive usage.',
      default: false,
    },
    compact: {
      type: 'boolean',
      description: 'Minimal machine-friendly text output. Strips colors and decorative formatting.',
      default: false,
    },
  },
  run: async ({ args }) => {
    const isQuiet = (args.quiet || args.compact) as boolean;
    const isCompact = args.compact as boolean;
    const isJson = args.json as boolean;

    // 1. Resolve platform
    let handler: ModelConfigHandler;
    if (args.platform) {
      const platformId = await validateOrExit(validatePlatform(args.platform as string));
      const h = getModelConfigHandler(platformId);
      if (!h) {
        exitError(
          `Per-agent model configuration is not yet supported for '${platformId}'. ` +
            `Supported: opencode, pi, omp.`,
        );
      }
      handler = h;
    } else {
      if (!process.stdout.isTTY || !process.stdin.isTTY) {
        console.error('No platform specified and not in an interactive terminal.');
        console.error(
          'Usage: maestria configure <platform> or maestria configure --set <agent>=<model>',
        );
        console.error("Run 'maestria configure --help' for details.");
        process.exit(1);
      }
      const picked = await select({
        message: 'Which platform do you want to configure?',
        options: modelConfigHandlers.map((h) => ({ value: h.id, label: h.label })),
        maxItems: 3,
      });
      if (isCancel(picked)) exitCancel();
      handler = getModelConfigHandler(picked as string)!;
    }

    // 2. Check the platform CLI exists
    const cliAvailable = await Effect.runPromise(commandExists(handler.cli));
    if (!cliAvailable) {
      exitError(`The '${handler.cli}' CLI was not found on PATH. Install ${handler.label} first.`);
    }

    // 3. Resolve config level
    const bothFlags = (args.global && args.project) as boolean;
    if (bothFlags) {
      exitError('Cannot use --global and --project together. Choose one.');
    }
    let level: ModelConfigLevel;
    if (args.global) {
      level = 'global';
    } else if (args.project) {
      level = 'project';
    } else if (process.stdout.isTTY && process.stdin.isTTY && !args.set) {
      const picked = await select({
        message: 'Where do you want to configure models?',
        options: [
          { value: 'global' as const, label: 'Global', hint: 'applies to all projects' },
          { value: 'project' as const, label: 'Project', hint: 'applies to this project only' },
        ],
        initialValue: 'global',
      });
      if (isCancel(picked)) exitCancel();
      level = picked as ModelConfigLevel;
    } else {
      exitError('Specify --global or --project when using --set or in a non-interactive terminal.');
    }

    // 4. Non-interactive: --set
    if (args.set) {
      const models = parseSetPairs(args.set as string);
      const spinner = createSpinner(isQuiet);
      spinner.start(`Validating models for ${handler.label}...`);
      const available = await runOrExit(
        handler.listModels,
        `Failed to list models for ${handler.label}.`,
      );
      spinner.stop('');

      for (const [agent, model] of Object.entries(models)) {
        if (model && !available.includes(model)) {
          exitError(
            `Unknown model '${model}' for ${agent}. Run 'maestria configure ${handler.id}' ` +
              `interactively to pick from available models, or check the model id.`,
          );
        }
      }

      spinner.start(`Writing config for ${handler.label}...`);
      await runOrExit(handler.write(models, level), `Failed to write config for ${handler.label}.`);
      spinner.stop('Done');

      if (isJson) {
        console.log(renderConfigureJson(handler, level, models));
      } else if (isCompact) {
        console.log(renderCompactConfigure(models));
      } else {
        console.log(renderConfigureSummary(handler.label, level, models));
        console.log(`  ${picocolors.dim(handler.restartHint)}`);
      }
      process.exit(0);
    }

    // 5. Interactive
    if (!process.stdout.isTTY || !process.stdin.isTTY) {
      console.error('No --set provided and not in an interactive terminal.');
      console.error(
        'Usage: maestria configure <platform> --set <agent>=<model>[,<agent>=<model>...]',
      );
      console.error("Run 'maestria configure --help' for details.");
      process.exit(1);
    }

    const spinner = createSpinner(isQuiet);
    spinner.start(`Loading models for ${handler.label}...`);
    const available = await runOrExit(
      handler.listModels,
      `Failed to list models for ${handler.label}.`,
    );
    spinner.stop('');
    if (available.length === 0) {
      exitError(
        `No models found for ${handler.label}. Make sure '${handler.cli}' is installed and authenticated.`,
      );
    }

    spinner.start('Reading current configuration...');
    const current = await runOrExit(
      handler.readCurrent(level),
      `Failed to read the current ${handler.label} configuration.`,
    );
    spinner.stop('');

    const selectedAgents = await groupMultiselect({
      message: 'Which agents do you want to configure?',
      options: {
        Specialists: handler.agents.map((agent) => ({
          value: agent,
          label: agent,
          hint: current[agent as keyof AgentModels]
            ? `currently ${current[agent as keyof AgentModels]}`
            : 'inherit',
        })),
      },
      selectableGroups: true,
      required: true,
      maxItems: 8,
    });
    if (isCancel(selectedAgents)) exitCancel();

    const models: AgentModels = {};
    for (const agent of selectedAgents as string[]) {
      if (!MAESTRIA_AGENTS.includes(agent as (typeof MAESTRIA_AGENTS)[number])) {
        continue;
      }
      const name = agent as keyof AgentModels;
      const picked = await select({
        message: `Model for @${name}${current[name] ? ` (currently ${current[name]})` : ''}`,
        options: [
          { value: '', label: 'Inherit', hint: 'use the session/primary agent model' },
          ...available.map((model) => ({ value: model, label: model })),
        ],
        maxItems: 10,
        initialValue: current[name] && available.includes(current[name]) ? current[name] : '',
      });
      if (isCancel(picked)) exitCancel();
      if (picked) {
        models[name] = picked as string;
      }
    }

    if (Object.keys(models).length === 0) {
      console.log('No changes. Nothing to write.');
      process.exit(0);
    }

    spinner.start(`Writing config for ${handler.label}...`);
    await runOrExit(handler.write(models, level), `Failed to write config for ${handler.label}.`);
    spinner.stop('Done');

    if (isJson) {
      console.log(renderConfigureJson(handler, level, models));
    } else if (isCompact) {
      console.log(renderCompactConfigure(models));
    } else {
      console.log(renderConfigureSummary(handler.label, level, models));
      console.log(`  ${picocolors.dim(handler.restartHint)}`);
    }
    process.exit(0);
  },
});

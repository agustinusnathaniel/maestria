import { cancel, isCancel, select } from '@clack/prompts';
import { defineCommand } from 'citty';
import { Cause, Effect, Exit } from 'effect';
import picocolors from 'picocolors';

import { groupMultiselect } from '@/lib/group-multiselect.js';
import { getModelConfigHandler, MAESTRIA_AGENTS, modelConfigHandlers } from '@/lib/model-config.js';
import type {
  AgentModels,
  AgentName,
  ModelConfigHandler,
  ModelConfigLevel,
} from '@/lib/model-config.js';
import { createSpinner } from '@/lib/output.js';
import { commandExists } from '@/lib/shell.js';
import { validateOrExit, validatePlatform } from '@/lib/validation.js';

const exitError = (message: string): never => {
  console.error(`  ${picocolors.red('✗')} ${message}`);
  process.exit(1);
};

const exitCancel = (): never => {
  cancel('Cancelled.');
  process.exit(130);
};

const isAgentName = (agent: string): agent is AgentName =>
  MAESTRIA_AGENTS.some((knownAgent) => knownAgent === agent);

/** Parse `--set adventurer=model,builder=` pairs. Empty model = inherit/unset. */
const parseSetPairs = (input: string): AgentModels => {
  const models: AgentModels = {};
  for (const pair of input.split(',')) {
    const eq = pair.indexOf('=');
    if (eq === -1) {
      exitError(
        `Invalid --set entry '${pair}'. Use <agent>=<model>, e.g. --set builder=opencode-go/deepseek-v4-flash. ` +
          `Use <agent>= (empty) to reset to inherit.`,
      );
    }
    const agent = pair.slice(0, eq).trim();
    const model = pair.slice(eq + 1).trim();
    if (!isAgentName(agent)) {
      exitError(`Unknown agent '${agent}'. Valid agents: ${MAESTRIA_AGENTS.join(', ')}`);
    }
    Object.assign(models, { [agent]: model });
  }
  return models;
};

/** Run an effect and extract the error message (or exit with a generic message) */
const runOrExit = async <T>(effect: Effect.Effect<T, unknown>, fallback: string): Promise<T> => {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  const firstFailure = exit.cause.reasons.find(Cause.isFailReason);
  const failure = firstFailure?.error;
  const message =
    typeof failure === 'object' &&
    failure !== null &&
    'message' in failure &&
    typeof failure.message === 'string'
      ? failure.message
      : undefined;
  return exitError(message ?? fallback);
};

const renderConfigureSummary = (
  label: string,
  level: ModelConfigLevel,
  models: AgentModels,
): string => {
  const lines: string[] = [
    picocolors.bold(`\n  ${label} agent models (${level})`),
    picocolors.dim('  ─────────────────────────────────────'),
  ];
  for (const agent of MAESTRIA_AGENTS) {
    const model = models[agent];
    const value =
      model !== undefined && model !== null && model !== ''
        ? picocolors.green(model)
        : picocolors.dim('inherit (session model)');
    lines.push(`  ${picocolors.bold(agent.padEnd(10))} ${value}`);
  }
  return `${lines.join('\n')}\n`;
};

const renderCompactConfigure = (models: AgentModels): string =>
  `${Object.entries(models)
    .filter(([, model]) => model)
    .map(([agent, model]) => `${agent}=${model}`)
    .join('\n')}\n`;

const renderConfigureJson = (
  handler: ModelConfigHandler,
  level: ModelConfigLevel,
  models: AgentModels,
): string => {
  const all: Record<string, string> = {};
  for (const agent of MAESTRIA_AGENTS) {
    all[agent] = models[agent] ?? '';
  }
  return JSON.stringify(
    { label: handler.label, level, models: all, platform: handler.id },
    null,
    2,
  );
};

const resolveConfigureHandler = async (
  platformId: string | undefined,
): Promise<ModelConfigHandler> => {
  if (platformId !== undefined && platformId !== null && platformId !== '') {
    const id = await validateOrExit(validatePlatform(platformId));
    const h = getModelConfigHandler(id);
    if (!h) {
      exitError(
        `Per-agent model configuration is not yet supported for '${id}'. Supported: ${modelConfigHandlers
          .map((handler) => handler.id)
          .join(', ')}.`,
      );
    }
    return h ?? exitError(`Per-agent model configuration is not yet supported for '${id}'.`);
  }
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    console.error('No platform specified and not in an interactive terminal.');
    console.error(
      'Usage: maestria configure <platform> or maestria configure --set <agent>=<model>',
    );
    console.error("Run 'maestria configure --help' for details.");
    process.exit(1);
  }
  const picked = await select({
    maxItems: 5,
    message: 'Which platform do you want to configure?',
    options: modelConfigHandlers.map((h) => ({ label: h.label, value: h.id })),
  });
  if (isCancel(picked)) {
    exitCancel();
  }
  if (typeof picked !== 'string') {
    return exitCancel();
  }
  return getModelConfigHandler(picked) ?? exitError(`Unknown platform: ${picked}`);
};

const resolveConfigureLevel = async (
  args: Record<string, unknown>,
  _handler: ModelConfigHandler,
): Promise<ModelConfigLevel> => {
  const bothFlags = args.global === true && args.project === true;
  if (bothFlags) {
    exitError('Cannot use --global and --project together. Choose one.');
  }
  if (args.global === true) {
    return 'global';
  }
  if (args.project === true) {
    return 'project';
  }
  if (
    process.stdout.isTTY &&
    process.stdin.isTTY &&
    (args.set === undefined || args.set === null || args.set === '')
  ) {
    const picked = await select({
      initialValue: 'global',
      message: 'Where do you want to configure models?',
      options: [
        { hint: 'applies to all projects', label: 'Global', value: 'global' as const },
        { hint: 'applies to this project only', label: 'Project', value: 'project' as const },
      ],
    });
    if (isCancel(picked)) {
      exitCancel();
    }
    if (picked === 'global' || picked === 'project') {
      return picked;
    }
    return exitError('Invalid configuration level selected.');
  }
  return exitError(
    'Specify --global or --project when using --set or in a non-interactive terminal.',
  );
};

const promptForAgentModel = async (
  name: AgentName,
  current: AgentModels,
  available: string[],
): Promise<string> => {
  const picked = await select({
    initialValue:
      current[name] !== undefined &&
      current[name] !== null &&
      current[name] !== '' &&
      available.includes(current[name])
        ? current[name]
        : '',
    maxItems: 10,
    message: `Model for @${name}${current[name] !== undefined && current[name] !== null && current[name] !== '' ? ` (currently ${current[name]})` : ''}`,
    options: [
      { hint: 'use the session/primary agent model', label: 'Inherit', value: '' },
      ...available.map((model) => ({ label: model, value: model })),
    ],
  });
  if (typeof picked === 'string') {
    return picked;
  }
  return exitCancel();
};

const promptSelectedAgentModels = async (
  agents: readonly unknown[],
  current: AgentModels,
  available: string[],
  index = 0,
  models: AgentModels = {},
): Promise<AgentModels> => {
  const agent = agents[index];
  if (agent === undefined) {
    return models;
  }
  if (typeof agent === 'string' && isAgentName(agent)) {
    const picked = await promptForAgentModel(agent, current, available);
    if (picked !== '') {
      models[agent] = picked;
    }
  }
  return await promptSelectedAgentModels(agents, current, available, index + 1, models);
};

const handleConfigureSet = async (
  handler: ModelConfigHandler,
  level: ModelConfigLevel,
  setArg: string,
  isQuiet: boolean,
  isJson: boolean,
  isCompact: boolean,
): Promise<never> => {
  const models = parseSetPairs(setArg);
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
        `Unknown model '${model}' for ${agent}. Run 'maestria configure ${handler.id}' interactively to pick from available models, or check the model id.`,
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
};

// oxlint-disable-next-line max-lines-per-function -- handleConfigureInteractive orchestrates the interactive model configuration flow (load models, read current, groupMultiselect, per-agent prompts, write) as a single cohesive interaction; splitting would fragment the prompt sequence and duplicate handler/level closure.
const handleConfigureInteractive = async (
  handler: ModelConfigHandler,
  level: ModelConfigLevel,
  isQuiet: boolean,
  isJson: boolean,
  isCompact: boolean,
): Promise<never> => {
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
    maxItems: 8,
    message: 'Which agents do you want to configure?',
    options: {
      Specialists: handler.agents.map((agent) => ({
        hint:
          isAgentName(agent) &&
          current[agent] !== undefined &&
          current[agent] !== null &&
          current[agent] !== ''
            ? `currently ${current[agent]}`
            : 'inherit',
        label: agent,
        value: agent,
      })),
    },
    required: true,
    selectableGroups: true,
  });
  const selectedAgentValues: unknown[] = Array.isArray(selectedAgents)
    ? selectedAgents
    : exitCancel();
  const models = await promptSelectedAgentModels(selectedAgentValues, current, available);
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
};

export const configureCommand = defineCommand({
  args: {
    compact: {
      default: false,
      description: 'Minimal machine-friendly text output. Strips colors and decorative formatting.',
      type: 'boolean',
    },
    global: {
      default: false,
      description: 'Configure the global (user-level) config. Default in interactive mode.',
      type: 'boolean',
    },
    json: {
      default: false,
      description:
        'Output results as JSON - structured machine-readable format optimized for AI agents and CI pipelines',
      type: 'boolean',
    },
    platform: {
      description:
        'Platform to configure. One of: opencode, codex, cursor, pi, omp. Pass directly to skip interactive selection.',
      required: false,
      type: 'positional',
    },
    project: {
      default: false,
      description:
        'Configure the project-level config (.opencode/, .codex/agents/, .cursor/agents/, .pi/agents/, or .omp/agents/).',
      type: 'boolean',
    },
    quiet: {
      default: false,
      description:
        'Suppress spinner and non-essential output. Recommended for CI and non-interactive usage.',
      type: 'boolean',
    },
    set: {
      default: undefined,
      description:
        'Set models non-interactively. Comma-separated <agent>=<model> pairs, e.g. ' +
        "'builder=opencode-go/deepseek-v4-flash'. Use <agent>= (empty value) to reset to inherit.",
      type: 'string',
    },
  },
  meta: {
    description: 'Configure per-agent models for a coding agent platform',
    name: 'configure',
  },
  run: async ({ args }) => {
    const isQuiet = args.quiet || args.compact;
    const isCompact = args.compact;
    const isJson = args.json;
    const handler = await resolveConfigureHandler(args.platform);
    const cliAvailable = await Effect.runPromise(handler.isAvailable ?? commandExists(handler.cli));
    if (!cliAvailable) {
      exitError(`The '${handler.cli}' CLI was not found on PATH. Install ${handler.label} first.`);
    }
    const level = await resolveConfigureLevel(args, handler);
    await (args.set !== undefined && args.set !== null && args.set !== ''
      ? handleConfigureSet(handler, level, args.set, isQuiet, isJson, isCompact)
      : handleConfigureInteractive(handler, level, isQuiet, isJson, isCompact));
  },
});

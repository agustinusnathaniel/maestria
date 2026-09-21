import { cancel, isCancel, select } from '@clack/prompts';
import { defineCommand } from 'citty';

import {
  assertInteractiveTerminal,
  batchCommandResult,
  detectInstalledOr,
  resolveBatchQuiet,
  runBatchSelected,
} from '@/lib/batch-command.js';
import { toCommandRun } from '@/lib/command-runner.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { getPlatform, platforms } from '@/lib/platforms.js';
import { uninstallOne } from '@/lib/platform-transaction.js';
import { defaultSkillRunner, reconcileUninstallCompanions } from '@/lib/skill-reconcile.js';
import { readSkillsRecord } from '@/lib/skills.js';
import { VALID_PLATFORMS } from '@/lib/validation.js';
import type { PlatformResult } from '@/types.js';

export interface UninstallArgs {
  all?: boolean;
  compact?: boolean;
  json?: boolean;
  platform?: string;
  quiet?: boolean;
}

const runUninstallAll = async (isQuiet: boolean): Promise<PlatformResult[] | CommandResult> => {
  const targets = await detectInstalledOr(isQuiet, 'No maestria installations found to uninstall.');
  if (!Array.isArray(targets)) {
    return targets;
  }
  return await runBatchSelected(targets, isQuiet, uninstallOne);
};

const runUninstallInteractive = async (
  isQuiet: boolean,
): Promise<PlatformResult[] | CommandResult> => {
  assertInteractiveTerminal('uninstall');
  const targets = await detectInstalledOr(isQuiet, 'No maestria installations found to uninstall.');
  if (!Array.isArray(targets)) {
    return targets;
  }
  const installed = targets;
  const selected = await select({
    message: 'Which platform do you want to uninstall maestria for?',
    options: installed.map((p) => ({ label: p.label ?? p.id, value: p.id })),
  });
  if (isCancel(selected) || typeof selected !== 'string' || selected === '') {
    cancel('Uninstall cancelled.');
    throw new CliError('', 130);
  }
  return await runBatchSelected([{ id: selected }], isQuiet, uninstallOne);
};

export const handleUninstall = async (args: UninstallArgs): Promise<CommandResult> => {
  const isQuiet = resolveBatchQuiet(args);
  // Corrupt records fail before ANY external effect; a missing record
  // proceeds (plugin state is independent) with the companion left in place.
  const record = await readSkillsRecord();
  let targetIds: string[];
  if (args.platform !== undefined && args.platform !== null && args.platform !== '') {
    const platform = getPlatform(args.platform);
    if (!platform) {
      throw new CliError(
        `Unknown platform: ${args.platform}\nAvailable: ${platforms.map((p) => p.id).join(', ')}`,
        1,
      );
    }
    targetIds = [platform.id];
  } else if (args.all === true) {
    const outcome = await runUninstallAll(isQuiet);
    if (!Array.isArray(outcome)) {
      return outcome;
    }
    // runUninstallAll already ran the batch; reconcile companions per result.
    const combined = await reconcileUninstallCompanions(defaultSkillRunner, record, outcome);
    return batchCommandResult(combined.results, args);
  } else {
    const outcome = await runUninstallInteractive(isQuiet);
    if (!Array.isArray(outcome)) {
      return outcome;
    }
    const combined = await reconcileUninstallCompanions(defaultSkillRunner, record, outcome);
    return batchCommandResult(combined.results, args);
  }
  const results = await runBatchSelected(
    targetIds.map((id) => ({ id })),
    isQuiet,
    uninstallOne,
  );
  const combined = await reconcileUninstallCompanions(defaultSkillRunner, record, results);
  return batchCommandResult(combined.results, args);
};

export const uninstallCommand = defineCommand({
  args: {
    all: {
      alias: 'a',
      default: false,
      description: 'Uninstall all installed platforms',
      type: 'boolean',
    },
    compact: {
      default: false,
      description: 'Minimal machine-friendly text output. Strips colors and decorative formatting.',
      type: 'boolean',
    },
    json: {
      default: false,
      description:
        'Output results as JSON - structured machine-readable format optimized for AI agents and CI pipelines',
      type: 'boolean',
    },
    platform: {
      description: `Platform to uninstall. One of: ${VALID_PLATFORMS.join(', ')}. Pass directly to skip interactive selection.`,
      required: false,
      type: 'positional',
    },
    quiet: {
      default: false,
      description:
        'Suppress spinner and non-essential output. Recommended for CI and non-interactive usage.',
      type: 'boolean',
    },
  },
  meta: {
    description: 'Uninstall maestria plugins for coding agent platforms',
    name: 'uninstall',
  },
  run: toCommandRun(handleUninstall),
});

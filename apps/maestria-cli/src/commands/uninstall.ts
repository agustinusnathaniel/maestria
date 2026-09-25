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

export interface UninstallArgs {
  all?: boolean;
  compact?: boolean;
  json?: boolean;
  platform?: string;
  quiet?: boolean;
}

const collectUninstallTargets = async (
  platform: string | undefined,
  all: boolean,
  isQuiet: boolean,
): Promise<{ id: string }[] | CommandResult> => {
  if (platform !== undefined && platform !== null && platform !== '') {
    const found = getPlatform(platform);
    if (!found) {
      throw new CliError(
        `Unknown platform: ${platform}\nAvailable: ${platforms.map((p) => p.id).join(', ')}`,
        1,
      );
    }
    return [{ id: found.id }];
  }
  if (all) {
    return await detectInstalledOr(isQuiet, 'No maestria installations found to uninstall.');
  }
  assertInteractiveTerminal('uninstall');
  const targets = await detectInstalledOr(isQuiet, 'No maestria installations found to uninstall.');
  if (!Array.isArray(targets)) {
    return targets;
  }
  const selected = await select({
    message: 'Which platform do you want to uninstall maestria for?',
    options: targets.map((p) => ({ label: p.label ?? p.id, value: p.id })),
  });
  if (isCancel(selected) || typeof selected !== 'string' || selected === '') {
    cancel('Uninstall cancelled.');
    throw new CliError('', 130);
  }
  return [{ id: selected }];
};

export const handleUninstall = async (args: UninstallArgs): Promise<CommandResult> => {
  const isQuiet = resolveBatchQuiet(args);
  const record = await readSkillsRecord();
  const targets = await collectUninstallTargets(args.platform, args.all === true, isQuiet);
  if (!Array.isArray(targets)) {
    return targets;
  }
  const results = await runBatchSelected(targets, isQuiet, uninstallOne);
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

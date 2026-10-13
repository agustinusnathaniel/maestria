import { cancel, isCancel } from '@clack/prompts';
import { defineCommand } from 'citty';
import { Effect } from 'effect';
import picocolors from 'picocolors';

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
import { detectInstalled } from '@/lib/detect.js';
import { needsUpdateOf } from '@/lib/freshness.js';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { updateOne } from '@/lib/platform-transaction.js';
import {
  assertNoRemovedSkillFlags,
  defaultSkillRunner,
  removeLegacyCompanions,
} from '@/lib/skill-reconcile.js';
import { readSkillsRecord } from '@/lib/skills.js';
import type { SkillsRecord } from '@/lib/skills.js';
import {
  VALID_PLATFORMS,
  validateOrThrow,
  validatePlatforms,
  validateVersion,
} from '@/lib/validation.js';

export interface UpdateArgs {
  all?: boolean;
  compact?: boolean;
  json?: boolean;
  platform?: string;
  quiet?: boolean;
  version?: string;
}

const collectInteractiveUpdateTargets = async (): Promise<
  { id: string; label?: string }[] | CommandResult
> => {
  assertInteractiveTerminal('update');
  const installed = await Effect.runPromise(detectInstalled());
  if (installed.length === 0) {
    return {
      exitCode: 0,
      output: 'No maestria installations found to update.',
    };
  }
  const statuses = installed.map((platform) => ({
    ...platform,
    needsUpdate: needsUpdateOf(platform.installedVersion, platform.latestVersion),
  }));
  const needsUpdate = statuses.filter((s) => s.needsUpdate);
  if (needsUpdate.length === 0) {
    const lines = statuses
      .filter((s) => !s.needsUpdate)
      .map((s) => `  ${picocolors.green('✓')} ${s.label}: ${s.installedVersion}`)
      .join('\n');
    return { exitCode: 0, output: `\nAll platforms are up to date.\n${lines}\n` };
  }
  const selected = await groupMultiselect({
    message: 'Which platforms do you want to update?',
    options: {
      'All platforms': needsUpdate.map((s) => ({
        hint: `${s.installedVersion} → ${s.latestVersion}`,
        label: s.label,
        value: s.id,
      })),
    },
    required: true,
    selectableGroups: true,
  });
  if (isCancel(selected) || !Array.isArray(selected) || selected.length === 0) {
    cancel('Update cancelled.');
    throw new CliError('', 130);
  }
  return needsUpdate
    .filter((platform) => selected.includes(platform.id))
    .map((platform) => ({ id: platform.id, label: platform.label }));
};

/**
 * Legacy cleanup when every installed plugin is already current. The plugin
 * step is a reported no-op per platform while recorded CLI-installed skill
 * copies are removed through the shared cleanup. With no record entries the
 * up-to-date output returns unchanged and no skills CLI call runs.
 */
const cleanupCurrentInstalls = async (
  record: SkillsRecord | null,
  upToDate: CommandResult,
  args: UpdateArgs,
): Promise<CommandResult> => {
  const installed = await Effect.runPromise(detectInstalled({ includeLatest: false }));
  if (!installed.some((platform) => record?.platforms[platform.id] !== undefined)) {
    return upToDate;
  }
  const results = installed.map((platform) => ({
    id: platform.id,
    label: platform.label,
    message: 'Already up to date',
    ok: true,
  }));
  const combined = await removeLegacyCompanions(defaultSkillRunner, record, results, {
    silentWhenUnrecorded: true,
  });
  return batchCommandResult(combined.results, args);
};

export const handleUpdate = async (rawArgs: UpdateArgs): Promise<CommandResult> => {
  assertNoRemovedSkillFlags(rawArgs, 'update');
  const isQuiet = resolveBatchQuiet(rawArgs);
  let platformIds: string[] | undefined;
  if (rawArgs.platform !== undefined && rawArgs.platform !== null && rawArgs.platform !== '') {
    platformIds = await validateOrThrow(validatePlatforms(rawArgs.platform));
  }
  if (rawArgs.version !== undefined && rawArgs.version !== null && rawArgs.version !== '') {
    await validateOrThrow(validateVersion(rawArgs.version));
  }
  const record = await readSkillsRecord();

  let targets: { id: string; label?: string }[];
  if (platformIds && platformIds.length > 0) {
    targets = platformIds.map((id) => ({ id }));
  } else if (rawArgs.all === true) {
    const outcome = await detectInstalledOr(isQuiet, 'No maestria installations found to update.');
    if (!Array.isArray(outcome)) {
      return outcome;
    }
    targets = outcome;
  } else {
    const outcome = await collectInteractiveUpdateTargets();
    if (!Array.isArray(outcome)) {
      return await cleanupCurrentInstalls(record, outcome, rawArgs);
    }
    targets = outcome;
  }
  // The plugin batch runs first; recorded CLI-installed skill copies are
  // removed afterwards, and only for platforms whose plugin step succeeded.
  const results = await runBatchSelected(targets, isQuiet, (platform, quiet) =>
    updateOne(platform, quiet, rawArgs.version),
  );
  const combined = await removeLegacyCompanions(defaultSkillRunner, record, results, {
    silentWhenUnrecorded: true,
  });
  return batchCommandResult(combined.results, rawArgs);
};

export const updateCommand = defineCommand({
  args: {
    all: {
      alias: 'a',
      default: false,
      description: 'Update all installed platforms',
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
      description: `Platform(s) to update. Comma-separated for multiple (e.g., opencode,pi). One of: ${VALID_PLATFORMS.join(', ')}. Pass directly to skip interactive selection.`,
      required: false,
      type: 'positional',
    },
    quiet: {
      default: false,
      description:
        'Suppress spinner and non-essential output. Recommended for CI and non-interactive usage.',
      type: 'boolean',
    },
    version: {
      alias: 'V',
      description: 'Target version to install (e.g., 0.5.0). Defaults to latest available version.',
      required: false,
      type: 'string',
    },
  },
  meta: {
    description: 'Update maestria plugins to the latest (or specified) version',
    name: 'update',
  },
  run: toCommandRun(handleUpdate),
});

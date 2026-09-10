import { cancel, isCancel } from '@clack/prompts';
import { defineCommand } from 'citty';
import { Effect } from 'effect';
import picocolors from 'picocolors';

import {
  assertInteractiveTerminal,
  batchCommandResult,
  resolveBatchQuiet,
  runBatchSelected,
} from '@/lib/batch-command.js';
import { toCommandRun } from '@/lib/command-runner.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectInstalled } from '@/lib/detect.js';
import { needsUpdateOf } from '@/lib/freshness.js';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { createSpinner } from '@/lib/output.js';
import { getPlatform } from '@/lib/platforms.js';
import { updateOne } from '@/lib/platform-transaction.js';
import {
  VALID_PLATFORMS,
  validateOrThrow,
  validatePlatforms,
  validateVersion,
} from '@/lib/validation.js';
import type { PlatformResult } from '@/types.js';

export interface UpdateArgs {
  all?: boolean;
  compact?: boolean;
  json?: boolean;
  platform?: string;
  quiet?: boolean;
  version?: string;
}

interface UpdateStatus {
  id: string;
  label: string;
  installedVersion: string;
  latestVersion: string;
  needsUpdate: boolean;
}

const runAllUpdate = async (
  isQuiet: boolean,
  version?: string,
): Promise<PlatformResult[] | CommandResult> => {
  const spinner = createSpinner(isQuiet);
  spinner.start('Detecting platforms...');
  const installed = await Effect.runPromise(detectInstalled());
  spinner.stop('Done');
  if (installed.length === 0) {
    return {
      exitCode: 0,
      output: 'No maestria installations found to update.',
    };
  }
  return await runBatchSelected(
    installed.map((p) => ({ id: p.id, label: p.label })),
    isQuiet,
    (platform, quiet) => updateOne(platform, quiet, version),
  );
};

// oxlint-disable-next-line max-lines-per-function -- runInteractiveUpdate orchestrates the interactive update picker (version checks, needsUpdate filtering, groupMultiselect) as a single cohesive flow; splitting would fragment the picker's state (statuses/needsUpdate) and duplicate version-check logic.
const runInteractiveUpdate = async (
  isQuiet: boolean,
  version?: string,
): Promise<PlatformResult[] | CommandResult> => {
  assertInteractiveTerminal('update');
  const installed = await Effect.runPromise(detectInstalled());
  if (installed.length === 0) {
    return {
      exitCode: 0,
      output: 'No maestria installations found to update.',
    };
  }
  const statuses = await Effect.runPromise(
    Effect.all(
      installed.flatMap((p) => {
        const platform = getPlatform(p.id);
        if (!platform) {
          return [];
        }
        return [
          Effect.all(
            [
              platform.getInstalledVersion.pipe(Effect.catchCause(() => Effect.succeed('unknown'))),
              platform.getLatestVersion.pipe(Effect.catchCause(() => Effect.succeed('unknown'))),
            ],
            { concurrency: 2 },
          ).pipe(
            Effect.map(
              ([pv, lv]) =>
                ({
                  id: p.id,
                  installedVersion: pv,
                  label: p.label,
                  latestVersion: lv,
                  needsUpdate: needsUpdateOf(pv, lv),
                }) satisfies UpdateStatus,
            ),
          ),
        ];
      }),
      { concurrency: 1 },
    ),
  );
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
  const toUpdate = needsUpdate.filter((s) => selected.includes(s.id));
  const selections = toUpdate.flatMap((p) =>
    getPlatform(p.id) === undefined ? [] : [{ id: p.id, label: p.label }],
  );
  return await runBatchSelected(selections, isQuiet, (platform, quiet) =>
    updateOne(platform, quiet, version),
  );
};

export const handleUpdate = async (args: UpdateArgs): Promise<CommandResult> => {
  const isQuiet = resolveBatchQuiet(args);
  let platformIds: string[] | undefined;
  if (args.platform !== undefined && args.platform !== null && args.platform !== '') {
    platformIds = await validateOrThrow(validatePlatforms(args.platform));
  }
  if (args.version !== undefined && args.version !== null && args.version !== '') {
    await validateOrThrow(validateVersion(args.version));
  }
  let results: PlatformResult[];
  if (platformIds && platformIds.length > 0) {
    results = await runBatchSelected(
      platformIds.map((id) => ({ id })),
      isQuiet,
      (platform, quiet) => updateOne(platform, quiet, args.version),
    );
  } else if (args.all === true) {
    const outcome = await runAllUpdate(isQuiet, args.version);
    if (!Array.isArray(outcome)) {
      return outcome;
    }
    results = outcome;
  } else {
    const outcome = await runInteractiveUpdate(isQuiet, args.version);
    if (!Array.isArray(outcome)) {
      return outcome;
    }
    results = outcome;
  }
  return batchCommandResult(results, args);
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

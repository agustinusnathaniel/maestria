import { cancel, isCancel } from '@clack/prompts';
import { defineCommand } from 'citty';
import { Effect } from 'effect';
import picocolors from 'picocolors';

import { detectInstalled } from '@/lib/detect.js';
import { needsUpdateOf } from '@/lib/freshness.js';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { createSpinner, renderCompactResults, renderResults } from '@/lib/output.js';
import { getPlatform, getPlatformOrResult } from '@/lib/platforms.js';
import { updateOne } from '@/lib/platform-transaction.js';
import { exitCodeForResults } from '@/lib/result-exit.js';
import {
  VALID_PLATFORMS,
  validateOrExit,
  validatePlatforms,
  validateVersion,
} from '@/lib/validation.js';
import type { PlatformResult } from '@/types.js';

interface UpdateStatus {
  id: string;
  label: string;
  installedVersion: string;
  latestVersion: string;
  needsUpdate: boolean;
}

const runDirectUpdate = async (
  platformIds: string[],
  isQuiet: boolean,
  version?: string,
): Promise<PlatformResult[]> =>
  await Effect.runPromise(
    Effect.all(
      platformIds.map((id) => {
        const platform = getPlatformOrResult(id);
        return 'ok' in platform ? Effect.succeed(platform) : updateOne(platform, isQuiet, version);
      }),
      { concurrency: 1 },
    ),
  );

const runAllUpdate = async (isQuiet: boolean, version?: string): Promise<PlatformResult[]> => {
  const spinner = createSpinner(isQuiet);
  spinner.start('Detecting platforms...');
  const installed = await Effect.runPromise(detectInstalled());
  spinner.stop('Done');
  if (installed.length === 0) {
    console.log('No maestria installations found to update.');
    process.exit(0);
  }
  return await Effect.runPromise(
    Effect.all(
      installed.map((p) => {
        const platform = getPlatformOrResult(p.id, p.label);
        return 'ok' in platform ? Effect.succeed(platform) : updateOne(platform, isQuiet, version);
      }),
      { concurrency: 1 },
    ),
  );
};

// oxlint-disable-next-line max-lines-per-function -- runInteractiveUpdate orchestrates the interactive update picker (version checks, needsUpdate filtering, groupMultiselect) as a single cohesive flow; splitting would fragment the picker's state (statuses/needsUpdate) and duplicate version-check logic.
const runInteractiveUpdate = async (
  isQuiet: boolean,
  version?: string,
): Promise<PlatformResult[]> => {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    console.error('No platform specified and not in an interactive terminal.');
    console.error('Usage: maestria update <platform> or maestria update --all');
    console.error("Run 'maestria update --help' for details.");
    process.exit(1);
  }
  const installed = await Effect.runPromise(detectInstalled());
  if (installed.length === 0) {
    console.log('No maestria installations found to update.');
    process.exit(0);
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
    console.log(`\nAll platforms are up to date.\n${lines}\n`);
    process.exit(0);
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
    process.exit(130);
  }
  const toUpdate = needsUpdate.filter((s) => selected.includes(s.id));
  return await Effect.runPromise(
    Effect.all(
      toUpdate.flatMap((p) => {
        const platform = getPlatform(p.id);
        return platform === undefined ? [] : [updateOne(platform, isQuiet, version)];
      }),
      { concurrency: 1 },
    ),
  );
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
  run: async ({ args }) => {
    const isQuiet = args.quiet || args.compact;
    const isCompact = args.compact;
    let platformIds: string[] | undefined;
    if (args.platform !== undefined && args.platform !== null && args.platform !== '') {
      platformIds = await validateOrExit(validatePlatforms(args.platform));
    }
    if (args.version !== undefined && args.version !== null && args.version !== '') {
      await validateOrExit(validateVersion(args.version));
    }
    const results: PlatformResult[] = [];
    if (platformIds && platformIds.length > 0) {
      results.push(...(await runDirectUpdate(platformIds, isQuiet, args.version)));
    } else if (args.all) {
      results.push(...(await runAllUpdate(isQuiet, args.version)));
    } else {
      results.push(...(await runInteractiveUpdate(isQuiet, args.version)));
    }
    if (args.json) {
      console.log(JSON.stringify(results, null, 2));
    } else if (isCompact) {
      console.log(renderCompactResults(results));
    } else {
      console.log(renderResults(results));
    }
    process.exit(exitCodeForResults(results));
  },
});

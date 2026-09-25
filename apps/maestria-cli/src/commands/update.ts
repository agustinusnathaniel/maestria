import { cancel, isCancel } from '@clack/prompts';
import { defineCommand } from 'citty';
import { Effect } from 'effect';
import picocolors from 'picocolors';

import {
  assertInteractiveTerminal,
  detectInstalledOr,
  resolveBatchQuiet,
} from '@/lib/batch-command.js';
import { toCommandRun } from '@/lib/command-runner.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import { detectInstalled } from '@/lib/detect.js';
import { needsUpdateOf } from '@/lib/freshness.js';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { getPlatform } from '@/lib/platforms.js';
import { updateOne } from '@/lib/platform-transaction.js';
import { normalizeSkillArgs, runSkillBatch } from '@/lib/skill-reconcile.js';
import { readSkillsRecord, validateSkillFlags } from '@/lib/skills.js';
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
  excludeSkills?: string;
  json?: boolean;
  platform?: string;
  quiet?: boolean;
  skills?: string;
  version?: string;
  yes?: boolean;
}

interface UpdateStatus {
  id: string;
  label: string;
  installedVersion: string;
  latestVersion: string;
  needsUpdate: boolean;
}

// oxlint-disable-next-line max-lines-per-function -- interactive update picker keeps version checks, filtering, and selection in one flow.
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
  return toUpdate.flatMap((p) =>
    getPlatform(p.id) === undefined ? [] : [{ id: p.id, label: p.label }],
  );
};

/**
 * Skill-only review when every installed plugin is already current. The
 * plugin step is a reported no-op per platform while companions reconcile
 * normally through the shared install/update tail.
 */
const reviewCurrentInstallSkills = async (
  args: UpdateArgs,
  record: SkillsRecord | null,
  upToDate: CommandResult,
  isQuiet: boolean,
): Promise<CommandResult> => {
  const installed = await Effect.runPromise(detectInstalled());
  if (installed.length === 0) {
    return upToDate;
  }
  const targets = installed.map((p) => ({ id: p.id, label: p.label }));
  return await runSkillBatch(
    targets,
    record,
    'Update',
    args,
    isQuiet,
    (platform) =>
      Effect.succeed({
        id: platform.id,
        label: platform.label,
        message: 'Already up to date',
        ok: true,
      }),
    { updateBootstrap: true },
  );
};

export const handleUpdate = async (rawArgs: UpdateArgs): Promise<CommandResult> => {
  const args = normalizeSkillArgs(rawArgs);
  const isQuiet = resolveBatchQuiet(args);
  let platformIds: string[] | undefined;
  if (args.platform !== undefined && args.platform !== null && args.platform !== '') {
    platformIds = await validateOrThrow(validatePlatforms(args.platform));
  }
  if (args.version !== undefined && args.version !== null && args.version !== '') {
    await validateOrThrow(validateVersion(args.version));
  }
  const record = await readSkillsRecord();
  validateSkillFlags(platformIds ?? [], args, record);

  let targets: { id: string; label?: string }[];
  if (platformIds && platformIds.length > 0) {
    targets = platformIds.map((id) => ({ id }));
  } else if (args.all === true) {
    const outcome = await detectInstalledOr(isQuiet, 'No maestria installations found to update.');
    if (!Array.isArray(outcome)) {
      return outcome;
    }
    targets = outcome;
  } else {
    const outcome = await collectInteractiveUpdateTargets();
    if (!Array.isArray(outcome)) {
      return await reviewCurrentInstallSkills(args, record, outcome, isQuiet);
    }
    targets = outcome;
  }
  // Same-version updates skip the plugin reinstall but still reconcile the
  // companion independently.
  return await runSkillBatch(
    targets,
    record,
    'Update',
    args,
    isQuiet,
    (platform, quiet) => updateOne(platform, quiet, args.version),
    { updateBootstrap: true },
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
    'exclude-skills': {
      description:
        'Methodology skills to skip (CSV). Never touches independently installed copies.',
      required: false,
      type: 'string',
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
    skills: {
      description:
        "Methodology skills to activate (CSV, or 'none' for no skills). Default: recorded selection, else create-pull-request for legacy installs without a record. Known: create-pull-request, docs-update. Validated before any change.",
      required: false,
      type: 'string',
    },
    version: {
      alias: 'V',
      description: 'Target version to install (e.g., 0.5.0). Defaults to latest available version.',
      required: false,
      type: 'string',
    },
    yes: {
      alias: 'y',
      default: false,
      description:
        'Confirm skill selection non-interactively (required for non-TTY when it changes).',
      type: 'boolean',
    },
  },
  meta: {
    description: 'Update maestria plugins to the latest (or specified) version',
    name: 'update',
  },
  run: toCommandRun(handleUpdate),
});

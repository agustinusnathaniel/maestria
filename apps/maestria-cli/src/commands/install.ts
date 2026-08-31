import { isCancel, cancel } from '@clack/prompts';
import { defineCommand } from 'citty';
import { Effect } from 'effect';

import { detectAll } from '@/lib/detect.js';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { installOne } from '@/lib/install-one.js';
import { createSpinner, renderResults, renderCompactResults } from '@/lib/output.js';
import { getPlatform } from '@/lib/platforms.js';
import { exitCodeForResults } from '@/lib/result-exit.js';
import { validatePlatforms, validateOrExit, VALID_PLATFORMS } from '@/lib/validation.js';
import type { PlatformResult } from '@/types.js';

async function runInstallAll(isQuiet: boolean): Promise<PlatformResult[]> {
  const spinner = createSpinner(isQuiet);
  spinner.start('Detecting platforms...');
  const allPlatforms = await Effect.runPromise(detectAll());
  spinner.stop('Done');
  const toInstall = allPlatforms.filter((s) => s.available && !s.installed);
  if (toInstall.length === 0) {
    console.log('All detected platforms already have maestria installed.');
    process.exit(0);
  }
  spinner.start('Preparing...');
  const results: PlatformResult[] = [];
  for (const p of toInstall) {
    const platform = getPlatform(p.id);
    if (!platform) {
      results.push({
        id: p.id,
        label: p.label,
        message: 'Platform definition not found. This is a bug.',
        ok: false,
      } satisfies PlatformResult);
      continue;
    }
    spinner.message(`Installing ${p.label}...`);
    const result = await Effect.runPromise(
      Effect.gen(function* result() {
        yield* platform.install;
        return { id: platform.id, label: platform.label, message: 'Installed', ok: true };
      }).pipe(
        Effect.catchTag('CommandError', (error) =>
          Effect.succeed({
            id: platform.id,
            label: platform.label,
            message: error.message,
            ok: false,
          } satisfies PlatformResult),
        ),
      ),
    );
    spinner.message(
      result.ok ? `✓ ${p.label} installed` : `✗ ${p.label} failed: ${result.message}`,
    );
    results.push(result);
  }
  spinner.stop('Done');
  return results;
}

async function runInstallInteractive(isQuiet: boolean): Promise<PlatformResult[]> {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    console.error('No platform specified and not in an interactive terminal.');
    console.error('Usage: maestria install <platform> or maestria install --all');
    console.error("Run 'maestria install --help' for details.");
    process.exit(1);
  }
  const spinner = createSpinner(isQuiet);
  spinner.start('Detecting platforms...');
  const allPlatforms = await Effect.runPromise(detectAll());
  spinner.stop('Done');
  const installable = allPlatforms.filter((s) => s.available && !s.installed);
  if (installable.length === 0) {
    if (allPlatforms.every((s) => !s.available)) {
      console.log('No supported coding agent platforms detected on this machine.');
    } else {
      console.log('Maestria is already installed for all detected platforms.');
    }
    process.exit(0);
  }
  const selected = await groupMultiselect({
    message: 'Which platforms do you want to install maestria for?',
    options: {
      'All platforms': installable.map((p) => ({ label: p.label, value: p.id })),
    },
    required: true,
    selectableGroups: true,
  });
  if (
    isCancel(selected) ||
    selected === undefined ||
    selected === null ||
    (selected as unknown) === '' ||
    (Array.isArray(selected) && selected.length === 0)
  ) {
    cancel('Install cancelled.');
    process.exit(130);
  }
  const results: PlatformResult[] = [];
  for (const id of selected) {
    const platform = getPlatform(id);
    if (!platform) {
      results.push({
        id,
        label: id,
        message: 'Platform definition not found. This is a bug.',
        ok: false,
      } satisfies PlatformResult);
      continue;
    }
    results.push(await Effect.runPromise(installOne(platform, isQuiet)));
  }
  return results;
}

export const installCommand = defineCommand({
  args: {
    all: {
      alias: 'a',
      default: false,
      description: 'Install for all detected platforms that are not yet installed',
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
      description:
        `Platform(s) to install. Comma-separated for multiple (e.g., opencode,pi). ` +
        `One of: ${VALID_PLATFORMS.join(', ')}. ` +
        'Pass directly to skip interactive selection.',
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
    description: 'Install maestria plugins for coding agent platforms',
    name: 'install',
  },
  run: async ({ args }) => {
    const isQuiet = args.quiet || args.compact;
    const isCompact = args.compact;
    let platformIds: string[] | undefined;
    if (args.platform !== undefined && args.platform !== null && args.platform !== '') {
      platformIds = await validateOrExit(validatePlatforms(args.platform));
    }
    const results: PlatformResult[] = [];
    if (platformIds && platformIds.length > 0) {
      for (const id of platformIds) {
        const platform = getPlatform(id);
        if (!platform) {
          results.push({
            id,
            label: id,
            message: 'Platform definition not found. This is a bug.',
            ok: false,
          } satisfies PlatformResult);
          continue;
        }
        results.push(await Effect.runPromise(installOne(platform, isQuiet)));
      }
    } else if (args.all) {
      results.push(...(await runInstallAll(isQuiet)));
    } else {
      results.push(...(await runInstallInteractive(isQuiet)));
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

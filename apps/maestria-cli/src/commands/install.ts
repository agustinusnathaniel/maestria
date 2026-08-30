import { defineCommand } from 'citty';
import { Effect } from 'effect';
import { isCancel, cancel } from '@clack/prompts';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { getPlatform } from '@/lib/platforms.js';
import { detectAll } from '@/lib/detect.js';
import { installOne } from '@/lib/install-one.js';
import { createSpinner, renderResults, renderCompactResults } from '@/lib/output.js';
import { validatePlatforms, validateOrExit, VALID_PLATFORMS } from '@/lib/validation.js';
import { exitCodeForResults } from '@/lib/result-exit.js';
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
        ok: false,
        message: 'Platform definition not found. This is a bug.',
      } satisfies PlatformResult);
      continue;
    }
    spinner.message(`Installing ${p.label}...`);
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* platform.install;
        return { id: platform.id, label: platform.label, ok: true, message: 'Installed' };
      }).pipe(
        Effect.catchTag('CommandError', (error) =>
          Effect.succeed({
            id: platform.id,
            label: platform.label,
            ok: false,
            message: error.message,
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
    if (allPlatforms.every((s) => !s.available))
      console.log('No supported coding agent platforms detected on this machine.');
    else console.log('Maestria is already installed for all detected platforms.');
    process.exit(0);
  }
  const selected = await groupMultiselect({
    message: 'Which platforms do you want to install maestria for?',
    options: { 'All platforms': installable.map((p) => ({ value: p.id, label: p.label })) },
    selectableGroups: true,
    required: true,
  });
  if (isCancel(selected) || !selected || (Array.isArray(selected) && selected.length === 0)) {
    cancel('Install cancelled.');
    process.exit(130);
  }
  const results: PlatformResult[] = [];
  for (const id of selected as string[]) {
    const platform = getPlatform(id);
    if (!platform) {
      results.push({
        id,
        label: id,
        ok: false,
        message: 'Platform definition not found. This is a bug.',
      } satisfies PlatformResult);
      continue;
    }
    results.push(await Effect.runPromise(installOne(platform, isQuiet)));
  }
  return results;
}

export const installCommand = defineCommand({
  meta: {
    name: 'install',
    description: 'Install maestria plugins for coding agent platforms',
  },
  args: {
    platform: {
      type: 'positional',
      description:
        `Platform(s) to install. Comma-separated for multiple (e.g., opencode,pi). ` +
        `One of: ${VALID_PLATFORMS.join(', ')}. ` +
        'Pass directly to skip interactive selection.',
      required: false,
    },
    all: {
      type: 'boolean',
      description: 'Install for all detected platforms that are not yet installed',
      alias: 'a',
      default: false,
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
    let platformIds: string[] | undefined;
    if (args.platform)
      platformIds = await validateOrExit(validatePlatforms(args.platform as string));
    const results: PlatformResult[] = [];
    if (platformIds && platformIds.length > 0) {
      for (const id of platformIds) {
        const platform = getPlatform(id);
        if (!platform) {
          results.push({
            id,
            label: id,
            ok: false,
            message: 'Platform definition not found. This is a bug.',
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
    if (args.json) console.log(JSON.stringify(results, null, 2));
    else if (isCompact) console.log(renderCompactResults(results));
    else console.log(renderResults(results));
    process.exit(exitCodeForResults(results));
  },
});

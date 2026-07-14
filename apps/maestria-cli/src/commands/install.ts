import { defineCommand } from 'citty';
import { Effect } from 'effect';
import { isCancel, cancel } from '@clack/prompts';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { getPlatform } from '@/lib/platforms.js';
import { detectAll } from '@/lib/detect.js';
import { installOne } from '@/lib/install-one.js';
import { createSpinner, renderResults, renderCompactResults } from '@/lib/output.js';
import { validatePlatforms, validateOrExit } from '@/lib/validation.js';
import type { PlatformResult } from '@/types.js';

export const installCommand = defineCommand({
  meta: {
    name: 'install',
    description: 'Install maestria plugins for coding agent platforms',
  },
  args: {
    platform: {
      type: 'positional',
      description:
        'Platform(s) to install. Comma-separated for multiple (e.g., opencode,pi). ' +
        'One of: opencode, pi, kimi-code. Pass directly to skip interactive selection.',
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

    // Validate CLI args
    let platformIds: string[] | undefined;
    if (args.platform) {
      platformIds = await validateOrExit(validatePlatforms(args.platform as string));
    }

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
        const result = await Effect.runPromise(installOne(platform, isQuiet));
        results.push(result);
      }
    } else if (args.all) {
      // Install for all detected platforms
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
    } else {
      // Non-TTY guard: don't try interactive prompts
      if (!process.stdout.isTTY || !process.stdin.isTTY) {
        console.error('No platform specified and not in an interactive terminal.');
        console.error('Usage: maestria install <platform> or maestria install --all');
        console.error("Run 'maestria install --help' for details.");
        process.exit(1);
      }

      // Interactive: ask which platform
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
          'All platforms': installable.map((p) => ({
            value: p.id,
            label: p.label,
          })),
        },
        selectableGroups: true,
        required: true,
      });

      if (isCancel(selected) || !selected || (Array.isArray(selected) && selected.length === 0)) {
        cancel('Install cancelled.');
        process.exit(130);
      }

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
        const result = await Effect.runPromise(installOne(platform, isQuiet));
        results.push(result);
      }
    }

    if (args.json) {
      console.log(JSON.stringify(results, null, 2));
    } else if (isCompact) {
      console.log(renderCompactResults(results));
    } else {
      console.log(renderResults(results));
    }
    process.exit(0);
  },
});

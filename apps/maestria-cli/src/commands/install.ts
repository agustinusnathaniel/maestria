import { defineCommand } from 'citty';
import { Effect } from 'effect';
import { select, isCancel, cancel } from '@clack/prompts';
import { platforms, getPlatform } from '../lib/platforms.js';
import { detectAll } from '../lib/detect.js';
import { installOne } from '../lib/install-one.js';
import { createSpinner, renderResults } from '../lib/output.js';
import type { PlatformResult } from '../types.js';

export const installCommand = defineCommand({
  meta: {
    name: 'install',
    description: 'Install maestria plugins for coding agent platforms',
  },
  args: {
    platform: {
      type: 'positional',
      description: 'Platform to install (opencode, pi, kimi-code). Omit for interactive selection.',
      required: false,
    },
    all: {
      type: 'boolean',
      description: 'Install for all detected platforms',
      alias: 'a',
      default: false,
    },
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Suppress spinners',
      default: false,
    },
  },
  run: async ({ args }) => {
    const results: PlatformResult[] = [];

    if (args.platform) {
      // Install a specific platform
      const platform = getPlatform(args.platform as string);
      if (!platform) {
        console.error(`Unknown platform: ${args.platform}`);
        console.error(`Available: ${platforms.map((p) => p.id).join(', ')}`);
        return;
      }

      const result = await Effect.runPromise(installOne(platform, args.quiet as boolean));
      results.push(result);
    } else if (args.all) {
      // Install for all detected platforms
      const allPlatforms = await Effect.runPromise(detectAll());
      const toInstall = allPlatforms.filter((s) => s.available && !s.installed);

      if (toInstall.length === 0) {
        console.log('All detected platforms already have maestria installed.');
        return;
      }

      const spinner = createSpinner(args.quiet as boolean);
      spinner.start('Preparing...');
      for (const p of toInstall) {
        spinner.message(`Installing ${p.label}...`);
        const platform = getPlatform(p.id)!;
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
      // Interactive: ask which platform
      const allPlatforms = await Effect.runPromise(detectAll());
      const installable = allPlatforms.filter((s) => s.available && !s.installed);

      if (installable.length === 0) {
        if (allPlatforms.every((s) => !s.available)) {
          console.log('No supported coding agent platforms detected on this machine.');
        } else {
          console.log('Maestria is already installed for all detected platforms.');
        }
        return;
      }

      const selected = await select({
        message: 'Which platform do you want to install maestria for?',
        options: installable.map((p) => ({
          value: p.id,
          label: p.label,
        })),
      });

      if (isCancel(selected) || !selected) {
        cancel('Install cancelled.');
        return;
      }

      const platform = getPlatform(String(selected))!;
      const result = await Effect.runPromise(installOne(platform, args.quiet as boolean));
      results.push(result);
    }

    if (args.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(renderResults(results));
    }
  },
});

#!/usr/bin/env node
import { version } from '^/package.json';
import { defineCommand, runMain, renderUsage } from 'citty';
import { Effect } from 'effect';
import type { CommandDef, ArgsDef } from 'citty';
import { installCommand } from '@/commands/install.js';
import { updateCommand } from '@/commands/update.js';
import { uninstallCommand } from '@/commands/uninstall.js';
import { statusCommand } from '@/commands/status.js';
import { checkCommand } from '@/commands/check.js';
import { detectAll } from '@/lib/detect.js';
import { createSpinner, renderStatusTable, renderCompactStatus } from '@/lib/output.js';

// Ensure clean exit on signals - prevents Effect runtime from keeping process alive
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(0));

// ── Custom --help ────────────────────────────────────

const SECTIONS: Record<string, { examples: string[]; tip?: string }> = {
  maestria: {
    examples: [
      'maestria                          Show status of all platforms',
      'maestria --json                   Show status as JSON (token-optimized for AI agents)',
      'maestria --quiet                  Suppress spinner output',
      'maestria --compact                Minimal machine-friendly output',
      'maestria --version                Show version',
      'maestria install opencode         Install for a specific platform',
      'maestria install opencode,pi      Install for multiple platforms at once',
      'maestria install --all            Install for all detected platforms',
      'maestria update pi                Update Pi platform to latest',
      'maestria update opencode -V 0.5.0 Update to specific version',
      'maestria update opencode,pi       Update multiple platforms at once',
      'maestria install hermes           Install for Hermes agent',
      'maestria --help                   Show this help',
    ],
    tip: [
      'Use --json for structured machine-readable output.',
      'Use --compact for minimal token-efficient text output.',
      'Use a positional platform arg (or comma-separated list), --all, or interactive prompts.',
      'For CI pipelines, add --quiet to suppress spinner control sequences.',
    ].join('\n'),
  },
  install: {
    examples: [
      'maestria install opencode         Install for a specific platform',
      'maestria install opencode,pi      Install for multiple platforms at once',
      'maestria install --all            Install for all detected platforms',
      'maestria install --json           Output results as JSON',
      'maestria install --quiet          Suppress spinner output',
      'maestria install hermes           Install for a specific platform',
      'maestria install --compact        Minimal machine-friendly output',
    ],
  },
  update: {
    examples: [
      'maestria update pi                Update Pi platform to latest',
      'maestria update opencode -V 0.5.0 Update to specific version',
      'maestria update --all             Update all installed platforms',
      'maestria update opencode,pi       Update multiple platforms at once',
      'maestria update --json            Output results as JSON',
      'maestria update hermes            Update Hermes to latest',
      'maestria update --compact         Minimal machine-friendly output',
    ],
  },
  status: {
    examples: [
      'maestria status                   Show status of all platforms',
      'maestria status --json            Show status as JSON',
      'maestria status --compact         Minimal machine-friendly output',
      'maestria status --quiet           Suppress spinner output',
    ],
  },
  check: {
    examples: [
      'maestria check opencode           Check if @maestria/opencode is installed',
      'maestria check hermes             Check if @maestria/hermes is installed',
      'maestria check opencode --json    Output as JSON (default)',
      'maestria check opencode --quiet   Exit code only (for scripts)',
    ],
  },
};

const EXIT_CODES = `
EXIT CODES

  0   Success
  1   Validation or command error
  130 User cancelled (interactive mode)
`;

async function showEnhancedUsage<T extends ArgsDef = ArgsDef>(
  cmd: CommandDef<T>,
  parent?: CommandDef<T>,
): Promise<void> {
  const help = await renderUsage(cmd, parent);
  const rawMeta = cmd.meta;
  const cmdMeta = rawMeta ? await (typeof rawMeta === 'function' ? rawMeta() : rawMeta) : undefined;
  const cmdName = cmdMeta?.name ?? '';
  const section = SECTIONS[cmdName];

  const parts: string[] = [help];

  if (section) {
    parts.push('');
    parts.push('EXAMPLES');
    parts.push('');
    for (const line of section.examples) {
      parts.push(`  ${line}`);
    }
  }

  parts.push(EXIT_CODES);

  if (section?.tip) {
    parts.push('');
    parts.push('TIP FOR AI AGENTS');
    parts.push('');
    for (const line of section.tip.split('\n')) {
      parts.push(`  ${line}`);
    }
  }

  console.log(parts.join('\n'));
}

// ── Main command ─────────────────────────────────────

const main = defineCommand({
  meta: {
    name: 'maestria',
    description: 'Manage maestria plugins across coding agent platforms',
  },
  args: {
    version: {
      type: 'boolean',
      description: 'Show version number',
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
    json: {
      type: 'boolean',
      description:
        'Output status as JSON - structured machine-readable format optimized for AI agents and CI pipelines',
      default: false,
    },
  },
  subCommands: {
    install: installCommand,
    update: updateCommand,
    uninstall: uninstallCommand,
    status: statusCommand,
    check: checkCommand,
  },
  run: async ({ args }) => {
    if (args.version) {
      console.log(version);
      process.exit(0);
    }

    const isQuiet = (args.quiet || args.compact) as boolean;
    const isCompact = args.compact as boolean;
    const isJson = args.json as boolean;

    const spinner = createSpinner(isQuiet);
    spinner.start('Detecting platforms...');

    const output = await Effect.runPromise(detectAll());

    if (isJson) {
      spinner.stop('');
      const jsonOutput = { platforms: output };
      console.log(JSON.stringify(jsonOutput, null, 2));
    } else if (isCompact) {
      spinner.stop('');
      console.log(renderCompactStatus(output));
    } else {
      spinner.stop('Done');
      console.log(renderStatusTable(output));
    }
    process.exit(0);
  },
});

runMain(main, { showUsage: showEnhancedUsage }).catch((error) => {
  console.error(error);
  process.exit(1);
});

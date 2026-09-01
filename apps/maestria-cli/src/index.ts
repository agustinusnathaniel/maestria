#!/usr/bin/env node
import { defineCommand, renderUsage, runMain } from 'citty';
import type { ArgsDef, CommandDef } from 'citty';
import { Effect } from 'effect';

import { checkCommand } from '@/commands/check.js';
import { configureCommand } from '@/commands/configure.js';
import { installCommand } from '@/commands/install.js';
import { pluginCommand } from '@/commands/plugin.js';
import { statusCommand } from '@/commands/status.js';
import { uninstallCommand } from '@/commands/uninstall.js';
import { updateCommand } from '@/commands/update.js';
import { detectAll } from '@/lib/detect.js';
import { createSpinner, renderCompactStatus, renderStatusTable } from '@/lib/output.js';
import { version } from '^/package.json';

// Ensure clean exit on signals - prevents Effect runtime from keeping process alive
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(0));

// ── Custom --help ────────────────────────────────────

const SECTIONS: Record<string, { examples: string[]; tip?: string }> = {
  check: {
    examples: [
      'maestria check opencode           Check if @maestria/opencode is installed',
      'maestria check hermes             Check if @maestria/hermes is installed',
      'maestria check prime-agent        Check if @maestria/prime-agent is installed',
      'maestria check --all              Check all detected platforms',
      'maestria check opencode --json    Output as JSON',
      'maestria check opencode --quiet   Exit code only (for scripts)',
    ],
  },
  configure: {
    examples: [
      'maestria configure opencode       Choose per-agent models interactively',
      'maestria configure opencode --project  Configure for the current project only',
      'maestria configure pi --set builder=opencode-go/deepseek-v4-flash  Set one model',
      'maestria configure omp --set adventurer=opencode-go/deepseek-v4-flash,writer=opencode-go/deepseek-v4-pro  Set several',
      'maestria configure pi --set builder=  Reset an agent to inherit the session model',
      'maestria configure opencode --json   Output the resulting config as JSON',
      'maestria configure --quiet            Suppress spinner output (for CI)',
    ],
    tip: [
      'Per-agent models are supported for: opencode (config file), codex (native agent TOML), cursor (native agent files), pi and omp (agent frontmatter).',
      'Use --global (default) or --project to choose the config level.',
      'For CI pipelines, pass --set with --global or --project and add --quiet.',
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
      'maestria install claude-code      Install for Claude Code',
      'maestria install codex        Install for Codex CLI',
      'maestria install prime-agent      Install for Prime Agent',
      'maestria install --compact        Minimal machine-friendly output',
    ],
  },
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
      'maestria install claude-code      Install for Claude Code',
      'maestria install codex          Install for Codex CLI',
      'maestria install prime-agent      Install for Prime Agent',
      'maestria configure opencode       Choose per-agent models interactively',
      'maestria configure codex          Configure native Codex custom-agent models',
      'maestria configure cursor        Configure native Cursor agent models',
      'maestria configure pi --set builder=opencode-go/deepseek-v4-flash  Set a model non-interactively',
      'maestria plugin install            Stage a portable Agent Plugin',
      'maestria plugin validate ./my-plugin  Validate a portable Agent Plugin directory',
      'maestria --help                   Show this help',
    ],
    tip: [
      'Use --json for structured machine-readable output.',
      'Use --compact for minimal token-efficient text output.',
      'Use a positional platform arg (or comma-separated list), --all, or interactive prompts.',
      'For CI pipelines, add --quiet to suppress spinner control sequences.',
    ].join('\n'),
  },
  plugin: {
    examples: [
      'maestria plugin validate ./my-plugin     Validate a local Agent Plugin directory',
      'maestria plugin install                 Stage @maestria/agent-plugin in the Maestria cache',
      'maestria plugin install ./my-plugin --destination ./staged-plugin  Stage a local package',
      'maestria plugin validate ./my-plugin --json  Output a validation report as JSON',
    ],
    tip: [
      "The portable workflow stages and validates a directory package; it does not replace each client's own activation or permission model.",
      'Use a client-specific plugin installer or point the client at the staged directory.',
    ].join('\n'),
  },
  status: {
    examples: [
      'maestria status                   Show status of all platforms',
      'maestria status --json            Show status as JSON',
      'maestria status --compact         Minimal machine-friendly output',
      'maestria status --quiet           Suppress spinner output',
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
      'maestria update claude-code      Update Claude Code to latest',
      'maestria update codex         Update Codex CLI to latest',
      'maestria update prime-agent      Update Prime Agent to latest',
      'maestria update --compact         Minimal machine-friendly output',
    ],
  },
};

const PLUGIN_SUBCOMMAND_SECTIONS: Record<string, { examples: string[]; tip?: string }> = {
  install: {
    examples: [
      'maestria plugin install                 Stage @maestria/agent-plugin in the Maestria cache',
      'maestria plugin install ./my-plugin     Stage a local Agent Plugin directory',
      'maestria plugin install ./my-plugin --destination ./staged-plugin  Choose the destination',
      'maestria plugin install --json          Output the staged package report as JSON',
    ],
    tip: 'The command stages a validated directory package; use the compatible client to activate it.',
  },
  validate: {
    examples: [
      'maestria plugin validate ./my-plugin       Validate a local Agent Plugin directory',
      'maestria plugin validate ./my-plugin --json  Output the validation report as JSON',
    ],
    tip: 'Validation is read-only and checks the manifest, skills, optional MCP configuration, and package paths.',
  },
};

const EXIT_CODES = `
EXIT CODES

  0   Success
  1   Validation or command error
  3   Outdated (maestria check: a newer plugin version is available)
  130 User cancelled (interactive mode)
`;

const showEnhancedUsage = async <T extends ArgsDef = ArgsDef>(
  cmd: CommandDef<T>,
  parent?: CommandDef<T>,
): Promise<void> => {
  const help = await renderUsage(cmd, parent);
  const rawMeta = cmd.meta;
  const cmdMeta = rawMeta ? await (typeof rawMeta === 'function' ? rawMeta() : rawMeta) : undefined;
  const cmdName = cmdMeta?.name ?? '';
  const rawParentMeta = parent?.meta;
  const parentMeta = rawParentMeta
    ? await (typeof rawParentMeta === 'function' ? rawParentMeta() : rawParentMeta)
    : undefined;
  const section =
    parentMeta?.name === 'plugin' ? PLUGIN_SUBCOMMAND_SECTIONS[cmdName] : SECTIONS[cmdName];

  const parts: string[] = [help];

  if (section !== null && section !== undefined) {
    parts.push('', 'EXAMPLES', '');
    for (const line of section.examples) {
      parts.push(`  ${line}`);
    }
  }

  parts.push(EXIT_CODES);

  if (section?.tip !== undefined && section?.tip !== null && section?.tip !== '') {
    parts.push('', 'TIP FOR AI AGENTS', '');
    for (const line of section.tip.split('\n')) {
      parts.push(`  ${line}`);
    }
  }

  console.log(parts.join('\n'));
};

// ── Main command ─────────────────────────────────────

const main = defineCommand({
  args: {
    compact: {
      default: false,
      description: 'Minimal machine-friendly text output. Strips colors and decorative formatting.',
      type: 'boolean',
    },
    json: {
      default: false,
      description:
        'Output status as JSON - structured machine-readable format optimized for AI agents and CI pipelines',
      type: 'boolean',
    },
    quiet: {
      default: false,
      description:
        'Suppress spinner and non-essential output. Recommended for CI and non-interactive usage.',
      type: 'boolean',
    },
    version: {
      default: false,
      description: 'Show version number',
      type: 'boolean',
    },
  },
  meta: {
    description: 'Manage maestria plugins across coding agent platforms and portable packages',
    name: 'maestria',
  },
  run: async ({ args }) => {
    if (args.version) {
      console.log(version);
      process.exit(0);
    }

    const isQuiet = args.quiet || args.compact;
    const isCompact = args.compact;
    const isJson = args.json;

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
  subCommands: {
    check: checkCommand,
    configure: configureCommand,
    install: installCommand,
    plugin: pluginCommand,
    status: statusCommand,
    uninstall: uninstallCommand,
    update: updateCommand,
  },
});

const runCli = async (): Promise<void> => {
  try {
    await runMain(main, { showUsage: showEnhancedUsage });
  } catch (error: unknown) {
    console.error(error);
    process.exit(1);
  }
};

await runCli();

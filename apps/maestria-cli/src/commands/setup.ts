import { defineCommand } from 'citty';

import { toCommandRun } from '@/lib/command-runner.js';
import type { CommandResult } from '@/lib/command-result.js';
import { runSetup } from '@/lib/setup.js';
import type { SetupArgs } from '@/lib/setup.js';

export const handleSetup = async (args: SetupArgs): Promise<CommandResult> => await runSetup(args);

export const setupCommand = defineCommand({
  args: {
    compact: {
      default: false,
      description: 'Minimal machine-friendly text output. Strips colors and decorative formatting.',
      type: 'boolean',
    },
    cwd: {
      description: 'Project directory the setup targets. Defaults to the current directory.',
      required: false,
      type: 'string',
    },
    ecosystem: {
      description:
        'Ecosystem tools to check (CSV, or omit for interactive selection). Known: codegraph, agent-browser, opensrc. Detection only; never installs automatically.',
      required: false,
      type: 'string',
    },
    'exclude-skills': {
      description:
        'Maestria methodology skills to skip (CSV). Never touches independently installed copies.',
      required: false,
      type: 'string',
    },
    json: {
      default: false,
      description:
        'Output results as JSON - structured machine-readable format optimized for AI agents and CI pipelines',
      type: 'boolean',
    },
    'maestria-skills': {
      description:
        "Alias for --skills for the Maestria methodology selection (CSV, or 'none'). --skills wins when both are set.",
      required: false,
      type: 'string',
    },
    quiet: {
      default: false,
      description:
        'Suppress spinner and non-essential output. Recommended for CI and non-interactive usage.',
      type: 'boolean',
    },
    'skill-source': {
      description:
        'Skill source to install via the skills CLI (repeatable or CSV). Format: <owner/repo:scope> with scope project or global. Skip by omitting.',
      required: false,
      type: 'string',
    },
    skills: {
      description:
        "Maestria methodology skills to activate (CSV, or 'none' for no skills). Default: recorded selection, else create-pull-request, docs-update. Validated before any change.",
      required: false,
      type: 'string',
    },
    'xtarterize-skills': {
      default: false,
      description: 'Apply project skills via xtarterize (agent/skills-install) for the target cwd.',
      type: 'boolean',
    },
    yes: {
      alias: 'y',
      default: false,
      description: 'Confirm all setup actions non-interactively (required for non-TTY).',
      type: 'boolean',
    },
  },
  meta: {
    description:
      'Coordinate optional project setup across ecosystem tools and skills (nothing runs before confirm)',
    name: 'setup',
  },
  run: toCommandRun(handleSetup),
});

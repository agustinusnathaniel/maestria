// packages/pi/sync-skills.config.ts
// Sync config: generates Pi skill files from canonical agent directives
//
// Skills are Pi's standard mechanism for injecting behavioral instructions
// into the system prompt. See https://pi.dev/docs/latest/skills
//
// This config processes only orchestrator.md and rules.md from the canonical
// sources and wraps them in SKILL.md format with proper frontmatter.

import type { SyncConfig } from '../core/scripts/lib/config.js';

export default {
  // Source is the core agent-directives directory (parent dir of specialists/)
  // which contains both the specialists/ subdir and rules.md at root level.
  // walkDir does recursive enumeration, so specialists/orchestrator.md will
  // be found and matched by basename (orchestrator.md) against config.files.
  source: '../core/agent-directives',

  // Temp dir for non-skill files from the source that get processed with defaults
  // (adventurer.md, architect.md, etc. - we only want orchestrator.md and rules.md)
  output: '.sync-temp/skills',

  // Default processing for non-explicit files (they go to .sync-temp/ and are ignored)
  default: {
    stripFrontmatter: true,
    replace: [
      { from: '@adventurer', to: '/adventurer' },
      { from: '@architect', to: '/architect' },
      { from: '@builder', to: '/builder' },
      { from: '@diagnose', to: '/diagnose' },
      { from: '@planner', to: '/planner' },
      { from: '@reviewer', to: '/reviewer' },
      { from: '@writer', to: '/writer' },
      { from: 'task(', to: 'maestria_subagent(' },
      { from: '@orchestrator', to: '/orchestrator' },
    ],
  },

  // Explicit file entries - these are the ones we actually want as skills
  files: {
    // orchestrator.md comes from specialists/orchestrator.md (in source dir)
    // We navigate up from .sync-temp/skills to packages/pi root then into skills/
    'orchestrator.md': {
      output: '../../skills/orchestrator/SKILL.md',
      prepend:
        '---\n' +
        'name: orchestrator\n' +
        'description: >-\n' +
        '  Maestria agent orchestration dispatcher. Delegates work to 7 specialist\n' +
        '  subagents (adventurer, architect, builder, diagnose, planner, reviewer, writer)\n' +
        '  using spec-driven handoffs. Enforces maker/checker split, commit protocol,\n' +
        '  and role-based pipeline sequencing.\n' +
        '---\n' +
        '\n',
    },

    // rules.md comes from ../core/agent-directives/rules.md (secondary source)
    'rules.md': {
      output: '../../skills/global-rules/SKILL.md',
      prepend:
        '---\n' +
        'name: global-rules\n' +
        'description: >-\n' +
        '  Global behavioral constraints and best practices for maestria-powered\n' +
        '  Pi agents. Covers orchestration conventions, delegation rules, context\n' +
        '  management, commit policy, pipeline patterns, and branch discipline.\n' +
        '---\n' +
        '\n',
    },
  },

  preserve: ['.gitkeep'],
} satisfies SyncConfig;

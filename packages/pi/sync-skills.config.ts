// packages/pi/sync-skills.config.ts
// Sync config: generates Pi skill files from canonical agent directives.
//
// Skills are Pi's standard mechanism for injecting behavioral instructions
// into the system prompt. See https://pi.dev/docs/latest/skills
//
// Only orchestrator.md and rules.md produce skill outputs. All other
// specialist files are redirected to .sync-temp/ since they are handled
// by sync.config.ts as pi-subagents agent type files.

import type { SyncConfig } from '../core/scripts/lib/config.js';

export default {
  source: '../core/agent-directives/specialists',
  output: '.sync-temp/skills',

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

  files: {
    // orchestrator.md -> skills/orchestrator/SKILL.md (Pi skill)
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

    // rules.md -> skills/global-rules/SKILL.md (Pi skill)
    // Found via secondary source loop from dirname(source) = ../core/agent-directives/
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

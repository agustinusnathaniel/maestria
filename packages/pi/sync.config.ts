// packages/pi/sync.config.ts
// Sync config: derives pi prompt files from canonical core directives

import type { SyncConfig } from '../core/scripts/lib/config.js';

export default {
  source: '../core/agent-directives/specialists',
  output: 'prompts',

  default: {
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
    'rules.md': {
      output: '../rules/AGENTS.md',
    },
  },
} satisfies SyncConfig;

import type { SyncConfig } from '../../core/scripts/lib/config.js';

export default {
  files: {
    'instructions.md': {
      output: 'instructions/AGENTS.md',
      source: '../../core/agent-directives/integrations/codex-instructions.md',
    },
  },
  output: '../rules/codex',
  source: './sources',
} satisfies SyncConfig;

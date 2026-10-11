import type { SyncConfig } from '../../core/scripts/lib/config.js';

export default {
  files: {
    'instructions.md': {
      output: '../rules/codex/instructions/AGENTS.md',
      source: '../../core/agent-directives/integrations/codex-instructions.md',
    },
  },
  source: './sources',
} satisfies SyncConfig;

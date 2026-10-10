import type { SyncConfig } from '../../core/scripts/lib/config.js';

export default {
  files: {
    'global-rules.md': {
      output: 'global-rules.md',
      source: '../../core/agent-directives/rules.md',
    },
  },
  output: '../rules/global',
  source: './sources',
} satisfies SyncConfig;

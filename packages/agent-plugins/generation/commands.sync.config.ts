import type { SyncConfig } from '../../core/scripts/lib/config.js';

export default {
  files: {
    'blitz.md': { output: 'blitz.md' },
    'fein.md': { output: 'fein.md' },
    'sonar.md': { output: 'sonar.md' },
  },
  output: '../commands/modes',
  source: '../../core/agent-directives/commands',
} satisfies SyncConfig;

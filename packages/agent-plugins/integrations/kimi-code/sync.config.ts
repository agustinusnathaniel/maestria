import type { SyncConfig } from '../../../core/scripts/lib/config.js';

export default {
  files: {
    'blitz.md': {
      frontmatter: {
        description: "Apply the shared blitz workflow to the user's request",
        name: 'blitz',
      },
      replace: [
        {
          from: '@@MODE@@',
          to: 'blitz',
        },
      ],
      source: '../../../core/agent-directives/aliases/workflow.md',
    },
    'fein.md': {
      frontmatter: {
        description: "Apply the shared fein workflow to the user's request",
        name: 'fein',
      },
      replace: [
        {
          from: '@@MODE@@',
          to: 'fein',
        },
      ],
      source: '../../../core/agent-directives/aliases/workflow.md',
    },
    'sonar.md': {
      frontmatter: {
        description: "Apply the shared sonar workflow to the user's request",
        name: 'sonar',
      },
      replace: [
        {
          from: '@@MODE@@',
          to: 'sonar',
        },
      ],
      source: '../../../core/agent-directives/aliases/workflow.md',
    },
    'specialists/orchestrator.md': {
      output: '../context.md',
      source: '../../../core/agent-directives/integrations/kimi-code.md',
    },
  },
  output: './commands',
  source: '../../../core/agent-directives/commands',
} satisfies SyncConfig;

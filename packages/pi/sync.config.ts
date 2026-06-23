// packages/pi/sync.config.ts
// Sync config: derives pi prompt files from canonical core directives

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
    'adventurer.md': {
      prepend:
        '<!-- Source: packages/core/agent-directives/specialists/adventurer.md — keep in sync when updating -->\n',
    },
    'architect.md': {
      prepend:
        '<!-- Source: packages/core/agent-directives/specialists/architect.md — keep in sync when updating -->\n',
    },
    'builder.md': {
      prepend:
        '<!-- Source: packages/core/agent-directives/specialists/builder.md — keep in sync when updating -->\n',
    },
    'diagnose.md': {
      prepend:
        '<!-- Source: packages/core/agent-directives/specialists/diagnose.md — keep in sync when updating -->\n',
    },
    'planner.md': {
      prepend:
        '<!-- Source: packages/core/agent-directives/specialists/planner.md — keep in sync when updating -->\n',
    },
    'reviewer.md': {
      prepend:
        '<!-- Source: packages/core/agent-directives/specialists/reviewer.md — keep in sync when updating -->\n',
    },
    'writer.md': {
      prepend:
        '<!-- Source: packages/core/agent-directives/specialists/writer.md — keep in sync when updating -->\n',
    },
    'orchestrator.md': {
      prepend:
        '<!-- Source: packages/core/agent-directives/specialists/orchestrator.md — keep in sync when updating -->\n',
    },
  },
};

import type { SyncConfig } from '../../core/scripts/lib/config.js';

const workflowSource = '../../core/agent-directives/aliases/workflow.md';

const alias = (mode: string) => ({
  frontmatter: {
    description: `Apply the shared ${mode} workflow to the user's request`,
    name: mode,
  },
  output: `../commands/kimi-code/${mode}.md`,
  replace: [{ from: '@@MODE@@', to: mode }],
  source: workflowSource,
});

export default {
  files: {
    'blitz.md': alias('blitz'),
    'fein.md': alias('fein'),
    'sonar.md': alias('sonar'),
  },
  source: './sources',
} satisfies SyncConfig;

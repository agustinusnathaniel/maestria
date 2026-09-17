import type { PluginInput } from '@opencode-ai/plugin';

const unusedInputDependency = (name: string): never => {
  throw new Error(`The plugin test must not access ${name}`);
};

export const pluginInput = {
  get $(): PluginInput['$'] {
    return unusedInputDependency('shell');
  },
  get client(): PluginInput['client'] {
    return unusedInputDependency('client');
  },
  directory: '/tmp/opencode-plugin-test',
  experimental_workspace: {
    register: () => unusedInputDependency('workspace register'),
  },
  project: {
    id: 'test-project',
    time: { created: 0 },
    worktree: '/tmp/opencode-plugin-test',
  },
  serverUrl: new URL('http://localhost:4096'),
  worktree: '/tmp/opencode-plugin-test',
} satisfies PluginInput;

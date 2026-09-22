import type { PluginInput } from '@opencode-ai/plugin';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

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

// Input rooted at a directory without touching the throwing $/client getters.
export const pluginInputForRoot = (root: string): PluginInput => ({
  get $(): PluginInput['$'] {
    return unusedInputDependency('shell');
  },
  get client(): PluginInput['client'] {
    return unusedInputDependency('client');
  },
  directory: root,
  experimental_workspace: pluginInput.experimental_workspace,
  project: { ...pluginInput.project, worktree: root },
  serverUrl: pluginInput.serverUrl,
  worktree: root,
});

// Shared builders; the full loader contract lives in @maestria/shared-pi tests.
export const makeTempRoot = (): string => mkdtempSync(path.join(tmpdir(), 'maestria-project-'));

export const writeProjectFile = (root: string, rel: string, content: string): string => {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
};

export const removeRoot = (root: string): void => {
  rmSync(root, { force: true, recursive: true });
};

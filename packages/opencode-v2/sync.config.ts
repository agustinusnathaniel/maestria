// packages/opencode-v2/sync.config.ts
// Sync config: projects the OpenCode V1 agent, command, and rules inventory into V2 agent frontmatter.
//
// V2 takes ordered `permissions` rules where V1 takes a `permission` map; both are last-match-wins,
// so translating each map entry in declaration order preserves the effective V1 policy. V1's
// `bash` and `task` permissions are V2's `shell` and `subagent` actions; scalar effects apply to
// resource `*`. Deriving from the V1 config keeps one maintained OpenCode policy. Commands keep
// their canonical frontmatter, whose description the plugin registers with each slash command.

import type { FileConfig, SyncConfig } from '../core/scripts/lib/config.js';
import v1 from '../opencode/sync.config.js';

const V2_ACTIONS: Record<string, string> = { bash: 'shell', task: 'subagent' };

type V1File = (typeof v1.files)[keyof typeof v1.files];

const toPermissions = (permission: Record<string, string | Record<string, string>>) =>
  Object.entries(permission).flatMap(([tool, value]) => {
    const action = V2_ACTIONS[tool] ?? tool;
    return typeof value === 'string'
      ? [{ action, effect: value, resource: '*' }]
      : Object.entries(value).map(([resource, effect]) => ({
          action,
          effect,
          resource,
        }));
  });

const toV2 = (name: string, file: V1File): FileConfig => {
  if (name.startsWith('commands/')) {
    return { ...file, stripFrontmatter: false };
  }
  if (!('frontmatter' in file)) {
    return file;
  }
  const { permission, ...rest } = file.frontmatter;
  return {
    ...file,
    frontmatter: { ...rest, permissions: toPermissions(permission) },
  };
};

export default {
  ...v1,
  files: Object.fromEntries(
    Object.entries(v1.files).map(([name, file]) => [name, toV2(name, file)]),
  ),
} satisfies SyncConfig;

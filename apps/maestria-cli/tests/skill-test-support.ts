/**
 * Test-only shared fakes for the skill suite. Never imported by production
 * code. Runtime-import free by design: handler tests import this file inside
 * `vi.mock` factories, so even a transitive runtime import of the mocked
 * module deadlocks collection.
 */
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import type { SkillsRecord } from '@/lib/skills.js';

export interface TestSkillAsset {
  path?: string;
  source?: string;
}

export type TestRecordEntry =
  | string[]
  | {
      skillAssets?: Record<string, TestSkillAsset>;
      skills: string[];
    };

const toPlatformEntry = (
  entry: TestRecordEntry,
): { skills: string[]; skillAssets?: Record<string, TestSkillAsset> } => {
  if (Array.isArray(entry)) {
    return { skills: [...entry] };
  }
  const { skillAssets, skills } = entry;
  if (skillAssets !== undefined) {
    return {
      ...(Object.keys(skillAssets).length > 0 ? { skillAssets: { ...skillAssets } } : {}),
      skills: [...skills],
    };
  }
  return { skills: [...skills] };
};

/** Shorthand record builder: arrays expand to `{ skills }`. Version pinned to v2. */
export const buildRecord = (platforms: Record<string, TestRecordEntry>): SkillsRecord => ({
  platforms: Object.fromEntries(
    Object.entries(platforms).map(([id, entry]) => [id, toPlatformEntry(entry)]),
  ),
  version: 2,
});

export const skillOf = (args: readonly string[]): string => {
  const flag = args.indexOf('-s');
  if (flag !== -1) {
    return args[flag + 1] ?? '';
  }
  return args[1] ?? '';
};

export const addJson = (
  agent: string,
  skill: string,
  skillPath: string,
  status = 'installed',
): string =>
  [
    'Installation Summary',
    `  ${skillPath}`,
    '',
    JSON.stringify([
      { agents: ['OpenCode'], mode: 'copy', name: skill, path: skillPath, scope: 'global', status },
    ]),
  ].join('\n');

export const listJson = (entries: { name: string; path: string }[]): string =>
  JSON.stringify(entries.map((entry) => ({ ...entry, scope: 'global' })));

/** Observable fake of the external skills CLI (same machine shapes as the real CLI). */
export const fakeSkillCli = (paths: Record<string, string>): SkillCommandRunner => {
  const installed = new Map<string, { name: string; path: string }[]>();
  const pathFor = (agent: string, skill: string): string =>
    paths[`${agent}:${skill}`] ?? paths[agent] ?? `/fake/${agent}/${skill}`;
  // oxlint-disable-next-line require-await -- synchronous fake runner by design.
  return async (args: readonly string[]) => {
    const agentFlag = args.indexOf('-a');
    const agent = agentFlag === -1 ? '' : (args[agentFlag + 1] ?? '');
    const [command] = args;
    if (command === 'add') {
      const skill = skillOf(args);
      const list = installed.get(agent) ?? [];
      if (!list.some((entry) => entry.name === skill)) {
        list.push({ name: skill, path: pathFor(agent, skill) });
      }
      installed.set(agent, list);
      const current = list.find((entry) => entry.name === skill);
      return { stderr: '', stdout: addJson(agent, skill, current?.path ?? '') };
    }
    if (command === 'list') {
      return { stderr: '', stdout: listJson(installed.get(agent) ?? []) };
    }
    if (command === 'remove') {
      const skill = skillOf(args);
      const list = installed.get(agent) ?? [];
      const kept = list.filter((entry) => entry.name !== skill);
      installed.set(agent, kept);
      return {
        stderr: '',
        stdout: kept.length === list.length ? 'No skills found to remove.' : 'Done!',
      };
    }
    throw new Error(`unexpected fake command: ${command}`);
  };
};

/** List-only fake for read-only diagnostics (throws on any mutating command). */
export const fakeListCli =
  (inventory: Record<string, { name: string; path: string }[]>): SkillCommandRunner =>
  // oxlint-disable-next-line require-await -- synchronous fake runner by design.
  async (args: readonly string[]) => {
    if (args[0] !== 'list') {
      throw new Error(`doctor fake only lists, got: ${args[0]}`);
    }
    const flag = args.indexOf('-a');
    const agent = flag === -1 ? '' : (args[flag + 1] ?? '');
    return { stderr: '', stdout: listJson(inventory[agent] ?? []) };
  };

// oxlint-disable-next-line require-await -- synchronous fake runner by design.
export const failingSkillCli: SkillCommandRunner = async () => {
  throw new Error('boom');
};

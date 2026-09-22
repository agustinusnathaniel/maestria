/**
 * Test-only shared fakes for the skill suite. Never imported by production
 * code. Runtime-import free by design: handler tests import this file inside
 * `vi.mock` factories, so even a transitive runtime import of the mocked
 * module deadlocks collection.
 */
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import type { SkillsRecord } from '@/lib/skills.js';

const PR_SKILL = 'create-pull-request';

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

/** Canned skills-CLI transport for handler wiring and ordering tests. */
export const cannedSkillCli =
  (): SkillCommandRunner =>
  // oxlint-disable-next-line require-await -- synchronous fake transport by design.
  async (args: readonly string[]) => {
    if (args[0] === 'add') {
      const flag = args.indexOf('-s');
      const skill = flag === -1 ? PR_SKILL : (args[flag + 1] ?? PR_SKILL);
      return {
        stderr: '',
        stdout: JSON.stringify([
          { name: skill, path: `/fake/skills/${skill}`, status: 'installed' },
        ]),
      };
    }
    if (args[0] === 'list') {
      return { stderr: '', stdout: '[]' };
    }
    return { stderr: '', stdout: 'Done!' };
  };

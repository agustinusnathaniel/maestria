/**
 * Test-only shared fakes for the skill distribution suite.
 * Never imported by production code: a shorthand skills-record builder and
 * the canned skills-CLI transport shared by the handler ordering tests.
 *
 * Runtime-import free by design: handler tests import this file inside
 * `vi.mock` factories for the mocked skills CLI, so even a transitive
 * runtime import of the mocked module (via `@/lib/skills.js`, which owns
 * the companion constants) deadlocks collection. Skill IDs mirror the
 * production constants as literals; records are constructed directly in
 * the version 2 shape instead of round-tripping through the parser.
 */
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import type { SkillsRecord } from '@/lib/skills.js';

/** Mirrors COMPANION_SKILL without importing the mocked module (avoids a mock-factory cycle). */
const PR_SKILL = 'create-pull-request';

export const TEST_SKILLS_SOURCE = 'test-source';

export interface TestSkillAsset {
  path?: string;
  source?: string;
}

export type TestRecordEntry =
  | string[]
  | {
      path?: string;
      skillAssets?: Record<string, TestSkillAsset>;
      skills: string[];
      source?: string;
    };

const toPlatformEntry = (
  entry: TestRecordEntry,
): { skills: string[]; skillAssets?: Record<string, TestSkillAsset> } => {
  if (Array.isArray(entry)) {
    return { skills: [...entry] };
  }
  const { path: legacyPath, skillAssets, skills, source: legacySource } = entry;
  if (skillAssets !== undefined) {
    return {
      ...(Object.keys(skillAssets).length > 0 ? { skillAssets: { ...skillAssets } } : {}),
      skills: [...skills],
    };
  }
  if (legacyPath !== undefined || legacySource !== undefined) {
    return {
      skillAssets: {
        [PR_SKILL]: {
          ...(typeof legacySource === 'string' ? { source: legacySource } : {}),
          ...(typeof legacyPath === 'string' ? { path: legacyPath } : {}),
        },
      },
      skills: [...skills],
    };
  }
  return { skills: [...skills] };
};

/**
 * Shorthand record builder: arrays expand to `{ skills }`, legacy shared
 * `path`/`source` folds into the `create-pull-request` asset (matching the
 * legacy shared shape), explicit `skillAssets` pass through. Version pinned
 * to v2; corrupt-record coverage uses the real parser directly.
 */
export const buildRecord = (
  platforms: Record<string, TestRecordEntry>,
  _source = TEST_SKILLS_SOURCE,
): SkillsRecord => ({
  platforms: Object.fromEntries(
    Object.entries(platforms).map(([id, entry]) => [id, toPlatformEntry(entry)]),
  ),
  version: 2,
});

/**
 * Canned skills-CLI transport for handler wiring and ordering tests: confirms
 * adds with machine JSON naming the requested `-s` skill, reports empty
 * inventory, accepts removals. Never touches the network or the real home
 * directory.
 */
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

/**
 * Test-only shared fakes for the PR skill distribution suite (PR 320).
 * Never imported by production code: a shorthand skills-record builder and
 * the canned skills-CLI transport shared by the handler ordering tests.
 */
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import { parseSkillsRecord } from '@/lib/skills.js';
import type { SkillsRecord } from '@/lib/skills.js';

/** Mirrors COMPANION_SKILL without importing the mocked module (avoids a mock-factory cycle). */
const SKILL = 'create-pull-request';

export const TEST_SKILLS_SOURCE = 'test-source';

export type TestRecordEntry = string[] | { path?: string; skills: string[]; source?: string };

/** Shorthand record builder: arrays expand to `{ skills }`, version pinned. */
export const buildRecord = (
  platforms: Record<string, TestRecordEntry>,
  source = TEST_SKILLS_SOURCE,
): SkillsRecord =>
  parseSkillsRecord(
    JSON.stringify({
      platforms: Object.fromEntries(
        Object.entries(platforms).map(([id, entry]) => [
          id,
          Array.isArray(entry) ? { skills: entry } : entry,
        ]),
      ),
      version: 1,
    }),
    source,
  );

/**
 * Canned skills-CLI transport for handler wiring and ordering tests: confirms
 * adds with machine JSON, reports empty inventory, accepts removals. Never
 * touches the network or the real home directory.
 */
export const cannedSkillCli =
  (): SkillCommandRunner =>
  // oxlint-disable-next-line require-await -- synchronous fake transport by design.
  async (args: readonly string[]) => {
    if (args[0] === 'add') {
      return {
        stderr: '',
        stdout: JSON.stringify([
          { name: SKILL, path: '/fake/skills/create-pull-request', status: 'installed' },
        ]),
      };
    }
    if (args[0] === 'list') {
      return { stderr: '', stdout: '[]' };
    }
    return { stderr: '', stdout: 'Done!' };
  };

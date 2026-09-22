import { describe, expect, it } from 'vite-plus/test';

import { CliError } from '@/lib/command-result.js';
import { reviewSkillSelections } from '@/lib/skill-prompts.js';
import {
  DEFAULT_SKILLS,
  parseSkillsRecord,
  resolveSkillSelection,
  withoutRecordedSelection,
  withRecordedSelection,
} from '@/lib/skills.js';
import { buildRecord } from './skill-test-support.js';

const SKILL = 'create-pull-request';

describe('skill selection', () => {
  it('defaults fresh installs to all current default skills', () => {
    expect(DEFAULT_SKILLS).toContain(SKILL);
    const resolved = resolveSkillSelection('opencode', {}, null);
    expect(resolved).toEqual({ changed: false, skills: [SKILL] });
  });

  it('preserves recorded choices when no flags are passed', () => {
    const record = buildRecord({ pi: [] });
    expect(resolveSkillSelection('pi', {}, record)).toEqual({ changed: false, skills: [] });
    expect(resolveSkillSelection('opencode', {}, record)).toEqual({
      changed: false,
      skills: [SKILL],
    });
  });

  it.each([
    { expected: [SKILL], flags: { skills: SKILL }, name: 'explicit include' },
    { expected: [], flags: { skills: 'none' }, name: 'none token' },
    {
      expected: [],
      flags: { excludeSkills: SKILL },
      name: 'exclusion onto recorded choices',
      record: buildRecord({ opencode: [SKILL] }),
    },
  ])('applies flag selections: $name', ({ expected, flags, record }) => {
    expect(resolveSkillSelection('opencode', flags, record ?? null)).toEqual({
      changed: true,
      skills: expected,
    });
  });

  it.each([
    { flags: { skills: 'nope' }, name: 'unknown include' },
    { flags: { excludeSkills: 'nope' }, name: 'unknown exclude' },
    {
      flags: { excludeSkills: SKILL, skills: SKILL },
      name: 'conflicting include/exclude',
    },
    { flags: { excludeSkills: SKILL, skills: 'none' }, name: 'none with exclude' },
    { flags: { skills: `none,${SKILL}` }, name: 'none with another skill' },
  ])('rejects invalid flag selections before any external effect: $name', ({ flags }) => {
    expect(() => resolveSkillSelection('opencode', flags, null)).toThrow(CliError);
  });

  it('fails loudly on corrupt records instead of resetting to defaults', () => {
    const corruptPayloads = [
      'not json',
      '[]',
      JSON.stringify({ platforms: {}, version: 999 }),
      JSON.stringify({ platforms: { opencode: { skills: 'nope' } }, version: 1 }),
    ];
    for (const payload of corruptPayloads) {
      expect(() => parseSkillsRecord(payload, 'test-record')).toThrow(CliError);
    }
  });

  it('preserves unknown skill IDs instead of resetting them', () => {
    const record = buildRecord({ opencode: [SKILL, 'future-skill'] });
    expect(record.platforms.opencode?.skills).toEqual([SKILL, 'future-skill']);
    expect(resolveSkillSelection('opencode', {}, record).skills).toEqual([SKILL, 'future-skill']);
  });

  it('keeps selections per platform and cleans up only the uninstalled entry', () => {
    const record = buildRecord({ hermes: [], opencode: [SKILL] });
    const added = withRecordedSelection(record, 'pi', []);
    expect(added.platforms.opencode?.skills).toEqual([SKILL]);
    expect(added.platforms.pi?.skills).toEqual([]);
    const removed = withoutRecordedSelection(added, 'opencode');
    expect(removed?.platforms.opencode).toBeUndefined();
    expect(removed?.platforms.hermes?.skills).toEqual([]);
    expect(withoutRecordedSelection(null, 'opencode')).toBeNull();
  });
});

describe('reviewSkillSelections', () => {
  it('preserves distinct per-platform intents without flags outside a TTY', async () => {
    const record = buildRecord({ opencode: [SKILL], pi: [] });
    const selections = [{ id: 'opencode' }, { id: 'pi' }].map((target) => ({
      ...target,
      selection: resolveSkillSelection(target.id, {}, record),
    }));

    const effective = await reviewSkillSelections(selections, 'Update', {});

    expect(effective.map((entry) => [entry.id, entry.selection.skills])).toEqual([
      ['opencode', [SKILL]],
      ['pi', []],
    ]);
    expect(effective.every((entry) => !entry.selection.changed)).toBe(true);
  });

  it('requires confirmation for flag-driven changes outside a TTY', async () => {
    const selections = [{ id: 'opencode' }].map((target) => ({
      ...target,
      selection: resolveSkillSelection(target.id, { skills: 'none' }, null),
    }));

    await expect(reviewSkillSelections(selections, 'Update', { skills: 'none' })).rejects.toThrow(
      CliError,
    );
    const confirmed = await reviewSkillSelections(selections, 'Update', {
      skills: 'none',
      yes: true,
    });
    expect(confirmed[0]?.selection.skills).toEqual([]);
  });

  it('passes through unchanged flag selections without confirmation', async () => {
    const record = buildRecord({ opencode: [] });
    const selections = [{ id: 'opencode' }].map((target) => ({
      ...target,
      selection: resolveSkillSelection(target.id, { skills: 'none' }, record),
    }));

    const effective = await reviewSkillSelections(selections, 'Update', {});

    expect(effective[0]?.selection).toEqual({ changed: false, skills: [] });
  });
});

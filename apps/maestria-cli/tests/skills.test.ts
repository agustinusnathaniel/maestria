import { describe, expect, it } from 'vite-plus/test';

import { CliError } from '@/lib/command-result.js';
import { reviewSkillSelections } from '@/lib/skill-prompts.js';
import {
  DEFAULT_SKILLS,
  parseSkillsRecord,
  resolveSelections,
  resolveSkillSelection,
  withoutRecordedSelection,
  withRecordedSelection,
} from '@/lib/skills.js';

const source = 'test-record';

describe('skill selection', () => {
  it('defaults fresh installs to all current default skills', () => {
    expect(DEFAULT_SKILLS).toContain('create-pull-request');
    const resolved = resolveSkillSelection('opencode', {}, null);
    expect(resolved).toEqual({ changed: false, skills: ['create-pull-request'] });
  });

  it('preserves recorded choices when no flags are passed', () => {
    const record = parseSkillsRecord(
      JSON.stringify({ platforms: { pi: { skills: [] } }, version: 1 }),
      source,
    );
    expect(resolveSkillSelection('pi', {}, record)).toEqual({ changed: false, skills: [] });
    expect(resolveSkillSelection('opencode', {}, record)).toEqual({
      changed: false,
      skills: ['create-pull-request'],
    });
  });

  it('applies explicit include and the none token', () => {
    expect(resolveSkillSelection('opencode', { skills: 'create-pull-request' }, null)).toEqual({
      changed: true,
      skills: ['create-pull-request'],
    });
    expect(resolveSkillSelection('opencode', { skills: 'none' }, null)).toEqual({
      changed: true,
      skills: [],
    });
  });

  it('applies exclusions onto recorded choices', () => {
    const record = parseSkillsRecord(
      JSON.stringify({ platforms: { opencode: { skills: ['create-pull-request'] } }, version: 1 }),
      source,
    );
    expect(
      resolveSkillSelection('opencode', { excludeSkills: 'create-pull-request' }, record),
    ).toEqual({ changed: true, skills: [] });
  });

  it('rejects unknown names before any external effect', () => {
    expect(() => resolveSkillSelection('opencode', { skills: 'nope' }, null)).toThrow(CliError);
    expect(() => resolveSkillSelection('opencode', { excludeSkills: 'nope' }, null)).toThrow(
      CliError,
    );
  });

  it('rejects conflicting include/exclude and none combinations', () => {
    expect(() =>
      resolveSkillSelection(
        'opencode',
        { excludeSkills: 'create-pull-request', skills: 'create-pull-request' },
        null,
      ),
    ).toThrow(CliError);
    expect(() =>
      resolveSkillSelection(
        'opencode',
        { excludeSkills: 'create-pull-request', skills: 'none' },
        null,
      ),
    ).toThrow(CliError);
    expect(() =>
      resolveSkillSelection('opencode', { skills: 'none,create-pull-request' }, null),
    ).toThrow(CliError);
  });

  it('fails loudly on corrupt records instead of resetting to defaults', () => {
    expect(() => parseSkillsRecord('not json', source)).toThrow(CliError);
    expect(() => parseSkillsRecord('[]', source)).toThrow(CliError);
    expect(() =>
      parseSkillsRecord(JSON.stringify({ platforms: {}, version: 999 }), source),
    ).toThrow(CliError);
    expect(() =>
      parseSkillsRecord(
        JSON.stringify({ platforms: { opencode: { skills: 'nope' } }, version: 1 }),
        source,
      ),
    ).toThrow(CliError);
  });

  it('preserves unknown skill IDs instead of resetting them', () => {
    const record = parseSkillsRecord(
      JSON.stringify({
        platforms: { opencode: { skills: ['create-pull-request', 'future-skill'] } },
        version: 1,
      }),
      source,
    );
    expect(record.platforms.opencode?.skills).toEqual(['create-pull-request', 'future-skill']);
    expect(resolveSkillSelection('opencode', {}, record).skills).toEqual([
      'create-pull-request',
      'future-skill',
    ]);
  });

  it('keeps selections per platform and cleans up only the uninstalled entry', () => {
    const record = parseSkillsRecord(
      JSON.stringify({
        platforms: { hermes: { skills: [] }, opencode: { skills: ['create-pull-request'] } },
        version: 1,
      }),
      source,
    );
    const added = withRecordedSelection(record, 'pi', []);
    expect(added.platforms.opencode?.skills).toEqual(['create-pull-request']);
    expect(added.platforms.pi?.skills).toEqual([]);
    const removed = withoutRecordedSelection(added, 'opencode');
    expect(removed?.platforms.opencode).toBeUndefined();
    expect(removed?.platforms.hermes?.skills).toEqual([]);
    expect(withoutRecordedSelection(null, 'opencode')).toBeNull();
  });
});

describe('reviewSkillSelections', () => {
  it('preserves distinct per-platform intents without flags outside a TTY', async () => {
    const record = parseSkillsRecord(
      JSON.stringify({
        platforms: { opencode: { skills: ['create-pull-request'] }, pi: { skills: [] } },
        version: 1,
      }),
      source,
    );
    const selections = resolveSelections([{ id: 'opencode' }, { id: 'pi' }], {}, record);

    const effective = await reviewSkillSelections(selections, 'Update', {});

    expect(effective.map((entry) => [entry.id, entry.selection.skills])).toEqual([
      ['opencode', ['create-pull-request']],
      ['pi', []],
    ]);
    expect(effective.every((entry) => !entry.selection.changed)).toBe(true);
  });

  it('requires confirmation for flag-driven changes outside a TTY', async () => {
    const selections = resolveSelections([{ id: 'opencode' }], { skills: 'none' }, null);

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
    const record = parseSkillsRecord(
      JSON.stringify({ platforms: { opencode: { skills: [] } }, version: 1 }),
      source,
    );
    const selections = resolveSelections([{ id: 'opencode' }], { skills: 'none' }, record);

    const effective = await reviewSkillSelections(selections, 'Update', {});

    expect(effective[0]?.selection).toEqual({ changed: false, skills: [] });
  });
});

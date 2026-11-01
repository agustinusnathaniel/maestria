import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { kit } from '@/data/kit.ts';
import { marks } from '@/data/marks.ts';
import { laneGroups, routes } from '@/data/routes.ts';

const DIRECTIVES = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'packages',
  'core',
  'agent-directives',
);

const canonicalModes = async (): Promise<string[]> => {
  const files = await readdir(path.join(DIRECTIVES, 'commands'));
  return files.map((file) => path.basename(file, '.md')).toSorted();
};

const canonicalSkills = async (): Promise<string[]> => {
  const entries = await readdir(path.join(DIRECTIVES, 'skills'), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
};

const lanes = laneGroups.flatMap((group) => group.lanes);
const kitTerms = (id: string): string[] =>
  (kit.find((part) => part.id === id)?.items ?? []).map((item) => item.term).toSorted();

describe('homepage data', () => {
  it('lists exactly the canonical modes and method skills', async () => {
    expect(kitTerms('modes')).toEqual(await canonicalModes());
    expect(kitTerms('skills')).toEqual(await canonicalSkills());
  });

  it('names only canonical skills and modes on the score', async () => {
    const skills = await canonicalSkills();
    const modes = await canonicalModes();
    for (const lane of lanes) {
      if (lane.skill !== undefined) {
        expect(skills).toContain(lane.skill);
      }
    }
    for (const route of routes) {
      if (route.mode !== undefined) {
        expect(modes).toContain(route.mode);
      }
    }
  });

  // The narrow layout drops the time axis and relies on lane order matching step order.
  it('plays each route down the lanes in order', () => {
    const laneIndex = new Map(lanes.map((lane, index) => [lane.id, index]));
    for (const route of routes) {
      const order = route.steps.map((step) => laneIndex.get(step.lane));
      expect(order, route.id).not.toContain(undefined);
      expect(order, route.id).toEqual(order.toSorted((a = 0, b = 0) => a - b));
      expect(new Set(order).size, route.id).toBe(order.length);
    }
  });

  it('draws every mark it references', () => {
    for (const mark of [...lanes.map((lane) => lane.mark), ...kit.map((part) => part.mark)]) {
      expect(marks, mark).toHaveProperty(mark);
    }
  });
});

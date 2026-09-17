import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { MAESTRIA_AGENTS } from '@/lib/model-config.js';
import { CURSOR_AGENT_NAMES } from '@/lib/platforms.js';

const SPECIALISTS_DIR = path.resolve(
  import.meta.dirname,
  '../../../packages/core/agent-directives/specialists',
);

const delegableNames = readdirSync(SPECIALISTS_DIR)
  .filter((file) => file.endsWith('.md') && file !== 'orchestrator.md')
  .map((file) => file.replace(/\.md$/u, ''))
  .toSorted();

describe('specialist roster', () => {
  it('keeps MAESTRIA_AGENTS aligned with the canonical delegable roles', () => {
    expect([...MAESTRIA_AGENTS].toSorted()).toEqual(delegableNames);
  });

  it('keeps CURSOR_AGENT_NAMES aligned with the canonical delegable roles', () => {
    expect([...CURSOR_AGENT_NAMES].toSorted()).toEqual(delegableNames);
  });
});

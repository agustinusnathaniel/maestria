import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import agentPluginConfig from '../../agent-plugin/sync.config.js';
import claudeCodeConfig from '../../claude-code/sync.config.js';
import codexConfig from '../../codex/sync.config.js';
import cursorConfig from '../../cursor/sync.config.js';
import hermesConfig from '../../hermes/sync.config.js';
import kimiCodeConfig from '../../kimi-code/sync.config.js';
import ompConfig from '../../omp/sync.config.js';
import opencodeConfig from '../../opencode/sync.config.js';
import piConfig from '../../pi/sync.config.js';
import primeAgentConfig from '../../prime-agent/sync.config.js';
import { ALLOWED_AGENTS } from '../../shared/pi/src/subagent-utils.js';
import type { ReplaceOp, SyncConfig } from '../scripts/lib/config.js';

const SPECIALISTS_DIR = path.join(import.meta.dirname, '..', 'agent-directives', 'specialists');
const ORCHESTRATOR = 'orchestrator';

// Names are validated against the canonical directory instead of derived into
// configs: ADR-CORE-005 forbids dynamic derivation, while ADR-CORE-020
// endorses checking registries against one source.
const canonicalFiles = readdirSync(SPECIALISTS_DIR)
  .filter((file) => file.endsWith('.md'))
  .toSorted();
const delegableNames = canonicalFiles
  .filter((file) => file !== `${ORCHESTRATOR}.md`)
  .map((file) => file.replace(/\.md$/u, ''));

interface RosterViolations {
  extra: string[];
  missing: string[];
}

const findViolations = (
  expected: readonly string[],
  actual: readonly string[],
): RosterViolations => {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    extra: actual.filter((name) => !expectedSet.has(name)),
    missing: expected.filter((name) => !actualSet.has(name)),
  };
};

const collectReplaceOps = (config: SyncConfig): ReplaceOp[] => {
  const ops: ReplaceOp[] = [...(config.default?.replace ?? [])];
  for (const file of Object.values(config.files ?? {})) {
    ops.push(...(file.replace ?? []));
  }
  return ops;
};

const syncConfigs: Record<string, SyncConfig> = {
  'agent-plugin': agentPluginConfig,
  'claude-code': claudeCodeConfig,
  codex: codexConfig,
  cursor: cursorConfig,
  hermes: hermesConfig,
  'kimi-code': kimiCodeConfig,
  omp: ompConfig,
  opencode: opencodeConfig,
  pi: piConfig,
  'prime-agent': primeAgentConfig,
};

describe('canonical specialist roster', () => {
  it('derives eight specialist files and seven delegable roles', () => {
    expect(canonicalFiles).toHaveLength(8);
    expect(delegableNames).toHaveLength(7);
  });

  it('reports a missing name', () => {
    expect(findViolations(['adventurer', 'builder'], ['adventurer'])).toEqual({
      extra: [],
      missing: ['builder'],
    });
  });

  it('reports an extra name', () => {
    expect(findViolations(['adventurer'], ['adventurer', 'builder'])).toEqual({
      extra: ['builder'],
      missing: [],
    });
  });

  it('keeps ALLOWED_AGENTS aligned with the delegable roster', () => {
    expect(findViolations(delegableNames, ALLOWED_AGENTS)).toEqual({ extra: [], missing: [] });
  });

  for (const [platform, config] of Object.entries(syncConfigs)) {
    describe(platform, () => {
      it('registers every canonical specialist file', () => {
        const { missing } = findViolations(canonicalFiles, Object.keys(config.files ?? {}));
        expect(missing).toEqual([]);
      });

      it('references every delegable role without orchestrator replace ops', () => {
        const ops = collectReplaceOps(config);
        if (ops.length === 0) {
          return;
        }
        const text = ops.map((op) => `${op.from}\n${op.to}`).join('\n');
        const uncovered = delegableNames.filter(
          (name) => !new RegExp(`\\b${name}\\b`, 'u').test(text),
        );
        expect(uncovered).toEqual([]);
        expect(/\borchestrator\b/u.test(text)).toBe(false);
      });
    });
  }
});

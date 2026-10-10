import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import componentConfig from '../../agent-plugins/generation/agents.sync.config.js';
import pluginConfig from '../../agent-plugins/generation/skills.sync.config.js';
import claudeCodeConfig from '../../agent-plugins/generation/claude-code.sync.config.js';
import cursorConfig from '../../agent-plugins/generation/cursor.sync.config.js';
import opencodeConfig from '../../opencode/sync.config.js';
import piConfig from '../../pi/sync.config.js';
import { ALLOWED_AGENTS } from '../../shared/pi/src/subagent-utils.js';
import type { ReplaceOp, SyncConfig } from '@/lib/config.js';

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

const hasExplicitReplacement = (config: SyncConfig): boolean =>
  (config.default !== undefined && Object.hasOwn(config.default, 'replace')) ||
  Object.values(config.files ?? {}).some((file) => Object.hasOwn(file, 'replace'));

const collectReplaceOps = (config: SyncConfig): ReplaceOp[] => {
  const ops: ReplaceOp[] = [...(config.default?.replace ?? [])];
  for (const file of Object.values(config.files ?? {})) {
    ops.push(...(file.replace ?? []));
  }
  return ops;
};

const syncConfigs: Record<string, SyncConfig> = {
  'claude-code': claudeCodeConfig,
  components: componentConfig,
  cursor: cursorConfig,
  opencode: opencodeConfig,
  pi: piConfig,
  plugin: pluginConfig,
};

describe('canonical specialist roster', () => {
  it('derives eight specialist files and seven delegable roles', () => {
    expect(canonicalFiles).toHaveLength(8);
    expect(delegableNames).toHaveLength(7);
  });

  it('keeps ALLOWED_AGENTS aligned with the delegable roster', () => {
    expect(findViolations(delegableNames, ALLOWED_AGENTS)).toEqual({ extra: [], missing: [] });
  });

  for (const [platform, config] of Object.entries(syncConfigs)) {
    describe(platform, () => {
      it('registers the expected canonical specialist roster', () => {
        const expected = ['claude-code', 'cursor'].includes(platform)
          ? canonicalFiles.filter((file) => file !== `${ORCHESTRATOR}.md`)
          : canonicalFiles;
        const { missing } = findViolations(expected, Object.keys(config.files ?? {}));
        expect(missing).toEqual([]);
      });
    });
  }

  it('covers every explicit replacement-bearing config', () => {
    const replacementConfigs = Object.entries(syncConfigs).filter(([, config]) =>
      hasExplicitReplacement(config),
    );
    expect(replacementConfigs.length).toBeGreaterThan(0);
    for (const [platform, config] of replacementConfigs) {
      const ops = collectReplaceOps(config);
      expect(ops.length, platform).toBeGreaterThan(0);
      const text = ops.map((op) => `${op.from}\n${op.to}`).join('\n');
      const uncovered = delegableNames.filter(
        (name) => !new RegExp(`\\b${name}\\b`, 'u').test(text),
      );
      expect(uncovered, platform).toEqual([]);
      expect(/\borchestrator\b/u.test(text), platform).toBe(false);
    }
  });
});

// ── Host tool-name drift guard ──
//
// A generated `tools:` entry naming a tool the host does not register is inert,
// not an error: the frontmatter parser does not validate names, so the filter
// entry silently denies nothing and the capability is simply lost. Both host
// lists are read from each installed host's own shipped constant rather than
// from any declaration here, so these assertions can fail when a host changes.

const PACKAGES_DIR = path.join(import.meta.dirname, '..', '..');

/** Package root of an installed host, so a missing install fails loudly here. */
const hostPackageRoot = (platform: string, packageName: string): string => {
  const manifest = path.join(PACKAGES_DIR, platform, 'node_modules', packageName, 'package.json');
  if (!existsSync(manifest)) {
    throw new Error(`Host not installed, cannot guard tool names: ${packageName} (${manifest})`);
  }
  return path.dirname(realpathSync(manifest));
};

const quotedNames = (source: string, declaration: RegExp, label: string): string[] => {
  const body = source.match(declaration)?.groups?.names;
  if (body === undefined) {
    throw new Error(`Could not read ${label}; the host changed its exported shape`);
  }
  return [...body.matchAll(/["'](?<name>[^"']+)["']/gu)].map((match) => match.groups?.name ?? '');
};

const piHostTools = (): string[] => {
  const source = readFileSync(
    path.join(
      hostPackageRoot('pi', '@earendil-works/pi-coding-agent'),
      'dist',
      'core',
      'tools',
      'index.js',
    ),
    'utf-8',
  );
  return quotedNames(
    source,
    /allToolNames\s*=\s*new Set\(\s*\[(?<names>[\s\S]*?)\]\s*\)/u,
    'Pi allToolNames',
  );
};

const TOOLS_LINE = /^tools: (?<names>.*)$/mu;

/** Tool names the shipped agent file for `agentFile` grants, or null when undeclared. */
const grantedTools = (platform: string, agentFile: string): string[] | null => {
  const source = readFileSync(path.join(PACKAGES_DIR, platform, 'agents', agentFile), 'utf-8');
  const declared = TOOLS_LINE.exec(source)?.groups?.names;
  return declared === undefined ? null : declared.split(',').map((name) => name.trim());
};

const agentFiles = (platform: string): string[] =>
  readdirSync(path.join(PACKAGES_DIR, platform, 'agents'))
    .filter((file) => file.endsWith('.md'))
    .toSorted();

describe('generated agent tool lists', () => {
  it('grants only tools the Pi host registers', () => {
    const hostTools = new Set(piHostTools());
    for (const agentFile of agentFiles('pi')) {
      const granted = grantedTools('pi', agentFile) ?? [];
      expect(
        granted.filter((tool) => !hostTools.has(tool)),
        agentFile,
      ).toEqual([]);
    }
  });
});

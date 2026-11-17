import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { ALLOWED_AGENTS } from '../../pi/src/agents.js';

const SPECIALISTS_DIR = path.join(import.meta.dirname, '..', 'agent-directives', 'specialists');
const MAIN_LOOP = 'main-loop';

// Names are validated against the canonical directory instead of derived into
// configs: ADR-CORE-005 forbids dynamic derivation, while ADR-CORE-020
// endorses checking registries against one source.
const canonicalFiles = readdirSync(SPECIALISTS_DIR)
  .filter((file) => file.endsWith('.md'))
  .toSorted();
const delegableNames = canonicalFiles
  .filter((file) => file !== `${MAIN_LOOP}.md`)
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const PACKAGES_DIR = path.join(import.meta.dirname, '..', '..');

const agentFiles = (platform: string): string[] =>
  readdirSync(path.join(PACKAGES_DIR, platform, 'agents'))
    .filter((file) => file.endsWith('.md'))
    .toSorted();

describe('canonical specialist roster', () => {
  it('derives two specialist files and one delegable role', () => {
    expect(canonicalFiles).toHaveLength(2);
    expect(delegableNames).toHaveLength(1);
  });

  it('keeps the consolidated profile registry aligned with the delegable roles', () => {
    const registry: unknown = JSON.parse(
      readFileSync(
        path.join(import.meta.dirname, '../../agent-plugins/generation/profiles.json'),
        'utf-8',
      ),
    );
    if (!isRecord(registry)) {
      throw new Error('Expected profile registry object');
    }
    expect(findViolations(delegableNames, Object.keys(registry))).toEqual({
      extra: [],
      missing: [],
    });
  });

  it('keeps ALLOWED_AGENTS aligned with the delegable roster', () => {
    expect(findViolations(delegableNames, ALLOWED_AGENTS)).toEqual({ extra: [], missing: [] });
  });

  it('generates one native agent per delegable role', () => {
    const delegableFiles = delegableNames.map((name) => `${name}.md`);
    expect(agentFiles('opencode')).toEqual(['maestria.md', ...delegableFiles].toSorted());
    expect(agentFiles('pi')).toEqual(delegableFiles);
  });

  it('rewrites every role mention to the Pi subagent command', () => {
    const generated = [
      ...agentFiles('pi').map((file) => path.join('agents', file)),
      ...readdirSync(path.join(PACKAGES_DIR, 'pi', 'agents', 'commands')).map((file) =>
        path.join('agents', 'commands', file),
      ),
      'skills/maestria/SKILL.md',
      'skills/global-rules/SKILL.md',
    ];
    for (const file of generated) {
      const content = readFileSync(path.join(PACKAGES_DIR, 'pi', file), 'utf-8');
      for (const name of delegableNames) {
        expect(content, file).not.toMatch(new RegExp(`@${name}\\b`, 'u'));
      }
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

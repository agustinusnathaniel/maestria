import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

// ── Imports ──

import { ConfigError, loadConfig, resolveSourceFile } from '../scripts/lib/config.js';
import type {
  ReplaceOp,
  ResolvedFileConfig,
  ResolvedReplaceOp,
  ResolvedSyncConfig,
} from '../scripts/lib/config.js';
import { validateAnchors } from '../scripts/lib/anchors.js';
import type { AnchorReport } from '../scripts/lib/anchors.js';
import { resolveSyncPlan } from '../scripts/lib/plan.js';
import { processFile } from '../scripts/lib/process-file.js';
import { runSync } from '../scripts/lib/sync.js';
import {
  applyReplaceOps,
  normalizeLineEndings,
  serializeFrontmatter,
  stripFrontmatter,
  stripSourceComment,
} from '../scripts/lib/transforms.js';

const { join } = path;

const configForOutput = (output: string): ResolvedFileConfig => ({
  append: '',
  output,
  prepend: '',
  replace: [],
  stripFrontmatter: false,
});

const validateAnchorsFor = async (
  config: ResolvedSyncConfig,
  sourceFiles: string[],
): Promise<AnchorReport> => {
  const { entries } = resolveSyncPlan(config, sourceFiles, 'sync');
  return await validateAnchors(config, entries);
};

// ═══════════════════════════════════════════════
// Transforms
// ═══════════════════════════════════════════════

describe('stripFrontmatter', () => {
  it('strips a standard frontmatter block', () => {
    const input = `---
key: value
another: thing
---
# Hello
World`;
    expect(stripFrontmatter(input)).toBe('# Hello\nWorld');
  });

  it('strips frontmatter with multiline values', () => {
    const input = `---
description: |
  A long
  description
---
Content`;
    expect(stripFrontmatter(input)).toBe('Content');
  });

  it('leaves content without frontmatter unchanged', () => {
    const input = '# No frontmatter\nJust content';
    expect(stripFrontmatter(input)).toBe(input);
  });

  it('strips frontmatter when content is empty after', () => {
    const input = '---\nkey: value\n---\n';
    expect(stripFrontmatter(input)).toBe('');
  });

  it('handles empty string', () => {
    expect(stripFrontmatter('')).toBe('');
  });
});

describe('applyReplaceOps', () => {
  it('applies a single replacement and counts matches', () => {
    const ops: ReplaceOp[] = [{ from: 'foo', to: 'bar' }];
    expect(applyReplaceOps('foo and foo', ops)).toEqual({
      content: 'bar and bar',
      matches: [2],
    });
  });

  it('applies ordered replacements and counts against the current content', () => {
    const ops: ReplaceOp[] = [
      { from: 'ab', to: 'cd' },
      { from: 'cd', to: 'ef' },
    ];
    // first pass: ab → cd => "cdcd" (2 matches)
    // second pass: cd → ef => "efef" (2 matches)
    expect(applyReplaceOps('abab', ops)).toEqual({ content: 'efef', matches: [2, 2] });
  });

  it('handles multiple occurrences of the same pattern', () => {
    const ops: ReplaceOp[] = [{ from: 'x', to: 'y' }];
    expect(applyReplaceOps('x x x', ops)).toEqual({ content: 'y y y', matches: [3] });
  });

  it('returns original string and zero matches when no matches', () => {
    const ops: ReplaceOp[] = [{ from: 'zzz', to: 'aaa' }];
    expect(applyReplaceOps('hello world', ops)).toEqual({
      content: 'hello world',
      matches: [0],
    });
  });

  it('handles empty ops array', () => {
    expect(applyReplaceOps('hello', [])).toEqual({ content: 'hello', matches: [] });
  });

  it('counts matches against content produced by earlier ops', () => {
    const ops: ReplaceOp[] = [
      { from: 'hello', to: 'hello world' },
      { from: 'hello world', to: 'hi' },
    ];
    expect(applyReplaceOps('hello', ops)).toEqual({ content: 'hi', matches: [1, 1] });
  });
});

describe('serializeFrontmatter', () => {
  it('serializes an object to YAML frontmatter', () => {
    const result = serializeFrontmatter({ order: 1, title: 'Test' });
    expect(result).toMatch(/order:\s+1/u);
    expect(result).toMatch(/title:\s+Test/u);
    expect(result.startsWith('---\n')).toBe(true);
    expect(result.endsWith('---\n')).toBe(true);
  });

  it('serializes multiline descriptions correctly', () => {
    const result = serializeFrontmatter({
      description: 'Line one\nLine two\nLine three',
    });
    // yaml library produces block scalar for multiline strings
    expect(result).toContain('description:');
    expect(result).toContain('Line one');
    expect(result).toContain('Line two');
    expect(result).toContain('Line three');
  });

  it('returns empty string for null data', () => {
    expect(serializeFrontmatter(null)).toBe('');
  });

  it('wraps a raw string in --- delimiters', () => {
    const result = serializeFrontmatter('key: value');
    expect(result).toBe('---\nkey: value\n---\n');
  });

  it('returns raw string as-is if it already starts with ---', () => {
    const result = serializeFrontmatter('---\nkey: value\n---\n');
    expect(result).toBe('---\nkey: value\n---\n');
  });
});

describe('stripSourceComment', () => {
  it('strips a <!-- Source: line', () => {
    const input = '<!-- Source: https://example.com -->\nContent';
    expect(stripSourceComment(input)).toBe('Content');
  });

  it('does not strip a non-source HTML comment', () => {
    const input = '<!-- This is a regular comment -->\nContent';
    expect(stripSourceComment(input)).toBe(input);
  });

  it('does not strip content without any comments', () => {
    const input = 'Just content\nNo comments';
    expect(stripSourceComment(input)).toBe(input);
  });

  it('only strips source comment at string start', () => {
    // Regex ^ anchors to string start, not line start
    const input = '# Header\n\n<!-- Source: docs.example.com -->\n\nBody text';
    expect(stripSourceComment(input)).toBe(input);
  });
});

describe('normalizeLineEndings', () => {
  it('converts CRLF to LF', () => {
    expect(normalizeLineEndings('line1\r\nline2\r\nline3')).toBe('line1\nline2\nline3');
  });

  it('leaves LF content unchanged', () => {
    const input = 'line1\nline2\nline3';
    expect(normalizeLineEndings(input)).toBe(input);
  });

  it('handles mixed line endings', () => {
    expect(normalizeLineEndings('line1\r\nline2\nline3\r\n')).toBe('line1\nline2\nline3\n');
  });

  it('handles empty string', () => {
    expect(normalizeLineEndings('')).toBe('');
  });
});

// ═══════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'core-sync-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('loads a valid config file', async () => {
    const configPath = join(tmpDir, 'sync.config.js');
    writeFileSync(
      configPath,
      `export default {
        source: './agent-directives',
        default: {
          replace: [{ from: '{{NAME}}', to: 'Test' }],
        },
        files: {},
      };\n`,
      'utf-8',
    );

    const config = await loadConfig(configPath);

    expect(config.source).toMatch(/agent-directives$/u);
    expect(config.configPath).toBe(configPath);
    expect(config.files).toEqual({});
  });

  it('loads a config with file-specific overrides', async () => {
    const configPath = join(tmpDir, 'sync.config.js');
    writeFileSync(
      configPath,
      `export default {
        source: './agent-directives',
        default: {
          replace: [{ from: '{{NAME}}', to: 'Default' }],
          stripFrontmatter: true,
          prepend: '<!-- header -->\\n',
        },
        files: {
          'override.md': {
            replace: [{ from: '{{NAME}}', to: 'Override' }],
            stripFrontmatter: false,
          },
        },
      };\n`,
      'utf-8',
    );

    const config = await loadConfig(configPath);

    expect(config.files['override.md']).toBeDefined();
    expect(config.files['override.md'].replace).toEqual([
      { from: '{{NAME}}', scope: 'default', to: 'Default' },
      { from: '{{NAME}}', scope: 'file', to: 'Override' },
    ]);
    // file value overrides default
    expect(config.files['override.md'].stripFrontmatter).toBe(false);
    // prepend falls through to default
    expect(config.files['override.md'].prepend).toBe('<!-- header -->\n');
  });

  it('loads preserve paths from config', async () => {
    const configPath = join(tmpDir, 'sync.config.ts');
    writeFileSync(
      configPath,
      `export default {
        source: './agent-directives',
        preserve: ['orchestrator.md', 'subdir/keep.md'],
        files: {},
      };\n`,
      'utf-8',
    );

    const config = await loadConfig(configPath);

    expect(config.preserve).toEqual(['orchestrator.md', 'subdir/keep.md']);
  });

  it('defaults preserve to empty array when not set', async () => {
    const configPath = join(tmpDir, 'sync.config.ts');
    writeFileSync(
      configPath,
      `export default {
        source: './agent-directives',
        files: {},
      };\n`,
      'utf-8',
    );

    const config = await loadConfig(configPath);

    expect(config.preserve).toEqual([]);
  });

  it('throws ConfigError on missing file', async () => {
    const missingPath = join(tmpDir, 'nonexistent.config.js');
    await expect(loadConfig(missingPath)).rejects.toThrow(ConfigError);
    await expect(loadConfig(missingPath)).rejects.toThrow(/Config file not found/u);
  });

  it('throws ConfigError on invalid export (no default)', async () => {
    const configPath = join(tmpDir, 'sync.config.js');
    writeFileSync(configPath, `export const foo = 'bar';\n`, 'utf-8');

    await expect(loadConfig(configPath)).rejects.toThrow(ConfigError);
    await expect(loadConfig(configPath)).rejects.toThrow(/must export a default/u);
  });
});

describe('config merge semantics', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'core-sync-merge-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('concatenates default.replace with file.replace', async () => {
    const configPath = join(tmpDir, 'sync.config.js');
    writeFileSync(
      configPath,
      `export default {
        source: './agent-directives',
        default: {
          replace: [
            { from: '{{A}}', to: '1' },
            { from: '{{B}}', to: '2' },
          ],
        },
        files: {
          'test.md': {
            replace: [{ from: '{{C}}', to: '3' }],
          },
        },
      };\n`,
      'utf-8',
    );

    const config = await loadConfig(configPath);
    expect(config.files['test.md'].replace).toEqual([
      { from: '{{A}}', scope: 'default', to: '1' },
      { from: '{{B}}', scope: 'default', to: '2' },
      { from: '{{C}}', scope: 'file', to: '3' },
    ]);
  });

  it('gives file values precedence over defaults', async () => {
    const configPath = join(tmpDir, 'sync.config.js');
    writeFileSync(
      configPath,
      `export default {
        source: './agent-directives',
        default: {
          stripFrontmatter: true,
          prepend: 'default-prepend\\n',
          append: 'default-append\\n',
          frontmatter: { key: 'default' },
        },
        files: {
          'test.md': {
            stripFrontmatter: false,
            prepend: 'file-prepend\\n',
            // append left undefined - inherits from default
            frontmatter: { key: 'file' },
          },
        },
      };\n`,
      'utf-8',
    );

    const config = await loadConfig(configPath);
    const fileCfg = config.files['test.md'];

    // File-specific values override defaults.
    expect(fileCfg.stripFrontmatter).toBe(false);
    expect(fileCfg.prepend).toBe('file-prepend\n');
    // Undefined file-specific values inherit defaults.
    expect(fileCfg.append).toBe('default-append\n');
    expect(fileCfg.frontmatter).toEqual({ key: 'file' });
  });

  it('leaves undefined default fields as defaults', async () => {
    const configPath = join(tmpDir, 'sync.config.js');
    writeFileSync(
      configPath,
      `export default {
        source: './agent-directives',
        files: {
          'test.md': {},
        },
      };\n`,
      'utf-8',
    );

    const config = await loadConfig(configPath);
    const fileCfg = config.files['test.md'];

    expect(fileCfg.stripFrontmatter).toBe(false);
    expect(fileCfg.replace).toEqual([]);
    expect(fileCfg.prepend).toBe('');
    expect(fileCfg.append).toBe('');
    expect(fileCfg.frontmatter).toBeUndefined();
  });
});

describe('resolveSourceFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'core-sync-resolve-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('returns an explicit file entry as pre-resolved', async () => {
    const configPath = join(tmpDir, 'sync.config.js');
    writeFileSync(
      configPath,
      `export default {
        source: './agent-directives',
        default: { prepend: 'fallback prepend\\n' },
        files: {
          'explicit.md': {
            output: 'custom/out.md',
            prepend: 'explicit prepend\\n',
            replace: [{ from: 'a', to: 'b' }],
          },
        },
      };\n`,
      'utf-8',
    );

    const config = await loadConfig(configPath);
    const resolved = resolveSourceFile(config, 'explicit.md');

    expect(resolved).toBe(config.files['explicit.md']);
    expect(resolved.prepend).toBe('explicit prepend\n');
    expect(resolved.output).toBe(join(tmpDir, 'custom', 'out.md'));
  });

  it('merges the fallback for an implicit file', async () => {
    const configPath = join(tmpDir, 'sync.config.js');
    writeFileSync(
      configPath,
      `export default {
        source: './agent-directives',
        default: {
          prepend: 'pre\\n',
          replace: [{ from: 'x', to: 'y' }],
          stripFrontmatter: true,
        },
        files: {},
      };\n`,
      'utf-8',
    );

    const config = await loadConfig(configPath);
    const resolved = resolveSourceFile(config, 'implicit.md');

    expect(resolved.prepend).toBe('pre\n');
    expect(resolved.replace).toEqual([{ from: 'x', scope: 'default', to: 'y' }]);
    expect(resolved.stripFrontmatter).toBe(true);
  });

  it('resolves implicit output against config.output when set', async () => {
    const configPath = join(tmpDir, 'sync.config.js');
    writeFileSync(
      configPath,
      `export default {
        source: './agent-directives',
        output: './generated',
        files: {},
      };\n`,
      'utf-8',
    );

    const config = await loadConfig(configPath);
    const resolved = resolveSourceFile(config, 'implicit.md');

    expect(resolved.output).toBe(join(tmpDir, 'generated', 'implicit.md'));
  });

  it('resolves implicit output against configDir when output is unset', async () => {
    const configPath = join(tmpDir, 'sync.config.js');
    writeFileSync(
      configPath,
      `export default {
        source: './agent-directives',
        files: {},
      };\n`,
      'utf-8',
    );

    const config = await loadConfig(configPath);
    const resolved = resolveSourceFile(config, 'implicit.md');

    expect(resolved.output).toBe(join(tmpDir, 'implicit.md'));
  });
});

describe('implicit source default inheritance', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'core-sync-implicit-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('applies the default generated comment to a source file absent from files', async () => {
    const sourceDir = join(tmpDir, 'source');
    const outputDir = join(tmpDir, 'output');
    mkdirSync(sourceDir, { recursive: true });

    writeFileSync(join(sourceDir, 'implicit.md'), '# Implicit\n', 'utf-8');

    const configPath = join(tmpDir, 'sync.config.js');
    writeFileSync(
      configPath,
      `export default {
        source: './source',
        output: './output',
        files: {},
      };\n`,
      'utf-8',
    );

    const config = await loadConfig(configPath);
    await runSync({ config });

    const out = readFileSync(join(outputDir, 'implicit.md'), 'utf-8');
    expect(out).toContain('<!-- Auto-generated from @maestria/core');
    expect(out).toContain('Edit the canonical file at packages/core/agent-directives/ instead.');
    expect(out).toContain('# Implicit');
  });

  it('produces byte-identical output for an explicit {} entry and an unlisted file', async () => {
    const sourceDir = join(tmpDir, 'source');
    const outputDir = join(tmpDir, 'output');
    mkdirSync(sourceDir, { recursive: true });

    writeFileSync(join(sourceDir, 'listed.md'), '# Shared body\n', 'utf-8');
    writeFileSync(join(sourceDir, 'unlisted.md'), '# Shared body\n', 'utf-8');

    const configPath = join(tmpDir, 'sync.config.js');
    writeFileSync(
      configPath,
      `export default {
        source: './source',
        output: './output',
        default: { prepend: '<!-- shared prepend -->\\n' },
        files: { 'listed.md': {} },
      };\n`,
      'utf-8',
    );

    const config = await loadConfig(configPath);
    await runSync({ config });

    const listed = readFileSync(join(outputDir, 'listed.md'), 'utf-8');
    const unlisted = readFileSync(join(outputDir, 'unlisted.md'), 'utf-8');
    expect(listed).toBe(unlisted);
  });
});

// ═══════════════════════════════════════════════
// Anchor validation (preflight)
// ═══════════════════════════════════════════════

const defaultOp = (from: string, to: string): ResolvedReplaceOp => ({
  from,
  scope: 'default',
  to,
});

const fileOp = (from: string, to: string): ResolvedReplaceOp => ({ from, scope: 'file', to });

describe('anchor validation', () => {
  let tmpDir: string;
  let sourceDir: string;
  let outputDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'core-sync-anchors-'));
    sourceDir = join(tmpDir, 'source');
    outputDir = join(tmpDir, 'output');
    mkdirSync(sourceDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  const fileEntry = (replace: ResolvedReplaceOp[] = []): ResolvedFileConfig => ({
    append: '',
    output: join(outputDir, 'out.md'),
    prepend: '',
    replace,
    stripFrontmatter: false,
  });

  const makeConfig = (options: {
    files?: Record<string, ResolvedFileConfig>;
    defaultReplace?: ResolvedReplaceOp[];
  }): ResolvedSyncConfig => {
    const defaultReplace = options.defaultReplace ?? [];
    const files: Record<string, ResolvedFileConfig> = {};
    for (const [filename, entry] of Object.entries(options.files ?? {})) {
      files[filename] = { ...entry, replace: [...defaultReplace, ...entry.replace] };
    }
    return {
      configDir: tmpDir,
      configPath: join(tmpDir, 'sync.config.ts'),
      fallback: {
        append: '',
        prepend: '',
        replace: defaultReplace,
        stripFrontmatter: false,
      },
      files,
      output: outputDir,
      preserve: [],
      source: sourceDir,
    };
  };

  it('reports a default op dead across all files as a violation', async () => {
    writeFileSync(join(sourceDir, 'a.md'), '# Alpha\n', 'utf-8');
    writeFileSync(join(sourceDir, 'b.md'), '# Beta\n', 'utf-8');

    const config = makeConfig({ defaultReplace: [defaultOp('missing text', 'replacement')] });
    const report = await validateAnchorsFor(config, ['a.md', 'b.md']);

    expect(report.violations).toEqual([
      {
        configPath: join(tmpDir, 'sync.config.ts'),
        file: 'all files',
        from: 'missing text',
        matches: 0,
        reason: 'no-match',
        scope: 'default',
        to: 'replacement',
      },
    ]);
  });

  it('passes a default op matching in only some of the files it sweeps', async () => {
    writeFileSync(join(sourceDir, 'a.md'), 'needle here\n', 'utf-8');
    writeFileSync(join(sourceDir, 'b.md'), '# Beta\n', 'utf-8');

    const config = makeConfig({ defaultReplace: [defaultOp('needle', 'thread')] });
    const report = await validateAnchorsFor(config, ['a.md', 'b.md']);

    expect(report.violations).toEqual([]);
  });

  it('reports a file op dead in its own file as a violation', async () => {
    writeFileSync(join(sourceDir, 'a.md'), '# Alpha\n', 'utf-8');

    const config = makeConfig({
      files: { 'a.md': fileEntry([fileOp('missing text', 'x')]) },
    });
    const report = await validateAnchorsFor(config, ['a.md']);

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({
      file: 'a.md',
      from: 'missing text',
      matches: 0,
      reason: 'no-match',
      scope: 'file',
    });
  });

  it('reports a file op shadowed by an earlier default op that rewrote its anchor', async () => {
    writeFileSync(join(sourceDir, 'a.md'), 'hello world\n', 'utf-8');

    const config = makeConfig({
      defaultReplace: [defaultOp('hello', 'hi')],
      files: { 'a.md': fileEntry([fileOp('hello world', 'x')]) },
    });
    const report = await validateAnchorsFor(config, ['a.md']);

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({
      file: 'a.md',
      from: 'hello world',
      matches: 0,
      reason: 'no-match',
      scope: 'file',
    });
  });

  it('rejects identity and empty-from ops even when they would match', async () => {
    writeFileSync(join(sourceDir, 'a.md'), 'foo bar\n', 'utf-8');

    const defaultConfig = makeConfig({
      defaultReplace: [defaultOp('foo', 'foo'), defaultOp('', 'x')],
    });
    const defaultReport = await validateAnchorsFor(defaultConfig, ['a.md']);

    expect(defaultReport.violations).toHaveLength(2);
    expect(defaultReport.violations[0]).toMatchObject({
      file: 'all files',
      from: 'foo',
      matches: 1,
      reason: 'identity',
      scope: 'default',
      to: 'foo',
    });
    expect(defaultReport.violations[1]).toMatchObject({
      from: '',
      reason: 'empty-from',
      scope: 'default',
    });

    const fileConfig = makeConfig({
      files: { 'a.md': fileEntry([fileOp('foo bar', 'foo bar')]) },
    });
    const fileReport = await validateAnchorsFor(fileConfig, ['a.md']);

    expect(fileReport.violations).toHaveLength(1);
    expect(fileReport.violations[0]).toMatchObject({
      file: 'a.md',
      from: 'foo bar',
      matches: 1,
      reason: 'identity',
      scope: 'file',
    });
  });

  it('keeps a later op live when an earlier op creates its anchor', async () => {
    writeFileSync(join(sourceDir, 'a.md'), 'hello\n', 'utf-8');

    const config = makeConfig({
      defaultReplace: [defaultOp('hello', 'hello world')],
      files: { 'a.md': fileEntry([fileOp('hello world', 'hi')]) },
    });
    const report = await validateAnchorsFor(config, ['a.md']);

    expect(report.violations).toEqual([]);
  });

  it('validates a file op against its secondary source and reports it dead when absent', async () => {
    const parentDir = join(tmpDir, 'parent');
    const primaryDir = join(parentDir, 'specialists');
    mkdirSync(join(parentDir, 'skills'), { recursive: true });
    mkdirSync(primaryDir, { recursive: true });
    writeFileSync(
      join(parentDir, 'skills', 'handoff.md'),
      '# Handoff Contract\n\n1. **Goal**\n',
      'utf-8',
    );

    const config: ResolvedSyncConfig = {
      configDir: tmpDir,
      configPath: join(tmpDir, 'sync.config.ts'),
      fallback: { append: '', prepend: '', replace: [], stripFrontmatter: false },
      files: {
        'skills/handoff.md': {
          append: '',
          output: join(outputDir, 'handoff', 'SKILL.md'),
          prepend: '',
          replace: [fileOp('Goal', 'Objective')],
          stripFrontmatter: false,
        },
      },
      output: outputDir,
      preserve: [],
      source: primaryDir,
    };

    const liveReport = await validateAnchorsFor(config, []);
    expect(liveReport.violations).toEqual([]);

    const deadConfig = {
      ...config,
      files: {
        'skills/handoff.md': {
          ...config.files['skills/handoff.md'],
          replace: [fileOp('Missing', 'x')],
        },
      },
    };
    const deadReport = await validateAnchorsFor(deadConfig, []);
    expect(deadReport.violations).toHaveLength(1);
    expect(deadReport.violations[0]).toMatchObject({
      file: 'skills/handoff.md',
      from: 'Missing',
      matches: 0,
      reason: 'no-match',
      scope: 'file',
    });
  });

  it('throws ConfigError and writes nothing for a dead anchor in write and check modes', async () => {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(sourceDir, 'a.md'), '# Alpha\n', 'utf-8');
    writeFileSync(join(outputDir, 'sentinel.md'), '# Sentinel\n', 'utf-8');

    const config = makeConfig({ defaultReplace: [defaultOp('missing text', 'x')] });

    await expect(runSync({ config })).rejects.toThrow(ConfigError);
    await expect(runSync({ config })).rejects.toThrow(/Anchor validation failed/u);
    await expect(runSync({ config })).rejects.toThrow(/"missing text" -> "x"/u);
    await expect(runSync({ check: true, config })).rejects.toThrow(ConfigError);
    await expect(runSync({ config, dryRun: true })).rejects.toThrow(ConfigError);

    expect(readdirSync(outputDir)).toEqual(['sentinel.md']);
    expect(readFileSync(join(outputDir, 'sentinel.md'), 'utf-8')).toBe('# Sentinel\n');
  });

  it('writes normally when every anchor is live', async () => {
    writeFileSync(join(sourceDir, 'a.md'), 'hello world\n', 'utf-8');

    const config = makeConfig({
      defaultReplace: [defaultOp('hello world', 'goodbye world')],
    });
    const results = await runSync({ config });

    expect(results.map((result) => result.status)).toEqual(['written']);
    const out = readFileSync(join(outputDir, 'a.md'), 'utf-8');
    expect(out).toContain('goodbye world');
  });
});

// ═══════════════════════════════════════════════
// Plan resolution (single ordered file list)
// ═══════════════════════════════════════════════

describe('resolveSyncPlan', () => {
  let tmpDir: string;
  let sourceDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'core-sync-plan-'));
    sourceDir = join(tmpDir, 'specialists');
    mkdirSync(join(tmpDir, 'skills'), { recursive: true });
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'alpha.md'), '# Alpha\n', 'utf-8');
    writeFileSync(join(sourceDir, 'beta.md'), '# Beta\n', 'utf-8');
    writeFileSync(join(sourceDir, 'notes.txt'), 'notes\n', 'utf-8');
    writeFileSync(join(tmpDir, 'skills', 'handoff.md'), '# Handoff\n', 'utf-8');
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  const makePlanConfig = (files: Record<string, ResolvedFileConfig>): ResolvedSyncConfig => ({
    configDir: tmpDir,
    configPath: join(tmpDir, 'sync.config.ts'),
    files,
    output: join(tmpDir, 'out'),
    preserve: [],
    source: sourceDir,
  });

  it('orders primary .md files before secondary config entries', () => {
    const config = makePlanConfig({
      'alpha.md': configForOutput(join(tmpDir, 'out', 'alpha.md')),
      'skills/handoff.md': configForOutput(join(tmpDir, 'out', 'handoff.md')),
    });

    const { entries } = resolveSyncPlan(config, ['alpha.md', 'beta.md', 'notes.txt'], 'sync');

    expect(entries.map((entry) => [entry.origin, entry.label])).toEqual([
      ['primary', 'alpha.md'],
      ['primary', 'beta.md'],
      ['secondary', 'skills/handoff.md'],
    ]);
    expect(entries.map((entry) => entry.sourcePath)).toEqual([
      join(sourceDir, 'alpha.md'),
      join(sourceDir, 'beta.md'),
      join(tmpDir, 'skills', 'handoff.md'),
    ]);
    expect(entries[0].fileCfg).toBe(config.files['alpha.md']);
    expect(entries[1].fileCfg.output).toBe(join(tmpDir, 'out', 'beta.md'));
  });

  it('resolves verbose diagnostics in source walk order', () => {
    const config = makePlanConfig({
      'alpha.md': configForOutput(join(tmpDir, 'out', 'alpha.md')),
      'skills/handoff.md': configForOutput(join(tmpDir, 'out', 'handoff.md')),
    });

    const { entries, notes } = resolveSyncPlan(
      config,
      ['alpha.md', 'beta.md', 'notes.txt'],
      'check',
    );

    expect(notes).toEqual([
      '[check] No config for beta.md, using defaults',
      '[check] Skipping non-.md file: notes.txt',
    ]);
    expect(entries.map((entry) => entry.logLabel)).toEqual([
      'alpha.md',
      'beta.md',
      'secondary source skills/handoff.md',
    ]);
  });

  it('throws one ConfigError naming every missing secondary entry in declaration order', () => {
    const config = makePlanConfig({
      'aaa-missing.md': configForOutput(join(tmpDir, 'out', 'aaa-missing.md')),
      'skills/handoff.md': configForOutput(join(tmpDir, 'out', 'handoff.md')),
      'zzz-missing.md': configForOutput(join(tmpDir, 'out', 'zzz-missing.md')),
    });

    expect(() => resolveSyncPlan(config, [], 'sync')).toThrow(ConfigError);
    expect(() => resolveSyncPlan(config, [], 'sync')).toThrow(
      'Config entries not found in source or secondary dir: aaa-missing.md, zzz-missing.md',
    );
  });
});

// ═══════════════════════════════════════════════
// preserve option (auto-clean exclusion)
// ═══════════════════════════════════════════════

describe('preserve option', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'core-sync-preserve-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('preserves files matching preserve patterns from auto-clean', async () => {
    const sourceDir = join(tmpDir, 'source');
    const outputDir = join(tmpDir, 'output');
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });

    // A source file that will be synced (so it's in generatedOutputs)
    writeFileSync(join(sourceDir, 'test.md'), '# Test\n', 'utf-8');

    // A file that would be stale (NOT generated by sync)
    writeFileSync(join(outputDir, 'stale.md'), '# Stale\n', 'utf-8');

    // A file matching preserve pattern
    writeFileSync(join(outputDir, 'orchestrator.md'), '# Orchestrator\n', 'utf-8');

    // A file matching preserve pattern with subdirectory
    mkdirSync(join(outputDir, 'subdir'), { recursive: true });
    writeFileSync(join(outputDir, 'subdir', 'keep.md'), '# Keep\n', 'utf-8');

    const config: ResolvedSyncConfig = {
      configDir: tmpDir,
      configPath: join(tmpDir, 'sync.config.ts'),
      files: {},
      output: outputDir,
      preserve: ['orchestrator.md', 'subdir/keep.md'],
      source: sourceDir,
    };

    const results = await runSync({ config });

    // Preserved files should still exist
    expect(existsSync(join(outputDir, 'orchestrator.md'))).toBe(true);
    expect(existsSync(join(outputDir, 'subdir', 'keep.md'))).toBe(true);

    // Non-preserved stale file should be removed
    expect(existsSync(join(outputDir, 'stale.md'))).toBe(false);

    // Synced file should exist
    expect(existsSync(join(outputDir, 'test.md'))).toBe(true);

    // Verify the results: stale.md was removed, orchestrator.md was not
    const removed = results.filter((r) => r.status === 'removed');
    expect(removed.length).toBe(1);
    expect(removed[0].output).toBe(join(outputDir, 'stale.md'));
  });

  it('removes stale files when no preserve patterns match', async () => {
    const sourceDir = join(tmpDir, 'source');
    const outputDir = join(tmpDir, 'output');
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });

    writeFileSync(join(sourceDir, 'test.md'), '# Test\n', 'utf-8');
    writeFileSync(join(outputDir, 'stale.md'), '# Stale\n', 'utf-8');
    writeFileSync(join(outputDir, 'orchestrator.md'), '# Orchestrator\n', 'utf-8');

    // No preserve patterns - both stale files get removed
    const config: ResolvedSyncConfig = {
      configDir: tmpDir,
      configPath: join(tmpDir, 'sync.config.ts'),
      files: {},
      output: outputDir,
      preserve: [],
      source: sourceDir,
    };

    const results = await runSync({ config });

    expect(existsSync(join(outputDir, 'stale.md'))).toBe(false);
    expect(existsSync(join(outputDir, 'orchestrator.md'))).toBe(false);

    const removed = results.filter((r) => r.status === 'removed');
    expect(removed.length).toBe(2);
  });
});

// ═══════════════════════════════════════
// Provenance check
// ═══════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// Secondary source loop (canonical files outside the source dir)
// ═══════════════════════════════════════════════════════════

describe('secondary source loop', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'core-sync-secondary-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('resolves nested keys under the parent of source (e.g. skills/handoff.md)', async () => {
    const sourceParent = join(tmpDir, 'source');
    const sourceDir = join(sourceParent, 'specialists');
    const outputDir = join(tmpDir, 'output');
    mkdirSync(join(sourceParent, 'skills'), { recursive: true });
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });

    // Canonical source lives in a subdirectory of the parent of source -
    // the same layout as packages/core/agent-directives/skills/.
    writeFileSync(
      join(sourceParent, 'skills', 'handoff.md'),
      '# Handoff Contract\n\n1. **Goal**\n',
      'utf-8',
    );

    const config: ResolvedSyncConfig = {
      configDir: tmpDir,
      configPath: join(tmpDir, 'sync.config.ts'),
      files: {
        'skills/handoff.md': {
          append: '',
          output: join(outputDir, 'handoff', 'SKILL.md'),
          prepend: '---\nname: handoff\n---\n\n',
          replace: [],
          stripFrontmatter: false,
        },
      },
      output: outputDir,
      preserve: [],
      source: sourceDir,
    };

    const results = await runSync({ config });

    const written = results.filter((r) => r.status === 'written');
    expect(written).toHaveLength(1);

    const outPath = join(outputDir, 'handoff', 'SKILL.md');
    expect(existsSync(outPath)).toBe(true);
    const out = readFileSync(outPath, 'utf-8');
    expect(out).toContain('name: handoff');
    expect(out).toContain('# Handoff Contract');
  });

  it('throws one ConfigError naming every entry missing from source and secondary dirs', async () => {
    const sourceDir = join(tmpDir, 'specialists');
    const outputDir = join(tmpDir, 'output');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'present.md'), '# Present\n', 'utf-8');

    const config: ResolvedSyncConfig = {
      configDir: tmpDir,
      configPath: join(tmpDir, 'sync.config.ts'),
      files: {
        'commands/foo.md': configForOutput(join(outputDir, 'foo.md')),
        'missing.md': configForOutput(join(outputDir, 'missing.md')),
        'present.md': configForOutput(join(outputDir, 'present.md')),
      },
      output: outputDir,
      preserve: [],
      source: sourceDir,
    };

    await expect(runSync({ config })).rejects.toThrow(ConfigError);
    await expect(runSync({ config })).rejects.toThrow(
      /Config entries not found in source or secondary dir: commands\/foo\.md, missing\.md/u,
    );
    // Resolution fails before any file is processed, so present.md is not written.
    expect(existsSync(outputDir)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// Failure modes and diff output
// ═══════════════════════════════════════════════════════════

describe('failure modes and diff output', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'core-sync-failures-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('throws ConfigError when the source directory is missing', async () => {
    const config: ResolvedSyncConfig = {
      configDir: tmpDir,
      configPath: join(tmpDir, 'sync.config.ts'),
      files: {},
      output: join(tmpDir, 'output'),
      preserve: [],
      source: join(tmpDir, 'missing-source'),
    };

    await expect(runSync({ config })).rejects.toThrow(ConfigError);
    await expect(runSync({ config })).rejects.toThrow(/Source directory not found/u);
  });

  it('logs a unified diff between existing output and transformed content in dry-run', async () => {
    const sourcePath = join(tmpDir, 'source.md');
    const outputPath = join(tmpDir, 'output.md');
    writeFileSync(sourcePath, '# New body\n', 'utf-8');
    writeFileSync(outputPath, '# Old body\n', 'utf-8');

    const logs: string[] = [];
    const result = await processFile(sourcePath, configForOutput(outputPath), {
      diff: true,
      dryRun: true,
      logger: (msg) => {
        logs.push(msg);
      },
      report: 'dry-run',
    });

    expect(result.status).toBe('dry-run');
    const diffOutput = logs.join('\n');
    expect(diffOutput).toContain(`--- ${sourcePath}`);
    expect(diffOutput).toContain(`+++ ${outputPath}`);
    expect(diffOutput).toContain('-# Old body');
    expect(diffOutput).toContain('+# New body');
  });

  it('labels the source path as the old path in check-mode diffs', async () => {
    const sourcePath = join(tmpDir, 'source.md');
    const outputPath = join(tmpDir, 'output.md');
    writeFileSync(sourcePath, '# New body\n', 'utf-8');
    writeFileSync(outputPath, '# Old body\n', 'utf-8');

    const logs: string[] = [];
    const result = await processFile(sourcePath, configForOutput(outputPath), {
      check: true,
      diff: true,
      logger: (msg) => {
        logs.push(msg);
      },
      report: 'check',
    });

    expect(result.status).toBe('error');
    const diffOutput = logs.join('\n');
    expect(diffOutput).toContain(`--- ${sourcePath}`);
    expect(diffOutput).toContain(`+++ ${outputPath}`);
    expect(diffOutput).not.toContain(`--- ${outputPath}`);
  });
});

describe('checkProvenance', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'core-sync-provenance-'));
    // Initialize a minimal git repo in tmpDir
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name test', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email test@test', { cwd: tmpDir, stdio: 'ignore' });
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('passes when output file is unchanged', async () => {
    const sourcePath = join(tmpDir, 'source.md');
    const outputPath = join(tmpDir, 'output.md');

    writeFileSync(sourcePath, '# Source', 'utf-8');

    const fileCfg: ResolvedFileConfig = {
      append: '',
      output: outputPath,
      prepend: '',
      replace: [],
      stripFrontmatter: false,
    };

    // Generate output via processFile (includes auto-generated header)
    await processFile(sourcePath, fileCfg, { logger: () => {}, report: 'sync' });

    // Commit so git state is clean
    execSync('git add -A', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m init', { cwd: tmpDir, stdio: 'ignore' });

    const result = await processFile(sourcePath, fileCfg, {
      check: true,
      logger: () => {},
      report: 'check',
    });

    expect(result.status).toBe('unchanged');
    expect(result.error).toBeUndefined();
  });

  it('detects when output was modified without changing source', async () => {
    const sourcePath = join(tmpDir, 'source.md');
    const outputPath = join(tmpDir, 'output.md');

    writeFileSync(sourcePath, '# Source', 'utf-8');

    const fileCfg: ResolvedFileConfig = {
      append: '',
      output: outputPath,
      prepend: '',
      replace: [],
      stripFrontmatter: false,
    };

    // Generate output from source (includes auto-generated header)
    await processFile(sourcePath, fileCfg, { logger: () => {}, report: 'sync' });

    // Commit so git state is clean
    execSync('git add -A', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m "initial sync"', { cwd: tmpDir, stdio: 'ignore' });

    // Save the correct output content (what processFile generates)
    const correctContent = readFileSync(outputPath, 'utf-8');

    // Stage a different version so git sees output as modified
    writeFileSync(outputPath, '# Wrong content', 'utf-8');
    execSync('git add output.md', { cwd: tmpDir, stdio: 'ignore' });

    // Restore the correct content in the working tree
    writeFileSync(outputPath, correctContent, 'utf-8');

    // Check should detect provenance violation
    const result = await processFile(sourcePath, fileCfg, {
      check: true,
      logger: () => {},
      report: 'check',
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('Provenance violation');
  });

  it('passes when both source and output are modified', async () => {
    const sourcePath = join(tmpDir, 'source.md');
    const outputPath = join(tmpDir, 'output.md');

    writeFileSync(sourcePath, '# Source', 'utf-8');

    const fileCfg: ResolvedFileConfig = {
      append: '',
      output: outputPath,
      prepend: '',
      replace: [],
      stripFrontmatter: false,
    };

    // Generate output (includes auto-generated header)
    await processFile(sourcePath, fileCfg, { logger: () => {}, report: 'sync' });

    // Commit both
    execSync('git add -A', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m "initial sync"', { cwd: tmpDir, stdio: 'ignore' });

    // Edit source
    writeFileSync(sourcePath, '# Source updated', 'utf-8');

    // Re-generate output from updated source (legitimate workflow - both now dirty)
    await processFile(sourcePath, fileCfg, { logger: () => {}, report: 'sync' });

    // Both files have uncommitted changes - check should pass
    const result = await processFile(sourcePath, fileCfg, {
      check: true,
      logger: () => {},
      report: 'check',
    });

    expect(result.status).toBe('unchanged');
  });

  it('passes when a changed sync config regenerates the output', async () => {
    const sourcePath = join(tmpDir, 'source.md');
    const configPath = join(tmpDir, 'sync.config.ts');
    const outputPath = join(tmpDir, 'output.md');

    writeFileSync(sourcePath, '# Source', 'utf-8');
    writeFileSync(configPath, "export default { append: '' };\n", 'utf-8');

    const fileCfg: ResolvedFileConfig = {
      append: '',
      output: outputPath,
      prepend: '',
      replace: [],
      stripFrontmatter: false,
    };

    await processFile(sourcePath, fileCfg, { logger: () => {}, report: 'sync' });

    execSync('git add -A', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m "initial sync"', { cwd: tmpDir, stdio: 'ignore' });

    // The config change drives this regenerated output in the real sync path.
    writeFileSync(configPath, "export default { append: 'Updated\\n' };\n", 'utf-8');
    fileCfg.append = 'Updated\n';
    await processFile(sourcePath, fileCfg, { logger: () => {}, report: 'sync' });

    const result = await processFile(sourcePath, fileCfg, {
      check: true,
      configPath,
      logger: () => {},
      report: 'check',
    });

    expect(result.status).toBe('unchanged');
    expect(result.error).toBeUndefined();
  });

  it('rejects a staged wrong output even when an unrelated sync config is dirty', async () => {
    const sourcePath = join(tmpDir, 'source.md');
    const configPath = join(tmpDir, 'sync.config.ts');
    const outputPath = join(tmpDir, 'output.md');

    writeFileSync(sourcePath, '# Source', 'utf-8');
    writeFileSync(configPath, "export default { append: '' };\n", 'utf-8');

    const fileCfg: ResolvedFileConfig = {
      append: '',
      output: outputPath,
      prepend: '',
      replace: [],
      stripFrontmatter: false,
    };

    await processFile(sourcePath, fileCfg, { logger: () => {}, report: 'sync' });

    execSync('git add -A', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m "initial sync"', { cwd: tmpDir, stdio: 'ignore' });

    const expectedContent = readFileSync(outputPath, 'utf-8');

    // The config is dirty, but this change is unrelated to the output.
    writeFileSync(configPath, "export default { append: '' };\n// unrelated change\n", 'utf-8');

    // Stage an invalid output, then restore the expected working-tree content.
    writeFileSync(outputPath, '# Wrong content', 'utf-8');
    execSync('git add output.md', { cwd: tmpDir, stdio: 'ignore' });
    writeFileSync(outputPath, expectedContent, 'utf-8');

    const result = await processFile(sourcePath, fileCfg, {
      check: true,
      configPath,
      logger: () => {},
      report: 'check',
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('Provenance violation');
  });

  it('rejects a staged deletion when the expected output is restored', async () => {
    const sourcePath = join(tmpDir, 'source.md');
    const outputPath = join(tmpDir, 'output.md');

    writeFileSync(sourcePath, '# Source', 'utf-8');

    const fileCfg: ResolvedFileConfig = {
      append: '',
      output: outputPath,
      prepend: '',
      replace: [],
      stripFrontmatter: false,
    };

    await processFile(sourcePath, fileCfg, { logger: () => {}, report: 'sync' });

    execSync('git add -A', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m "initial sync"', { cwd: tmpDir, stdio: 'ignore' });

    const expectedContent = readFileSync(outputPath, 'utf-8');

    execSync('git rm output.md', { cwd: tmpDir, stdio: 'ignore' });
    writeFileSync(outputPath, expectedContent, 'utf-8');

    const result = await processFile(sourcePath, fileCfg, {
      check: true,
      logger: () => {},
      report: 'check',
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('Provenance violation');
  });

  it('passes when a new untracked canonical source regenerates an existing output', async () => {
    // Simulates the canonicalize-skills workflow: output existed before as a
    // hand-written file, then a brand-new canonical source is added and the
    // output is regenerated from it. The new source is untracked, so git diff
    // alone cannot see it - the check must still pass.
    const sourceDir = join(tmpDir, 'source');
    const outputPath = join(tmpDir, 'output.md');
    mkdirSync(sourceDir, { recursive: true });

    // Old hand-written output committed first
    writeFileSync(outputPath, '# Old hand-written', 'utf-8');
    execSync('git add -A', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m init', { cwd: tmpDir, stdio: 'ignore' });

    // New canonical source (untracked)
    writeFileSync(join(sourceDir, 'handoff.md'), '# Handoff Contract', 'utf-8');

    const fileCfg: ResolvedFileConfig = {
      append: '',
      output: outputPath,
      prepend: '',
      replace: [],
      stripFrontmatter: false,
    };

    // Regenerate output from the new source
    await processFile(join(sourceDir, 'handoff.md'), fileCfg, {
      logger: () => {},
      report: 'sync',
    });

    // Check must not flag a provenance violation
    const result = await processFile(join(sourceDir, 'handoff.md'), fileCfg, {
      check: true,
      logger: () => {},
      report: 'check',
    });

    expect(result.status).toBe('unchanged');
    expect(result.error).toBeUndefined();
  });

  it('skips check when not in a git repo', async () => {
    const nonGitDir = mkdtempSync(join(tmpdir(), 'core-sync-nongit-'));
    try {
      const sourcePath = join(nonGitDir, 'source.md');
      const outputPath = join(nonGitDir, 'output.md');

      writeFileSync(sourcePath, '# Source', 'utf-8');

      const fileCfg: ResolvedFileConfig = {
        append: '',
        output: outputPath,
        prepend: '',
        replace: [],
        stripFrontmatter: false,
      };

      await processFile(sourcePath, fileCfg, {
        logger: () => {},
        report: 'sync',
      });

      // Hand-edit output (no git repo, so check should skip gracefully)
      writeFileSync(outputPath, '# Hand edited', 'utf-8');

      const result = await processFile(sourcePath, fileCfg, {
        check: true,
        logger: () => {},
        report: 'check',
      });

      // Without git, the check skips and falls through to content comparison
      expect(result.status).toBe('error');
      expect(result.error).toBe('Output differs from expected');
    } finally {
      rmSync(nonGitDir, { force: true, recursive: true });
    }
  });

  it('handles output paths containing shell metacharacters without executing them', async () => {
    // Regression test: the provenance check used to interpolate file paths
    // into execSync shell strings. A path like '$(touch PWNED).md' would have
    // been executed as a command. execFileSync passes it as a literal argument.
    const sourcePath = join(tmpDir, 'source.md');
    const outputPath = join(tmpDir, '$(touch PWNED).md');

    writeFileSync(sourcePath, '# Source', 'utf-8');

    const fileCfg: ResolvedFileConfig = {
      append: '',
      output: outputPath,
      prepend: '',
      replace: [],
      stripFrontmatter: false,
    };

    // Generate output via processFile (includes auto-generated header)
    await processFile(sourcePath, fileCfg, { logger: () => {}, report: 'sync' });

    // Commit so git state is clean
    execSync('git add -A', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m init', { cwd: tmpDir, stdio: 'ignore' });

    // Save the correct output content, then stage a different version so git
    // sees output as modified (same pattern as the violation test above)
    const correctContent = readFileSync(outputPath, 'utf-8');
    writeFileSync(outputPath, '# Wrong content', 'utf-8');
    execSync('git add -A', { cwd: tmpDir, stdio: 'ignore' });
    writeFileSync(outputPath, correctContent, 'utf-8');

    const result = await processFile(sourcePath, fileCfg, {
      check: true,
      logger: () => {},
      report: 'check',
    });

    // Provenance violation is detected - and no PWNED file was created by
    // shell command substitution during the check.
    expect(result.status).toBe('error');
    expect(result.error).toContain('Provenance violation');
    expect(existsSync(join(tmpDir, 'PWNED'))).toBe(false);
  });
}, 30_000);

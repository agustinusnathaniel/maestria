import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

// ── Imports ──

import {
  stripFrontmatter,
  findAndReplace,
  serializeFrontmatter,
  stripSourceComment,
  normalizeLineEndings,
} from '../scripts/lib/transforms.js';

import { loadConfig, ConfigError } from '../scripts/lib/config.js';
import { runSync } from '../scripts/lib/sync.js';
import { processFile } from '../scripts/lib/process-file.js';

import type { ReplaceOp, ResolvedSyncConfig, ResolvedFileConfig } from '../scripts/lib/config.js';

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

describe('findAndReplace', () => {
  it('applies a single replacement', () => {
    const ops: ReplaceOp[] = [{ from: 'foo', to: 'bar' }];
    expect(findAndReplace('foo and foo', ops)).toBe('bar and bar');
  });

  it('applies ordered replacements', () => {
    const ops: ReplaceOp[] = [
      { from: 'ab', to: 'cd' },
      { from: 'cd', to: 'ef' },
    ];
    // first pass: ab → cd => "cdcd"
    // second pass: cd → ef => "efef"
    expect(findAndReplace('abab', ops)).toBe('efef');
  });

  it('handles multiple occurrences of the same pattern', () => {
    const ops: ReplaceOp[] = [{ from: 'x', to: 'y' }];
    expect(findAndReplace('x x x', ops)).toBe('y y y');
  });

  it('returns original string when no matches', () => {
    const ops: ReplaceOp[] = [{ from: 'zzz', to: 'aaa' }];
    expect(findAndReplace('hello world', ops)).toBe('hello world');
  });

  it('handles empty ops array', () => {
    expect(findAndReplace('hello', [])).toBe('hello');
  });
});

describe('serializeFrontmatter', () => {
  it('serializes an object to YAML frontmatter', () => {
    const result = serializeFrontmatter({ title: 'Test', order: 1 });
    expect(`---\n${result}`).toContain('---\n');
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

  it('wraps in --- delimiters', () => {
    const result = serializeFrontmatter({ key: 'val' });
    expect(result.startsWith('---\n')).toBe(true);
    expect(result.endsWith('---\n')).toBe(true);
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
    rmSync(tmpDir, { recursive: true, force: true });
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

    expect(config.source).toMatch(/agent-directives$/);
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
      { from: '{{NAME}}', to: 'Default' },
      { from: '{{NAME}}', to: 'Override' },
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
    await expect(loadConfig(missingPath)).rejects.toThrow(/Config file not found/);
  });

  it('throws ConfigError on invalid export (no default)', async () => {
    const configPath = join(tmpDir, 'sync.config.js');
    writeFileSync(configPath, `export const foo = 'bar';\n`, 'utf-8');

    await expect(loadConfig(configPath)).rejects.toThrow(ConfigError);
    await expect(loadConfig(configPath)).rejects.toThrow(/must export a default/);
  });
});

describe('config merge semantics', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'core-sync-merge-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
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
      { from: '{{A}}', to: '1' },
      { from: '{{B}}', to: '2' },
      { from: '{{C}}', to: '3' },
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

    expect(fileCfg.stripFrontmatter).toBe(false); // file overrides
    expect(fileCfg.prepend).toBe('file-prepend\n'); // file overrides
    expect(fileCfg.append).toBe('default-append\n'); // inherited from default
    expect(fileCfg.frontmatter).toEqual({ key: 'file' }); // file overrides
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

// ═══════════════════════════════════════════════
// preserve option (auto-clean exclusion)
// ═══════════════════════════════════════════════

describe('preserve option', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'core-sync-preserve-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
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
      source: sourceDir,
      output: outputDir,
      preserve: ['orchestrator.md', 'subdir/keep.md'],
      files: {},
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
      source: sourceDir,
      output: outputDir,
      preserve: [],
      files: {},
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
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes when output file is unchanged', async () => {
    const sourcePath = join(tmpDir, 'source.md');
    const outputPath = join(tmpDir, 'output.md');

    writeFileSync(sourcePath, '# Source', 'utf-8');

    const fileCfg: ResolvedFileConfig = {
      output: outputPath,
      stripFrontmatter: false,
      replace: [],
      prepend: '',
      append: '',
    };

    // Generate output via processFile (includes auto-generated header)
    await processFile(sourcePath, fileCfg, { report: 'sync', logger: () => {} });

    // Commit so git state is clean
    execSync('git add -A', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m init', { cwd: tmpDir, stdio: 'ignore' });

    const result = await processFile(sourcePath, fileCfg, {
      check: true,
      report: 'check',
      logger: () => {},
    });

    expect(result.status).toBe('unchanged');
    expect(result.error).toBeUndefined();
  });

  it('detects when output was modified without changing source', async () => {
    const sourcePath = join(tmpDir, 'source.md');
    const outputPath = join(tmpDir, 'output.md');

    writeFileSync(sourcePath, '# Source', 'utf-8');

    const fileCfg: ResolvedFileConfig = {
      output: outputPath,
      stripFrontmatter: false,
      replace: [],
      prepend: '',
      append: '',
    };

    // Generate output from source (includes auto-generated header)
    await processFile(sourcePath, fileCfg, { report: 'sync', logger: () => {} });

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
      report: 'check',
      logger: () => {},
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('Provenance violation');
  });

  it('passes when both source and output are modified', async () => {
    const sourcePath = join(tmpDir, 'source.md');
    const outputPath = join(tmpDir, 'output.md');

    writeFileSync(sourcePath, '# Source', 'utf-8');

    const fileCfg: ResolvedFileConfig = {
      output: outputPath,
      stripFrontmatter: false,
      replace: [],
      prepend: '',
      append: '',
    };

    // Generate output (includes auto-generated header)
    await processFile(sourcePath, fileCfg, { report: 'sync', logger: () => {} });

    // Commit both
    execSync('git add -A', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m "initial sync"', { cwd: tmpDir, stdio: 'ignore' });

    // Edit source
    writeFileSync(sourcePath, '# Source updated', 'utf-8');

    // Re-generate output from updated source (legitimate workflow - both now dirty)
    await processFile(sourcePath, fileCfg, { report: 'sync', logger: () => {} });

    // Both files have uncommitted changes - check should pass
    const result = await processFile(sourcePath, fileCfg, {
      check: true,
      report: 'check',
      logger: () => {},
    });

    expect(result.status).toBe('unchanged');
  });

  it('skips check when not in a git repo', async () => {
    const nonGitDir = mkdtempSync(join(tmpdir(), 'core-sync-nongit-'));
    try {
      const sourcePath = join(nonGitDir, 'source.md');
      const outputPath = join(nonGitDir, 'output.md');

      writeFileSync(sourcePath, '# Source', 'utf-8');

      const fileCfg: ResolvedFileConfig = {
        output: outputPath,
        stripFrontmatter: false,
        replace: [],
        prepend: '',
        append: '',
      };

      await processFile(sourcePath, fileCfg, {
        report: 'sync',
        logger: () => {},
      });

      // Hand-edit output (no git repo, so check should skip gracefully)
      writeFileSync(outputPath, '# Hand edited', 'utf-8');

      const result = await processFile(sourcePath, fileCfg, {
        check: true,
        report: 'check',
        logger: () => {},
      });

      // Without git, the check skips and falls through to content comparison
      expect(result.status).toBe('error');
      expect(result.error).toBe('Output differs from expected');
    } finally {
      rmSync(nonGitDir, { recursive: true, force: true });
    }
  });
});

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test';

import {
  MODE_KEYWORDS,
  MODE_MARKERS,
  loadModePrompt,
  getModePrompt,
  detectModeInText,
  buildModeText,
} from '../src/modes-core.js';

// ── Constants ──

describe('MODE_KEYWORDS', () => {
  it('contains fein, sonar, blitz', () => {
    expect(MODE_KEYWORDS).toEqual(['fein', 'sonar', 'blitz']);
  });
});

describe('MODE_MARKERS', () => {
  it('contains markers for all keywords', () => {
    expect(MODE_MARKERS).toEqual({
      blitz: '[MODE: blitz]',
      fein: '[MODE: fein]',
      sonar: '[MODE: sonar]',
    });
  });
});

// ── buildModeText ──

describe('buildModeText', () => {
  it('combines prompt with stripped text', () => {
    expect(buildModeText('[MODE: fein] full', 'implement login')).toBe(
      '[MODE: fein] full\n\nimplement login',
    );
  });

  it('returns prompt only when stripped text is empty', () => {
    expect(buildModeText('[MODE: fein] full', '')).toBe('[MODE: fein] full');
  });

  it('returns prompt only when stripped text is whitespace', () => {
    expect(buildModeText('[MODE: fein] full', '   ')).toBe('[MODE: fein] full\n\n   ');
  });
});

// ── loadModePrompt ──

describe('loadModePrompt', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `maestria-load-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('reads content after ## MODE: marker', () => {
    writeFileSync(
      join(tmpDir, 'fein.md'),
      '# Title\n\nSome intro text.\n\n## MODE: fein\n\nFull pipeline for fein.\n',
    );
    const result = loadModePrompt('fein', tmpDir);
    expect(result).toBe('## MODE: fein\n\nFull pipeline for fein.\n');
  });

  it('returns entire content if no mode marker is found', () => {
    writeFileSync(join(tmpDir, 'sonar.md'), 'Some text without a marker.\n');
    const result = loadModePrompt('sonar', tmpDir);
    expect(result).toBe('Some text without a marker.\n');
  });

  it('trims trailing whitespace before appending newline', () => {
    writeFileSync(join(tmpDir, 'blitz.md'), '## MODE: blitz\n\ncontent   \n  \n');
    const result = loadModePrompt('blitz', tmpDir);
    expect(result).toBe('## MODE: blitz\n\ncontent\n');
  });
});

// ── getModePrompt ──

describe('getModePrompt', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `maestria-prompt-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    // Create minimal prompt files
    for (const kw of MODE_KEYWORDS) {
      writeFileSync(join(tmpDir, `${kw}.md`), `## MODE: ${kw}\n\nFull pipeline for ${kw}.`);
    }
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('returns marker + loaded prompt for a keyword', () => {
    const result = getModePrompt('fein', tmpDir);
    expect(result).toContain('[MODE: fein]');
    expect(result).toContain('Full pipeline for fein.');
  });

  it('separates marker and body with blank line', () => {
    const result = getModePrompt('sonar', tmpDir);
    expect(result).toMatch(/^\[MODE: sonar\]\n\n## MODE:/u);
  });

  it('returns marker with empty body for unknown prompt file', () => {
    // Remove one file to simulate missing prompt
    rmSync(join(tmpDir, 'blitz.md'));
    const result = getModePrompt('blitz', tmpDir);
    // Should still produce the marker, empty body due to catch in getModePrompt
    expect(result).toBe('[MODE: blitz]\n\n');
  });
});

// ── detectModeInText ──

describe('detectModeInText', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `maestria-detect-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    // Create minimal prompt files
    for (const kw of MODE_KEYWORDS) {
      writeFileSync(join(tmpDir, `${kw}.md`), `## MODE: ${kw}\n\nFull pipeline for ${kw}.`);
    }
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('detects fein at start of text', () => {
    const result = detectModeInText('fein implement login', tmpDir);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe('fein');
    expect(result!.strippedText).toBe('implement login');
    expect(result!.prompt).toContain('[MODE: fein]');
  });

  it('detects sonar at start', () => {
    const result = detectModeInText('sonar investigate auth', tmpDir);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe('sonar');
    expect(result!.strippedText).toBe('investigate auth');
  });

  it('detects blitz in middle of text, collapsing double spaces', () => {
    const result = detectModeInText('quick blitz fix', tmpDir);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe('blitz');
    expect(result!.strippedText).toBe('quick fix');
  });

  it('returns null for text without keywords', () => {
    expect(detectModeInText('implement login', tmpDir)).toBeNull();
  });

  it('returns null for empty text', () => {
    expect(detectModeInText('', tmpDir)).toBeNull();
  });

  it('is case insensitive', () => {
    const result = detectModeInText('FEIN implement login', tmpDir);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe('fein');
    expect(result!.strippedText).toBe('implement login');
  });

  it('matches whole words only (not substring)', () => {
    // "coffein" should not match "fein"
    expect(detectModeInText('coffein', tmpDir)).toBeNull();
  });

  it('most restrictive keyword wins (fein > sonar > blitz)', () => {
    // If multiple keywords appear, the most restrictive wins regardless of position
    const r1 = detectModeInText('fein sonar blitz', tmpDir);
    expect(r1).not.toBeNull();
    expect(r1!.keyword).toBe('fein');

    const r2 = detectModeInText('blitz sonar', tmpDir);
    expect(r2).not.toBeNull();
    expect(r2!.keyword).toBe('sonar');

    const r3 = detectModeInText('blitz sonar fein', tmpDir);
    expect(r3).not.toBeNull();
    expect(r3!.keyword).toBe('fein');
  });

  it('does not match inside fenced code blocks', () => {
    const result = detectModeInText('```blitz this```', tmpDir);
    expect(result).toBeNull();
  });

  it('does not match inside inline backtick content', () => {
    const result = detectModeInText('run `blitz` command', tmpDir);
    expect(result).toBeNull();
  });

  it('detects keyword outside code block correctly', () => {
    const result = detectModeInText('some code:\n```\nconst x = 1;\n```\nfein then build', tmpDir);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe('fein');
    // Code fences are preserved; only the keyword is removed. The keyword sat
    // after a newline, so the leftover space stays (trim only strips string ends).
    expect(result!.strippedText).toBe('some code:\n```\nconst x = 1;\n```\n then build');
  });

  it('strips trailing colon after keyword', () => {
    const result = detectModeInText('fein: build the feature', tmpDir);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe('fein');
    expect(result!.strippedText).toBe('build the feature');
  });
});

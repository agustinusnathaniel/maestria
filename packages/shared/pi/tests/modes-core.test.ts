import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
      fein: '[MODE: fein]',
      sonar: '[MODE: sonar]',
      blitz: '[MODE: blitz]',
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
    rmSync(tmpDir, { recursive: true, force: true });
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
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns marker + loaded prompt for a keyword', () => {
    const result = getModePrompt('fein', tmpDir);
    expect(result).toContain('[MODE: fein]');
    expect(result).toContain('Full pipeline for fein.');
  });

  it('separates marker and body with blank line', () => {
    const result = getModePrompt('sonar', tmpDir);
    expect(result).toMatch(/^\[MODE: sonar\]\n\n## MODE:/);
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
    rmSync(tmpDir, { recursive: true, force: true });
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

  it('detects blitz in middle of text', () => {
    const result = detectModeInText('quick blitz fix', tmpDir);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe('blitz');
    expect(result!.strippedText).toBe('quick  fix');
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

  it('detects first matching keyword in iteration order (fein > sonar > blitz)', () => {
    // If multiple keywords appear, the first in iteration order wins
    const result = detectModeInText('fein sonar blitz', tmpDir);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe('fein');
  });
});

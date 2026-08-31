import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  buildModeText,
  detectModeInText,
  getModePrompt,
  loadModePrompt,
  MODE_KEYWORDS,
  MODE_MARKERS,
} from '../src/modes-core.js';
import type { ModeDetectResult } from '../src/modes-core.js';

const requireModeResult = (result: ModeDetectResult | null): ModeDetectResult => {
  if (result === null) {
    throw new Error('Expected a mode detection result');
  }
  return result;
};

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
    tmpDir = path.join(tmpdir(), `maestria-load-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('reads content after ## MODE: marker', () => {
    writeFileSync(
      path.join(tmpDir, 'fein.md'),
      '# Title\n\nSome intro text.\n\n## MODE: fein\n\nFull pipeline for fein.\n',
    );
    const result = loadModePrompt('fein', tmpDir);
    expect(result).toBe('## MODE: fein\n\nFull pipeline for fein.\n');
  });

  it('returns entire content if no mode marker is found', () => {
    writeFileSync(path.join(tmpDir, 'sonar.md'), 'Some text without a marker.\n');
    const result = loadModePrompt('sonar', tmpDir);
    expect(result).toBe('Some text without a marker.\n');
  });

  it('trims trailing whitespace before appending newline', () => {
    writeFileSync(path.join(tmpDir, 'blitz.md'), '## MODE: blitz\n\ncontent   \n  \n');
    const result = loadModePrompt('blitz', tmpDir);
    expect(result).toBe('## MODE: blitz\n\ncontent\n');
  });
});

// ── getModePrompt ──

describe('getModePrompt', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `maestria-prompt-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    // Create minimal prompt files
    for (const kw of MODE_KEYWORDS) {
      writeFileSync(path.join(tmpDir, `${kw}.md`), `## MODE: ${kw}\n\nFull pipeline for ${kw}.`);
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
    rmSync(path.join(tmpDir, 'blitz.md'));
    const result = getModePrompt('blitz', tmpDir);
    // Should still produce the marker, empty body due to catch in getModePrompt
    expect(result).toBe('[MODE: blitz]\n\n');
  });
});

// ── detectModeInText ──

describe('detectModeInText', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `maestria-detect-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    // Create minimal prompt files
    for (const kw of MODE_KEYWORDS) {
      writeFileSync(path.join(tmpDir, `${kw}.md`), `## MODE: ${kw}\n\nFull pipeline for ${kw}.`);
    }
  });

  afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('detects fein at start of text', () => {
    const result = detectModeInText('fein implement login', tmpDir);
    expect(result).not.toBeNull();
    const detected = requireModeResult(result);
    expect(detected.keyword).toBe('fein');
    expect(detected.strippedText).toBe('implement login');
    expect(detected.prompt).toContain('[MODE: fein]');
  });

  it('detects sonar at start', () => {
    const result = detectModeInText('sonar investigate auth', tmpDir);
    expect(result).not.toBeNull();
    const detected = requireModeResult(result);
    expect(detected.keyword).toBe('sonar');
    expect(detected.strippedText).toBe('investigate auth');
  });

  it('detects blitz in middle of text, collapsing double spaces', () => {
    const result = detectModeInText('quick blitz fix', tmpDir);
    expect(result).not.toBeNull();
    const detected = requireModeResult(result);
    expect(detected.keyword).toBe('blitz');
    expect(detected.strippedText).toBe('quick fix');
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
    const detected = requireModeResult(result);
    expect(detected.keyword).toBe('fein');
    expect(detected.strippedText).toBe('implement login');
  });

  it('matches whole words only (not substring)', () => {
    // "coffein" should not match "fein"
    expect(detectModeInText('coffein', tmpDir)).toBeNull();
  });

  it('most restrictive keyword wins (fein > sonar > blitz)', () => {
    // If multiple keywords appear, the most restrictive wins regardless of position
    const r1 = detectModeInText('fein sonar blitz', tmpDir);
    expect(r1).not.toBeNull();
    expect(requireModeResult(r1).keyword).toBe('fein');

    const r2 = detectModeInText('blitz sonar', tmpDir);
    expect(r2).not.toBeNull();
    expect(requireModeResult(r2).keyword).toBe('sonar');

    const r3 = detectModeInText('blitz sonar fein', tmpDir);
    expect(r3).not.toBeNull();
    expect(requireModeResult(r3).keyword).toBe('fein');
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
    const detected = requireModeResult(result);
    expect(detected.keyword).toBe('fein');
    // Code fences are preserved; only the keyword is removed. The keyword sat
    // after a newline, so the leftover space stays (trim only strips string ends).
    expect(detected.strippedText).toBe('some code:\n```\nconst x = 1;\n```\n then build');
  });

  it('strips trailing colon after keyword', () => {
    const result = detectModeInText('fein: build the feature', tmpDir);
    expect(result).not.toBeNull();
    const detected = requireModeResult(result);
    expect(detected.keyword).toBe('fein');
    expect(detected.strippedText).toBe('build the feature');
  });
});

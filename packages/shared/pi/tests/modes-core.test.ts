import { MODE_KEYWORDS } from '@maestria/shared-mode';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { buildModeText, detectModeInText, getModePrompt, loadModePrompt } from '@/modes-core.js';
import type { ModeDetectResult } from '@/modes-core.js';

const requireModeResult = (result: ModeDetectResult | null): ModeDetectResult => {
  if (result === null) {
    throw new Error('Expected a mode detection result');
  }
  return result;
};

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
});

// ── getModePrompt ──

describe('getModePrompt', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'maestria-prompt-'));
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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Remove one file to simulate missing prompt
    rmSync(path.join(tmpDir, 'blitz.md'));
    try {
      const result = getModePrompt('blitz', tmpDir);
      // Should still produce the marker, empty body due to catch in getModePrompt
      expect(result).toBe('[MODE: blitz]\n\n');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load mode prompt "blitz"'),
        expect.any(Error),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('loads prompt content independently for each commands directory', () => {
    const initial = getModePrompt('fein', tmpDir);
    expect(initial).toContain('Full pipeline for fein.');

    const alternateDir = mkdtempSync(path.join(tmpdir(), 'maestria-prompt-alt-'));
    try {
      writeFileSync(
        path.join(alternateDir, 'fein.md'),
        '## MODE: fein\n\nAlternate pipeline for fein.',
      );
      expect(getModePrompt('fein', alternateDir)).toContain('Alternate pipeline for fein.');
    } finally {
      rmSync(alternateDir, { force: true, recursive: true });
    }
  });
});

// ── detectModeInText ──

describe('detectModeInText', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'maestria-detect-'));
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

  it('returns null for text without keywords', () => {
    expect(detectModeInText('implement login', tmpDir)).toBeNull();
  });

  it('returns null for empty text', () => {
    expect(detectModeInText('', tmpDir)).toBeNull();
  });
});

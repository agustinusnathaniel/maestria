import { describe, it, expect } from 'vite-plus/test';
import {
  MODE_KEYWORDS,
  VALID_KEYWORDS,
  MODE_MARKERS,
  MODE_PRIORITY,
  CODE_BLOCK_RE,
  findCodeBlockRanges,
  extractModeSection,
  detectMode,
  stripKeyword,
  getModeMarker,
} from '../src/index.js';

describe('MODE_KEYWORDS', () => {
  it('contains fein, sonar, blitz', () => {
    expect(MODE_KEYWORDS).toEqual(['fein', 'sonar', 'blitz']);
  });
  it('VALID_KEYWORDS aliases MODE_KEYWORDS', () => {
    expect(VALID_KEYWORDS).toEqual(MODE_KEYWORDS);
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

describe('MODE_PRIORITY', () => {
  it('fein > sonar > blitz', () => {
    expect(MODE_PRIORITY.fein).toBe(3);
    expect(MODE_PRIORITY.sonar).toBe(2);
    expect(MODE_PRIORITY.blitz).toBe(1);
  });
});

describe('CODE_BLOCK_RE', () => {
  it('matches fenced blocks and inline spans', () => {
    expect('```blitz```'.match(CODE_BLOCK_RE)).not.toBeNull();
    expect('`blitz`'.match(CODE_BLOCK_RE)).not.toBeNull();
  });
  it('does not treat unclosed fence as fenced block (accepted false-positive per ADR-OC-003)', () => {
    // The regex requires closing ``` for fenced blocks; an unclosed triple
    // is not a fenced range. Inline `` may match as an empty span, but the
    // keyword after remains detectable.
    expect(detectMode('``` unclosed\nfein build')).not.toBeNull();
    expect(detectMode('``` unclosed\nfein build')!.mode).toBe('fein');
  });
});

describe('findCodeBlockRanges', () => {
  it('finds ranges for fenced and inline code', () => {
    const text = 'a ```code``` b `inline` c';
    const ranges = findCodeBlockRanges(text);
    expect(ranges.length).toBe(2);
  });
});

describe('extractModeSection', () => {
  it('extracts from ## MODE: marker', () => {
    const content = '# Title\n\nSome intro.\n\n## MODE: fein\n\nFull pipeline.\n';
    expect(extractModeSection(content)).toBe('## MODE: fein\n\nFull pipeline.\n');
  });
  it('returns entire content if no marker', () => {
    const content = 'Some text without marker.\n';
    expect(extractModeSection(content)).toBe('Some text without marker.\n');
  });
  it('trims trailing whitespace before newline', () => {
    expect(extractModeSection('## MODE: blitz\n\ncontent   \n  \n')).toBe(
      '## MODE: blitz\n\ncontent\n',
    );
  });
  it('handles HTML comment preamble (opencode command files)', () => {
    const content = '<!-- Auto-generated -->\n\n## MODE: sonar\n\nResearch only.\n';
    expect(extractModeSection(content)).toBe('## MODE: sonar\n\nResearch only.\n');
  });
});

describe('getModeMarker', () => {
  it('returns marker for valid keyword', () => {
    expect(getModeMarker('fein')).toBe('[MODE: fein]');
    expect(getModeMarker('sonar')).toBe('[MODE: sonar]');
  });
  it('returns empty for unknown', () => {
    expect(getModeMarker('unknown')).toBe('');
  });
});

describe('detectMode', () => {
  it('detects at start', () => {
    const r = detectMode('fein build the feature');
    expect(r).not.toBeNull();
    expect(r!.mode).toBe('fein');
    expect(r!.keyword).toBe('fein');
    expect(r!.index).toBe(0);
  });
  it('detects in middle', () => {
    const r = detectMode("let's sonar this design");
    expect(r!.mode).toBe('sonar');
  });
  it('most restrictive wins regardless of position', () => {
    expect(detectMode('fein sonar blitz')!.mode).toBe('fein');
    expect(detectMode('blitz sonar fein')!.mode).toBe('fein');
    expect(detectMode('blitz sonar')!.mode).toBe('sonar');
  });
  it('priority fein > sonar > blitz', () => {
    expect(detectMode('blitz sonar')!.mode).toBe('sonar');
    expect(detectMode('sonar blitz')!.mode).toBe('sonar');
  });
  it('null when no keyword', () => {
    expect(detectMode('please implement')).toBeNull();
  });
  it('case insensitive', () => {
    expect(detectMode('FEIN upper')!.mode).toBe('fein');
    expect(detectMode('Sonar title')!.mode).toBe('sonar');
    expect(detectMode('BLITZ')!.mode).toBe('blitz');
  });
  it('does not match inside word (coffein)', () => {
    expect(detectMode('coffein')).toBeNull();
    expect(detectMode('feinish')).toBeNull();
    expect(detectMode('blitzkrieg')).toBeNull();
  });
  it('does not match inside fenced code blocks', () => {
    expect(detectMode('```blitz this```')).toBeNull();
  });
  it('detects outside code block', () => {
    const r = detectMode('some code:\n```\nconst x=1;\n```\nfein then build');
    expect(r!.mode).toBe('fein');
  });
  it('does not match inside inline backticks', () => {
    expect(detectMode('run `blitz` command')).toBeNull();
  });
  it('matches hyphenated (sonar-like)', () => {
    expect(detectMode('sonar-like exploration')!.mode).toBe('sonar');
  });
  it('respects disabled keywords (case-insensitive)', () => {
    const r = detectMode('fein research then blitz build', new Set(['Blitz']));
    expect(r!.mode).toBe('fein');
    expect(detectMode('fein research', new Set(['fein', 'sonar', 'blitz']))).toBeNull();
  });
  it('handles empty string', () => {
    expect(detectMode('')).toBeNull();
  });
  it('detects with trailing colon', () => {
    const r = detectMode('fein: build the feature');
    expect(r!.mode).toBe('fein');
    expect(r!.index).toBe(0);
  });
  it('unclosed fence not excluded', () => {
    const r = detectMode('``` unclosed\nfein build');
    expect(r!.mode).toBe('fein');
  });
});

describe('stripKeyword', () => {
  it('removes keyword and trailing colon', () => {
    const r = detectMode('fein: build the feature')!;
    expect(stripKeyword('fein: build the feature', r)).toBe('build the feature');
  });
  it('collapses double spaces when keyword in middle', () => {
    const r = detectMode('quick blitz fix')!;
    expect(stripKeyword('quick blitz fix', r)).toBe('quick fix');
  });
  it('trims ends', () => {
    const r = detectMode('fein build')!;
    expect(stripKeyword('fein build', r)).toBe('build');
  });
  it('handles keyword at end', () => {
    const r = detectMode('implement it blitz')!;
    expect(stripKeyword('implement it blitz', r)).toBe('implement it');
  });
});

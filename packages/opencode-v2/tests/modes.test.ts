import { describe, it, expect } from 'vite-plus/test';
import { detectMode } from '../src/modes/index.js';

describe('detectMode', () => {
  it('matches whole-word keywords case-insensitively', () => {
    const result = detectMode('please run this FEIN mode');
    expect(result).not.toBeNull();
    expect(result?.mode).toBe('fein');
    expect(result?.keyword).toBe('FEIN');
  });

  it('does not match keywords embedded in larger words', () => {
    expect(detectMode('this is feinstein university')).toBeNull();
  });

  it('honors priority: fein beats sonar beats blitz', () => {
    const result = detectMode('blitz then sonar then fein');
    expect(result?.mode).toBe('fein');
  });

  it('skips disabled keywords', () => {
    const disabled = new Set(['fein']);
    expect(detectMode('go fein or sonar', disabled)?.mode).toBe('sonar');
  });

  it('returns null when every keyword is disabled', () => {
    const disabled = new Set(['fein', 'sonar', 'blitz']);
    expect(detectMode('fein blitz sonar', disabled)).toBeNull();
  });

  it('ignores keywords inside triple-backtick code fences', () => {
    expect(detectMode('```\nfein\n```')).toBeNull();
  });

  it('still matches a keyword outside a code fence in the same message', () => {
    const text = '```\nfein\n```\nnow do it in blitz style';
    expect(detectMode(text)?.mode).toBe('blitz');
  });

  it('returns null when no keyword is present', () => {
    expect(detectMode('plain message with no modes')).toBeNull();
  });
});

import { describe, expect, it } from 'vite-plus/test';
import { detectMode, getModePrompt } from '../src/modes.js';

// Pure detection (word-boundary, priority, code fences, disabled keywords)
// is covered by @maestria/shared-mode; these pin the V2 augmentation.
describe('detectMode', () => {
  it('augments the shared result with marker and prompt', () => {
    const result = detectMode('fein plan the work');
    expect(result).not.toBeNull();
    expect(result?.mode).toBe('fein');
    expect(result?.marker).toBe('[MODE: fein]');
    expect(result?.prompt).toBe(getModePrompt('fein'));
    expect(result?.prompt.length).toBeGreaterThan(0);
  });

  it('returns null when no keyword is present', () => {
    expect(detectMode('plain message with no modes')).toBeNull();
  });

  it('passes disabled keywords through to shared detection', () => {
    expect(detectMode('go fein or sonar', new Set(['fein']))?.mode).toBe('sonar');
    expect(detectMode('fein blitz sonar', new Set(['fein', 'sonar', 'blitz']))).toBeNull();
  });
});

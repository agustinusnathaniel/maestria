import { describe, it, expect } from 'vite-plus/test';
import * as shell from '@/lib/shell.js';

describe('shell execution', () => {
  it('exports CommandError class', () => {
    expect(shell.CommandError).toBeDefined();
  });
  it('exports run function', () => {
    expect(typeof shell.run).toBe('function');
  });
  it('exports sh function', () => {
    expect(typeof shell.sh).toBe('function');
  });
});

import { describe, it, expect } from 'vite-plus/test';
import * as shell from '@/lib/shell.js';

describe('shell execution', () => {
  it('exports CommandError class', () => {
    expect(shell.CommandError).toBeDefined();
  });
  it('exports run function', () => {
    expect(typeof shell.run).toBe('function');
  });
  it('exports readTextFile function', () => {
    expect(typeof shell.readTextFile).toBe('function');
  });
  it('exports fileExists function', () => {
    expect(typeof shell.fileExists).toBe('function');
  });
});

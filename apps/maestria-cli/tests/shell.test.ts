import { describe, it, expect } from 'vite-plus/test';

describe('shell execution', () => {
  it('exports CommandError class', async () => {
    const shell = await import('../src/lib/shell.js');
    expect(shell.CommandError).toBeDefined();
  });
  it('exports run function', async () => {
    const shell = await import('../src/lib/shell.js');
    expect(typeof shell.run).toBe('function');
  });
  it('exports sh function', async () => {
    const shell = await import('../src/lib/shell.js');
    expect(typeof shell.sh).toBe('function');
  });
});

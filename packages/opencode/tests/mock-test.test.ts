import { describe, it, expect, vi } from 'vite-plus/test';

// Suppress expected console.error noise from ENOENT error path
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock fs to simulate a missing agents directory.
// This must be in a separate file because vi.mock is hoisted and would
// affect the normal tests in index.test.ts.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readdirSync: () => {
      throw new Error('ENOENT');
    },
  };
});

describe('plugin error handling', () => {
  it('should throw when agents directory is missing', async () => {
    const { MaestriaPlugin } = await import('@/index.js');
    await expect(MaestriaPlugin({} as never)).rejects.toThrow(/Failed to load agents/);
  });
});

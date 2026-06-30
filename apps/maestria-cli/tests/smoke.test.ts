import { describe, it, expect } from 'vite-plus/test';

describe('CLI structure', () => {
  it('package.json has correct name', async () => {
    const pkg = await import('../package.json', { with: { type: 'json' } });
    expect(pkg.default.name).toBe('maestria');
  });
  it('has bin entry', async () => {
    const pkg = await import('../package.json', { with: { type: 'json' } });
    expect(pkg.default.bin).toBeDefined();
    expect(pkg.default.bin.maestria).toBe('./dist/index.js');
  });
  it('has correct src/index.ts structure', async () => {
    const fs = await import('node:fs');
    const testDir = new URL('.', import.meta.url);
    const content = fs.readFileSync(new URL('../src/index.ts', testDir), 'utf-8');
    expect(content).toContain('runMain');
  });
});

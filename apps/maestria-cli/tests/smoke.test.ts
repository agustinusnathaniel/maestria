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
  it('exports main module without crashing', async () => {
    const mod = await import('../src/index.js');
    expect(mod).toBeDefined();
  });
});

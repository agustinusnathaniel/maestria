import { describe, it, expect } from 'vite-plus/test';

describe('dist bundle', () => {
  it('should import MaestriaPlugin from the built dist', async () => {
    // @ts-ignore - dist/ is a build artifact, not present during type-checking
    const mod = await import('../dist/index.js');
    expect(mod).toHaveProperty('MaestriaPlugin');
    expect(typeof mod.MaestriaPlugin).toBe('function');
  });

  it('should return a plugin object with expected hooks', async () => {
    // @ts-ignore - dist/ is a build artifact, not present during type-checking
    const { MaestriaPlugin } = await import('../dist/index.js');
    const plugin = await MaestriaPlugin({} as never, {});
    expect(plugin).toHaveProperty('config');
    expect(plugin).toHaveProperty('chat.message');
    expect(plugin).toHaveProperty('experimental.session.compacting');
  });
});

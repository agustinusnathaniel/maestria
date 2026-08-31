import { describe, expect, it } from 'vite-plus/test';

import { pluginInput } from './helpers.js';

describe('dist bundle', () => {
  it('should import MaestriaPlugin from the built dist', async () => {
    const mod = await import('../dist/index.js');
    expect(mod).toHaveProperty('MaestriaPlugin');
    expect(typeof mod.MaestriaPlugin).toBe('function');
  }, 60_000);

  it('should return a plugin object with expected hooks', async () => {
    const { MaestriaPlugin } = await import('../dist/index.js');
    const plugin = await MaestriaPlugin(pluginInput, {});
    expect(plugin).toHaveProperty('config');
    expect(plugin).toHaveProperty('chat.message');
    expect(plugin).toHaveProperty('experimental.session.compacting');
  }, 60_000);
});

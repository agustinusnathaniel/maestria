import type { Config } from '@opencode-ai/plugin';
import { existsSync } from 'node:fs';
import path from 'node:path';
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
    expect(plugin).toHaveProperty('experimental.chat.system.transform');
    expect(plugin).toHaveProperty('experimental.session.compacting');
  }, 60_000);

  it('registers the packaged skills directory from the built dist', async () => {
    const { MaestriaPlugin } = await import('../dist/index.js');
    const plugin = await MaestriaPlugin(pluginInput, {});
    // The plugin SDK's v1 Config type predates `skills`; OpenCode reads `skills.paths` at runtime.
    const config: Config & { skills?: { paths?: string[] } } = { agent: {} };
    await plugin.config?.(config);
    const [bundled = ''] = config.skills?.paths ?? [];
    expect(bundled).toBe(path.resolve(import.meta.dirname, '..', 'skills'));
    expect(existsSync(path.join(bundled, 'create-pull-request', 'SKILL.md'))).toBe(true);
  }, 60_000);
});

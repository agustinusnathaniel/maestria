import { describe, it, expect } from 'vite-plus/test';
import plugin from '../src/index.js';

describe('maestria-v2 plugin', () => {
  it('should define a plugin with id maestria.v2', () => {
    expect(plugin).toBeDefined();
    expect(plugin.id).toBe('maestria.v2');
  });
});

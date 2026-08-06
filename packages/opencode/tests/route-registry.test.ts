import { describe, expect, it } from 'vite-plus/test';
import { RouteRegistry } from '@/route-registry.js';

describe('RouteRegistry', () => {
  it('starts each root user turn in the fail-closed state', () => {
    const registry = new RouteRegistry();

    registry.beginTurn('root');
    expect(registry.isRootSession('root')).toBe(true);
    expect(registry.get('root')).toBeNull();

    registry.select('root', 'focused');
    registry.beginTurn('root');
    expect(registry.get('root')).toBeNull();
  });

  it('rejects conflicting reselection during one turn', () => {
    const registry = new RouteRegistry();
    registry.beginTurn('root');
    registry.select('root', 'direct');

    expect(() => registry.select('root', 'full')).toThrow(/already selected as "direct"/);
    expect(registry.get('root')).toBe('direct');
    expect(() => registry.select('root', 'direct')).not.toThrow();
  });

  it('does not register unknown or cleared sessions', () => {
    const registry = new RouteRegistry();

    expect(registry.isRootSession('child')).toBe(false);
    expect(() => registry.select('child', 'direct')).toThrow(/unregistered session/);

    registry.beginTurn('root');
    registry.clear('root');
    expect(registry.isRootSession('root')).toBe(false);
    expect(registry.get('root')).toBeUndefined();
  });

  it('permits one-way direct to landing-review transition and one reviewer dispatch', () => {
    const registry = new RouteRegistry();
    registry.beginTurn('root');
    registry.select('root', 'direct');
    registry.select('root', 'landing-review');

    expect(registry.get('root')).toBe('landing-review');
    expect(() => registry.select('root', 'direct')).toThrow(/one-way/);
    expect(() => registry.select('root', 'focused')).toThrow(/one-way/);
  });

  it.each([null, 'focused', 'full'] as const)('rejects landing review from %s', (route) => {
    const registry = new RouteRegistry();
    registry.beginTurn('root');
    if (route) registry.select('root', route);

    expect(() => registry.select('root', 'landing-review')).toThrow(/only available.*direct/);
  });
});

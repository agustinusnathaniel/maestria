import { describe, expect, it } from 'vite-plus/test';
import { createMaestriaRouteTool } from '@/route-tool.js';
import { RouteRegistry } from '@/route-registry.js';

function context(sessionID: string, agent = 'orchestrator') {
  return {
    sessionID,
    messageID: 'message',
    agent,
    directory: '/project',
    worktree: '/project',
    abort: new AbortController().signal,
    metadata: () => undefined,
    ask: async () => undefined,
  };
}

describe('maestria_route tool', () => {
  it('selects a route for the root orchestrator', async () => {
    const registry = new RouteRegistry();
    registry.beginTurn('root');
    const routeTool = createMaestriaRouteTool(registry);

    const result = await routeTool.execute({ route: 'direct' }, context('root'));

    expect(registry.get('root')).toBe('direct');
    expect(result).toMatchObject({ title: 'Route selected: direct' });
  });

  it('does not let specialists select a root route', async () => {
    const registry = new RouteRegistry();
    const routeTool = createMaestriaRouteTool(registry);

    const result = await routeTool.execute({ route: 'full' }, context('child', 'builder'));

    expect(result).toMatchObject({ title: 'maestria_route' });
    expect(registry.isRootSession('child')).toBe(false);
  });

  it('surfaces conflicting selection instead of silently changing route', async () => {
    const registry = new RouteRegistry();
    registry.beginTurn('root');
    registry.select('root', 'focused');
    const routeTool = createMaestriaRouteTool(registry);

    await expect(routeTool.execute({ route: 'full' }, context('root'))).rejects.toThrow(
      /already selected as "focused"/,
    );
  });

  it('transitions direct work into landing review without reopening direct tools', async () => {
    const registry = new RouteRegistry();
    registry.beginTurn('root');
    registry.select('root', 'direct');
    const routeTool = createMaestriaRouteTool(registry);

    const result = await routeTool.execute({ route: 'landing-review' }, context('root'));

    expect(registry.get('root')).toBe('landing-review');
    expect(result).toMatchObject({ title: 'Route selected: landing-review' });
    expect(() => registry.select('root', 'full')).toThrow(/one-way/);
  });
});

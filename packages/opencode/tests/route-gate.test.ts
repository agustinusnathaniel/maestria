import { describe, expect, it } from 'vite-plus/test';
import {
  assertToolAllowed,
  isToolAllowed,
  LANDING_REVIEW_TOOL,
  MAESTRIA_ROUTE_TOOL,
} from '@/route-gate.js';

describe('route gate policy', () => {
  it('allows only the selector before a route is selected', () => {
    expect(isToolAllowed(null, MAESTRIA_ROUTE_TOOL)).toBe(true);
    expect(isToolAllowed(null, 'read')).toBe(false);
    expect(isToolAllowed(null, 'task')).toBe(false);
  });

  it('allows native tools in direct mode except task, batch, and shipping', () => {
    expect(isToolAllowed('direct', 'read')).toBe(true);
    expect(isToolAllowed('direct', 'bash')).toBe(true);
    expect(isToolAllowed('direct', 'skill')).toBe(true);
    expect(isToolAllowed('direct', 'task')).toBe(false);
    expect(isToolAllowed('direct', 'batch')).toBe(false);
    expect(isToolAllowed('direct', 'codegraph_explore')).toBe(false);
    expect(isToolAllowed('direct', 'bash', { command: 'git commit -m ship' })).toBe(false);
    expect(isToolAllowed('direct', 'bash', { command: 'git push origin feature' })).toBe(false);
    expect(isToolAllowed('direct', 'bash', { command: 'gh pr create --fill' })).toBe(false);
    expect(isToolAllowed('direct', MAESTRIA_ROUTE_TOOL, { route: 'landing-review' })).toBe(true);
    expect(isToolAllowed('direct', MAESTRIA_ROUTE_TOOL, { route: 'focused' })).toBe(false);
  });

  it('allows only the plugin review tool while armed', () => {
    expect(isToolAllowed('landing-review', LANDING_REVIEW_TOOL, undefined, 'armed')).toBe(true);
    expect(isToolAllowed('landing-review', 'task', { subagent_type: 'reviewer' }, 'armed')).toBe(
      false,
    );
    expect(isToolAllowed('landing-review', 'read', undefined, 'armed')).toBe(false);
    expect(isToolAllowed('landing-review', 'bash', { command: 'git status' }, 'armed')).toBe(false);
  });

  it('allows only tightly parsed shipping commands after approval', () => {
    expect(isToolAllowed('landing-review', 'bash', { command: 'git status' }, 'approved')).toBe(
      true,
    );
    expect(
      isToolAllowed('landing-review', 'bash', { command: 'git commit -m ship' }, 'approved'),
    ).toBe(true);
    expect(
      isToolAllowed('landing-review', 'bash', { command: 'git push origin feature' }, 'approved'),
    ).toBe(true);
    expect(
      isToolAllowed(
        'landing-review',
        'bash',
        { command: 'gh pr create --base main --head feature' },
        'approved',
      ),
    ).toBe(true);
    expect(
      isToolAllowed(
        'landing-review',
        'bash',
        { command: 'git push --force origin feature' },
        'approved',
      ),
    ).toBe(false);
    expect(
      isToolAllowed('landing-review', 'bash', { command: 'git push origin main' }, 'approved'),
    ).toBe(false);
    expect(
      isToolAllowed(
        'landing-review',
        'bash',
        { command: 'gh pr create --base main --head feature' },
        'approved',
      ),
    ).toBe(true);
    expect(
      isToolAllowed('landing-review', 'bash', { command: 'gh pr create --head main' }, 'approved'),
    ).toBe(false);
    expect(
      isToolAllowed('landing-review', 'bash', { command: 'git push && rm -rf /' }, 'approved'),
    ).toBe(false);
    expect(isToolAllowed('landing-review', 'edit', undefined, 'approved')).toBe(false);
  });

  it.each(['focused', 'full'] as const)('allows only dispatcher tools in %s mode', (route) => {
    expect(isToolAllowed(route, MAESTRIA_ROUTE_TOOL)).toBe(true);
    expect(isToolAllowed(route, 'task')).toBe(true);
    expect(isToolAllowed(route, 'question')).toBe(true);
    expect(isToolAllowed(route, 'todowrite')).toBe(true);
    expect(isToolAllowed(route, 'read')).toBe(false);
    expect(isToolAllowed(route, 'skill')).toBe(false);
    expect(isToolAllowed(route, 'codegraph_explore')).toBe(false);
  });

  it('throws a route gate error for denied tools', () => {
    expect(() => assertToolAllowed('focused', 'edit')).toThrow(/does not permit tool "edit"/);
  });
});

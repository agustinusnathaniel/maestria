import { describe, expect, it } from 'vite-plus/test';
import { MaestriaPlugin } from '@/index.js';
import { getRouteForMode } from '@/modes/index.js';
import { computeArtifactDigest } from '@/landing-review.js';

function message(text: string, sessionID = 'root', agent = 'orchestrator') {
  return {
    input: { sessionID, agent },
    output: {
      message: { id: 'message', sessionID, role: 'user', time: { created: 1 }, agent },
      parts: [{ id: 'part', sessionID, messageID: 'message', type: 'text', text }],
    },
  };
}

function branchShell(branch = 'feature/review') {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    void strings;
    void values;
    return { cwd: () => ({ text: async () => `${branch}\n` }) };
  };
}

function reviewerClient(
  verdict: 'approved' | 'rejected' | 'malformed' = 'approved',
  failure: 'none' | 'parent' | 'response' = 'none',
) {
  const state = { version: 1 };
  const client = {
    file: {
      status: async () => ({
        data: [{ path: 'src/file.ts', status: 'modified', added: state.version, removed: 0 }],
      }),
    },
    session: {
      diff: async () => ({
        data: [
          {
            file: 'src/file.ts',
            before: 'old',
            after: String(state.version),
            additions: 1,
            deletions: 0,
          },
        ],
      }),
      create: async ({ body }: { body: { parentID: string } }) => ({
        data: {
          id: 'reviewer-child',
          parentID: failure === 'parent' ? 'other-root' : body.parentID,
        },
      }),
      prompt: async ({ path }: { path: { id: string } }) => {
        const digest = await computeArtifactDigest(client, 'root', '/project');
        const text =
          verdict === 'malformed'
            ? 'not json'
            : JSON.stringify({
                verdict,
                artifactDigest: digest,
                summary: 'reviewed',
                findings: [],
              });
        return {
          data: {
            info: { sessionID: failure === 'response' ? 'other-child' : path.id },
            parts: [{ type: 'text', text }],
          },
        };
      },
    },
  };
  return { client, state, $: branchShell() };
}

describe('route gate plugin integration', () => {
  it('maps existing mode keywords to runtime routes', () => {
    expect(getRouteForMode('fein')).toBe('full');
    expect(getRouteForMode('sonar')).toBe('focused');
    expect(getRouteForMode('blitz')).toBe('direct');
  });

  it('starts fail-closed, selects explicit modes, and resets between turns', async () => {
    const plugin = await MaestriaPlugin({} as never);
    const chat = plugin['chat.message']!;
    const before = plugin['tool.execute.before']!;

    const initial = message('ordinary request');
    await chat(initial.input, initial.output as never);
    await expect(
      before({ tool: 'read', sessionID: 'root', callID: 'call' }, { args: {} }),
    ).rejects.toThrow(/unselected/);
    await expect(
      before({ tool: 'maestria_route', sessionID: 'root', callID: 'call' }, { args: {} }),
    ).resolves.toBeUndefined();

    const first = message('blitz implement this');
    await chat(first.input, first.output as never);
    await expect(
      before({ tool: 'read', sessionID: 'root', callID: 'call' }, { args: {} }),
    ).resolves.toBeUndefined();
    await expect(
      before({ tool: 'task', sessionID: 'root', callID: 'call' }, { args: {} }),
    ).rejects.toThrow();

    const next = message('ordinary follow-up');
    await chat(next.input, next.output as never);
    await expect(
      before({ tool: 'read', sessionID: 'root', callID: 'call' }, { args: {} }),
    ).rejects.toThrow(/unselected/);
  });

  it('enforces focused/full dispatcher tools and skips child sessions', async () => {
    const plugin = await MaestriaPlugin({} as never);
    const chat = plugin['chat.message']!;
    const before = plugin['tool.execute.before']!;

    const focused = message('sonar research this');
    await chat(focused.input, focused.output as never);
    await expect(
      before({ tool: 'task', sessionID: 'root', callID: 'call' }, { args: {} }),
    ).resolves.toBeUndefined();
    await expect(
      before({ tool: 'codegraph_explore', sessionID: 'root', callID: 'call' }, { args: {} }),
    ).rejects.toThrow();

    const child = message('fein child message', 'child', 'builder');
    await chat(child.input, child.output as never);
    await expect(
      before({ tool: 'read', sessionID: 'child', callID: 'call' }, { args: {} }),
    ).resolves.toBeUndefined();
    await expect(
      before(
        { tool: 'bash', sessionID: 'child', callID: 'call' },
        { args: { command: 'git commit -m ship' } },
      ),
    ).rejects.toThrow(/root orchestrator/);

    const full = message('fein run the full pipeline');
    await chat(full.input, full.output as never);
    await expect(
      before({ tool: 'task', sessionID: 'root', callID: 'call' }, { args: {} }),
    ).resolves.toBeUndefined();
    await expect(
      before({ tool: 'skill', sessionID: 'root', callID: 'call' }, { args: {} }),
    ).rejects.toThrow();
  });

  it('blocks pre-review shipping and requires one trusted reviewer before approval', async () => {
    const { client, state, $ } = reviewerClient();
    const plugin = await MaestriaPlugin({ client, directory: '/project', $ } as never);
    const chat = plugin['chat.message']!;
    const before = plugin['tool.execute.before']!;
    const routeTool = plugin.tool!.maestria_route;
    const reviewTool = plugin.tool!.maestria_landing_review;

    const turn = message('blitz implement and land this');
    await chat(turn.input, turn.output as never);
    await expect(
      before(
        { tool: 'bash', sessionID: 'root', callID: 'call' },
        { args: { command: 'git commit -m ship' } },
      ),
    ).rejects.toThrow();

    await routeTool.execute!({ route: 'landing-review' }, {
      sessionID: 'root',
      agent: 'orchestrator',
    } as never);

    await expect(
      before(
        { tool: 'bash', sessionID: 'root', callID: 'call' },
        { args: { command: 'git status' } },
      ),
    ).rejects.toThrow();

    await expect(
      reviewTool.execute!({}, {
        sessionID: 'root',
        messageID: 'message',
        agent: 'orchestrator',
        directory: '/project',
        worktree: '/project',
      } as never),
    ).resolves.toMatchObject({ title: 'Landing review approved' });

    await expect(
      before(
        { tool: 'bash', sessionID: 'root', callID: 'call' },
        { args: { command: 'git add -A' } },
      ),
    ).resolves.toBeUndefined();
    await expect(
      before(
        { tool: 'bash', sessionID: 'root', callID: 'call' },
        { args: { command: 'git commit -m ship' } },
      ),
    ).resolves.toBeUndefined();
    await expect(
      before(
        { tool: 'bash', sessionID: 'root', callID: 'call' },
        { args: { command: 'git push origin feature' } },
      ),
    ).resolves.toBeUndefined();
    await expect(
      before(
        { tool: 'bash', sessionID: 'root', callID: 'call' },
        { args: { command: 'gh pr create --base main --head feature' } },
      ),
    ).resolves.toBeUndefined();

    await expect(
      reviewTool.execute!({}, {
        sessionID: 'root',
        messageID: 'message',
        agent: 'orchestrator',
        directory: '/project',
        worktree: '/project',
      } as never),
    ).rejects.toThrow(/cannot start/);

    state.version = 2;
    await expect(
      before(
        { tool: 'bash', sessionID: 'root', callID: 'call' },
        { args: { command: 'git push origin feature' } },
      ),
    ).rejects.toThrow(/stale|does not permit/);
  });

  it.each(['main', 'master'] as const)('blocks an approved commit from %s', async (branch) => {
    const { client } = reviewerClient();
    const plugin = await MaestriaPlugin({
      client,
      directory: '/project',
      $: branchShell(branch),
    } as never);
    const chat = plugin['chat.message']!;
    const turn = message('blitz implement and land this');
    await chat(turn.input, turn.output as never);
    await plugin.tool!.maestria_route.execute!({ route: 'landing-review' }, {
      sessionID: 'root',
      agent: 'orchestrator',
    } as never);
    await plugin.tool!.maestria_landing_review.execute!({}, {
      sessionID: 'root',
      messageID: 'message',
      agent: 'orchestrator',
      directory: '/project',
      worktree: '/project',
    } as never);

    await expect(
      plugin['tool.execute.before']!(
        { tool: 'bash', sessionID: 'root', callID: 'call' },
        { args: { command: 'git commit -m ship' } },
      ),
    ).rejects.toThrow(/non-primary/);
  });

  it.each([
    ['malformed', 'none', /malformed JSON verdict/],
    ['rejected', 'none', /did not approve.*rejected/],
    ['approved', 'parent', /identity or parent binding/],
    ['approved', 'response', /response identity/],
  ] as const)('fails closed for %s reviewer result', async (verdict, failure, error) => {
    const { client } = reviewerClient(verdict, failure);
    const plugin = await MaestriaPlugin({ client, directory: '/project' } as never);
    const chat = plugin['chat.message']!;
    await chat(
      message('blitz implement and land this').input,
      message('blitz implement and land this').output as never,
    );
    await plugin.tool!.maestria_route.execute!({ route: 'landing-review' }, {
      sessionID: 'root',
      agent: 'orchestrator',
    } as never);

    await expect(
      plugin.tool!.maestria_landing_review.execute!({}, {
        sessionID: 'root',
        messageID: 'message',
        agent: 'orchestrator',
        directory: '/project',
        worktree: '/project',
      } as never),
    ).rejects.toThrow(error);
    await expect(
      plugin['tool.execute.before']!(
        { tool: 'bash', sessionID: 'root', callID: 'call' },
        { args: { command: 'git push origin feature' } },
      ),
    ).rejects.toThrow();
  });

  it('cleans route state on idle and deleted events', async () => {
    const plugin = await MaestriaPlugin({} as never);
    const chat = plugin['chat.message']!;
    const before = plugin['tool.execute.before']!;
    const event = plugin.event!;

    const turn = message('blitz implement this');
    await chat(turn.input, turn.output as never);
    await event({ event: { type: 'session.idle', properties: { sessionID: 'root' } } } as never);
    await expect(
      before({ tool: 'read', sessionID: 'root', callID: 'call' }, { args: {} }),
    ).resolves.toBeUndefined();

    const next = message('full run this', 'root');
    await chat(next.input, next.output as never);
    await event({
      event: {
        type: 'session.deleted',
        properties: { info: { id: 'root' } },
      },
    } as never);
    await expect(
      before({ tool: 'read', sessionID: 'root', callID: 'call' }, { args: {} }),
    ).resolves.toBeUndefined();
  });
});

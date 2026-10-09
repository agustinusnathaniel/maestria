/** Real V2 runtime evidence. Build opencode-v2, then run with pnpm exec tsx and --out <JSON>.
 * Isolated HOME/XDG, temporary local plugin wrapper, and deterministic HTTP provider; no paid model.
 */
/* oxlint-disable no-await-in-loop -- Admission, dispatch, and subsequent turns must run sequentially. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

interface Message {
  role: string;
  content: string;
}
interface RequestBody {
  messages: Message[];
  raw: unknown;
}
const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected object');
  }
  return { ...value };
};
const parse = (raw: string): unknown => JSON.parse(raw);
const rows = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    throw new TypeError('Expected array');
  }
  return value.map(record);
};
const content = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : rows(value ?? [])
        .map((part) => (typeof part.text === 'string' ? part.text : ''))
        .join('\n');
const wire = (raw: unknown): RequestBody => ({
  messages: rows(record(raw).messages).map((message) => {
    if (typeof message.role !== 'string') {
      throw new TypeError('Missing message role');
    }
    return { content: content(message.content), role: message.role };
  }),
  raw,
});
const latest = (body: RequestBody): string =>
  body.messages.findLast((message) => message.role === 'user')?.content ?? '';
const modeInSystem = (body: RequestBody): boolean =>
  body.messages.some(
    (message) =>
      message.role === 'system' && /\[MODE: (?:fein|sonar|blitz)\]/u.test(message.content),
  );
const chunk = (delta: unknown, finish: string | null): string =>
  `data: ${JSON.stringify({
    choices: [{ delta, finish_reason: finish, index: 0 }],
    created: 1,
    id: 'chatcmpl-local',
    model: 'fake',
    object: 'chat.completion.chunk',
  })}\n\n`;
const outIndex = process.argv.indexOf('--out');
if (outIndex === -1) {
  throw new Error('Usage: opencode-v2-evidence.ts --out <path>');
}
const out = process.argv[outIndex + 1];
if (out === undefined || out === '') {
  throw new Error('Usage: opencode-v2-evidence.ts --out <path>');
}
const repo = path.resolve(import.meta.dirname, '../..');
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maestria-opencode-v2-'));
const packageDir = process.env.MAESTRIA_V2_PACKAGE ?? path.join(repo, 'packages/opencode-v2');
const binary = process.env.OPENCODE_BIN ?? 'opencode';
const checks: { name: string; pass: boolean }[] = [];
const requests: RequestBody[] = [];
const registries: { name: string; entries: Record<string, unknown>[] }[] = [];
const contexts: { name: string; messages: Record<string, unknown>[] }[] = [];
const check = (name: string, pass: boolean): void => {
  checks.push({ name, pass });
};
await Promise.all(
  ['home', 'config/opencode', 'data', 'cache', 'state', 'work', 'plugin'].map(async (dir) => {
    await fs.mkdir(path.join(root, dir), { recursive: true });
  }),
);
await fs.writeFile(path.join(root, 'work/attached.txt'), 'ATTACHMENT_EVIDENCE_CONTENT\n');
await fs.writeFile(
  path.join(root, 'plugin/index.js'),
  `export {default} from ${JSON.stringify(path.join(packageDir, 'dist/index.js'))};\n`,
);
const serveFake = async (
  request: http.IncomingMessage,
  response: http.ServerResponse,
): Promise<void> => {
  let raw = '';
  for await (const data of request) {
    raw += String(data);
  }
  const body = wire(parse(raw));
  requests.push(body);
  const tool =
    latest(body).includes('CONTINUATION_EVIDENCE') &&
    !body.messages.some((message) => message.role === 'tool');
  const delta = tool
    ? {
        tool_calls: [
          {
            function: {
              arguments: JSON.stringify({ path: path.join(root, 'work/attached.txt') }),
              name: 'read',
            },
            id: 'local_read',
            index: 0,
            type: 'function',
          },
        ],
      }
    : { content: 'Deterministic evidence response', role: 'assistant' };
  response.setHeader('Content-Type', 'text/event-stream');
  response.end(`${chunk(delta, null)}${chunk({}, tool ? 'tool_calls' : 'stop')}data: [DONE]\n\n`);
};
const respond = async (
  request: http.IncomingMessage,
  response: http.ServerResponse,
): Promise<void> => {
  try {
    await serveFake(request, response);
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
};
const fake = http.createServer((request, response) => {
  void respond(request, response);
});
const listening = once(fake, 'listening');
fake.listen(0, '127.0.0.1');
await listening;
const address = fake.address();
if (address === null || typeof address === 'string') {
  throw new Error('Missing fake address');
}
const config = {
  model: 'evidence/fake',
  plugins: [
    {
      options: { modes: { disabledKeywords: [] as string[] } },
      package: path.join(root, 'plugin'),
    },
  ],
  providers: {
    evidence: {
      env: ['EVIDENCE_FAKE_KEY'],
      models: {
        fake: {
          capabilities: {
            input: ['text'],
            output: ['text'],
            toolCall: true,
          },
          limit: { context: 100_000, output: 1000 },
          name: 'Fake',
        },
      },
      name: 'Evidence',
      package: '@opencode/ai/providers/openai-compatible',
      settings: { baseURL: `http://127.0.0.1:${address.port}/v1` },
    },
  },
};
const configPath = path.join(root, 'config/opencode/opencode.json');
await fs.writeFile(configPath, JSON.stringify(config));
const child = spawn(binary, ['serve', '--port', '0', '--hostname', '127.0.0.1'], {
  cwd: path.join(root, 'work'),
  env: {
    EVIDENCE_FAKE_KEY: 'local-placeholder',
    HOME: path.join(root, 'home'),
    OPENCODE_DISABLE_AUTOUPDATE: 'true',
    PATH: process.env.PATH,
    XDG_CACHE_HOME: path.join(root, 'cache'),
    XDG_CONFIG_HOME: path.join(root, 'config'),
    XDG_DATA_HOME: path.join(root, 'data'),
    XDG_STATE_HOME: path.join(root, 'state'),
  },
});
let logs = '';
let spawnError: Error | undefined;
child.on('error', (error) => {
  spawnError = error;
});
child.stdout.on('data', (data: Buffer) => {
  logs += data.toString();
});
child.stderr.on('data', (data: Buffer) => {
  logs += data.toString();
});
try {
  const deadline = Date.now() + 30_000;
  while (!/server password \S+/u.test(logs) && Date.now() < deadline) {
    await delay(50);
  }
  const url = /server listening on (?<url>http:\/\/\S+)/u.exec(logs)?.groups?.url;
  const password = /server password (?<password>\S+)/u.exec(logs)?.groups?.password;
  if (url === undefined || password === undefined) {
    throw new Error(`Startup failed: ${logs}`);
  }
  const api = async (route: string, body?: object): Promise<unknown> => {
    const response = await fetch(url + route, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        Authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      method: body === undefined ? 'GET' : 'POST',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`${route}: ${response.status} ${await response.text()}`);
    }
    return response.status === 204 ? null : parse(await response.text());
  };
  const create = async (): Promise<string> => {
    const result = record(
      record(
        await api('/api/session', {
          location: { directory: path.join(root, 'work') },
          model: { id: 'fake', providerID: 'evidence' },
          title: 'Evidence',
        }),
      ).data,
    );
    if (typeof result.id !== 'string') {
      throw new TypeError('Missing session ID');
    }
    return result.id;
  };
  const run = async (
    name: string,
    session: string,
    body: object,
    command = false,
  ): Promise<RequestBody[]> => {
    const before = requests.length;
    await api(`/api/session/${session}/${command ? 'command' : 'prompt'}`, body);
    const end = Date.now() + 30_000;
    while (Date.now() < end) {
      const messages = rows(record(await api(`/api/session/${session}/context`)).data);
      if (requests.length > before && messages.at(-1)?.type === 'idle') {
        contexts.push({ messages, name });
        check(`${name}: completed`, messages.at(-1)?.outcome === 'succeeded');
        return requests.slice(before);
      }
      await delay(50);
    }
    throw new Error(`${name}: timed out`);
  };
  for (const mode of ['fein', 'sonar', 'blitz']) {
    const session = await create();
    const [bare] = await run(`bare-${mode}`, session, { text: `${mode} EVIDENCE_${mode}` });
    check(
      `bare-${mode}: marker reaches provider`,
      bare !== undefined && latest(bare).startsWith(`[MODE: ${mode}]`),
    );
    const [neutral] = await run(`neutral-after-${mode}`, session, { text: 'NEUTRAL_EVIDENCE' });
    check(
      `neutral-after-${mode}: no forced mode`,
      neutral !== undefined && latest(neutral) === 'NEUTRAL_EVIDENCE' && !modeInSystem(neutral),
    );
    const [slash] = await run(
      `slash-${mode}`,
      await create(),
      { name: mode, text: `EVIDENCE_${mode}` },
      true,
    );
    check(
      `slash-${mode}: marker reaches provider`,
      slash !== undefined && latest(slash).startsWith(`[MODE: ${mode}]`),
    );
  }
  const [attached] = await run('attached-fein', await create(), {
    files: [
      {
        mention: { end: 18, start: 5, text: '@attached.txt' },
        uri: `file://${path.join(root, 'work/attached.txt')}`,
      },
    ],
    text: 'fein @attached.txt ATTACHMENT_EVIDENCE',
  });
  check(
    'attachment survives expansion',
    attached !== undefined && JSON.stringify(attached.raw).includes('ATTACHMENT_EVIDENCE_CONTENT'),
  );
  const continuation = await run('tool-continuation', await create(), {
    text: 'sonar CONTINUATION_EVIDENCE',
  });
  check(
    'tool continuation retains mode',
    continuation.length === 2 &&
      continuation.every((body) => latest(body).startsWith('[MODE: sonar]')),
  );
  const directoryQuery = `?directory=${encodeURIComponent(path.join(root, 'work'))}`;
  for (const [route, names] of [
    [
      'agent',
      [
        'orchestrator',
        'adventurer',
        'architect',
        'builder',
        'diagnose',
        'planner',
        'reviewer',
        'writer',
      ],
    ],
    ['command', ['fein', 'sonar', 'blitz']],
    ['skill', ['handoff', 'iteration-limits']],
  ] as const) {
    const registry = rows(record(await api(`/api/${route}${directoryQuery}`)).data);
    registries.push({ entries: registry, name: route });
    check(
      `${route}: registered entries`,
      names.every((name) => registry.some((item) => item.id === name || item.name === name)),
    );
    if (route === 'agent') {
      const agents = registry.filter((item) => names.some((name) => item.id === name));
      check(
        'agent systems and permissions present',
        agents.length === 8 &&
          agents.every(
            (item) =>
              typeof item.system === 'string' &&
              item.system.length > 0 &&
              typeof item.description === 'string' &&
              item.description.length > 0 &&
              rows(item.permissions).length > 0,
          ),
      );
      check(
        'agent modes preserved',
        agents.every((item) => item.mode === (item.id === 'orchestrator' ? 'all' : 'subagent')),
      );
      for (const id of ['builder', 'diagnose']) {
        const agent = agents.find((item) => item.id === id);
        const shell =
          agent === undefined
            ? []
            : rows(agent.permissions).filter(
                (rule) => rule.action === 'shell' && rule.resource === '*',
              );
        check(
          `${id}: single shell fallback asks`,
          shell.length === 1 && shell[0]?.effect === 'ask',
        );
      }
      const planner = agents.find((item) => item.id === 'planner');
      check(
        'planner asks on edit',
        planner !== undefined &&
          rows(planner.permissions).some(
            (rule) => rule.action === 'edit' && rule.resource === '*' && rule.effect === 'ask',
          ),
      );
      const orchestrator = agents.find((item) => item.id === 'orchestrator');
      const permissions = orchestrator === undefined ? [] : rows(orchestrator.permissions);
      check(
        'orchestrator denies shell and edit, allows builder',
        [
          ['shell', '*', 'deny'],
          ['edit', '*', 'deny'],
          ['subagent', 'builder', 'allow'],
        ].every(([action, resource, effect]) =>
          permissions.some(
            (rule) =>
              rule.action === action && rule.resource === resource && rule.effect === effect,
          ),
        ),
      );
    }
    if (route === 'skill') {
      const handoff = registry.find((item) => item.id === 'handoff');
      check(
        'handoff advertised without generated header or frontmatter',
        handoff !== undefined &&
          typeof handoff.description === 'string' &&
          handoff.description.length > 0 &&
          typeof handoff.content === 'string' &&
          handoff.content.trim().length > 0 &&
          !handoff.content.startsWith('---') &&
          !handoff.content.includes('Auto-generated from'),
      );
    }
  }
  config.plugins[0].options.modes.disabledKeywords.push('blitz');
  await fs.writeFile(configPath, JSON.stringify(config));
  await api(`/api/location/reload${directoryQuery}`, {});
  const [disabled] = await run('disabled-bare-blitz', await create(), {
    text: 'blitz DISABLED_EVIDENCE',
  });
  check(
    'disabled keyword preserved',
    disabled !== undefined && latest(disabled) === 'blitz DISABLED_EVIDENCE',
  );
  const [explicit] = await run(
    'disabled-slash-blitz',
    await create(),
    { name: 'blitz', text: 'EXPLICIT_EVIDENCE' },
    true,
  );
  check(
    'disabled keyword allows explicit command',
    explicit !== undefined && latest(explicit).startsWith('[MODE: blitz]'),
  );
  check(
    'rules reach every provider request',
    requests.every((body) =>
      body.messages.some(
        (message) => message.role === 'system' && message.content.includes('# Global Agent Rules'),
      ),
    ),
  );
} finally {
  if (child.exitCode === null && child.signalCode === null && spawnError === undefined) {
    const exited = once(child, 'exit');
    const killTimer = setTimeout(() => {
      child.kill('SIGKILL');
    }, 3000);
    child.kill('SIGTERM');
    try {
      await exited;
    } finally {
      clearTimeout(killTimer);
    }
  }
  const closed = once(fake, 'close');
  fake.close();
  await closed;
  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  await fs.writeFile(
    out,
    JSON.stringify(
      {
        binary,
        checks,
        contexts,
        logs: logs.replaceAll(/server password \S+/gu, 'server password <REDACTED>'),
        packageDir,
        processesCleaned: true,
        registries,
        requests,
        sandbox: root,
      },
      null,
      2,
    ),
  );
}
process.stdout.write(
  `${checks.filter((item) => item.pass).length}/${checks.length} checks passed: ${out}\n`,
);
if (checks.some((item) => !item.pass)) {
  process.exitCode = 1;
}

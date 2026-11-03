/* oxlint-disable no-await-in-loop -- Install, boot, and the scripted delegation turns run sequentially. */
// Real-host evidence for @maestria/deepseek: installs the packed bundle into an
// isolated DeepSeek Harness web profile with `dsh plugin add`, boots `dsh web`
// against a local fake Messages endpoint, and drives one maestria session in a git
// repository that runs a guarded git command, then delegates to the reviewer. No
// paid inference.
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

type Block = Record<string, unknown>;
interface Wire {
  role: string;
  system: string;
  tools: string[];
  messages: Block[][];
}

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Expected object');
  }
  return { ...value };
};
const list = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    throw new TypeError('Expected array');
  }
  return value;
};
const text = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (!Array.isArray(value)) {
    return '';
  }
  return value
    .map((part) => {
      const block = record(part);
      return typeof block.text === 'string' ? block.text : text(block.content);
    })
    .join('\n');
};

const outIndex = process.argv.indexOf('--out');
const out = outIndex === -1 ? undefined : process.argv[outIndex + 1];
if (out === undefined || out === '') {
  throw new Error('Usage: deepseek-evidence.ts --out <path>');
}
const repo = path.resolve(import.meta.dirname, '../..');
const packageDir = path.join(repo, 'packages/deepseek');
const binary = process.env.DSH_BIN ?? 'dsh';
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maestria-deepseek-'));
const checks: { name: string; pass: boolean }[] = [];
const check = (name: string, pass: boolean): void => {
  checks.push({ name, pass });
};

const prompt = async (file: string): Promise<string> => {
  const raw = await fs.readFile(path.join(packageDir, 'prompts', `${file}.md`), 'utf-8');
  return raw.replace(/^\s*<!--[\s\S]*?-->/u, '').trim();
};
/** Each persona's opening line identifies which agent sent a request. */
const ROLES = ['main-loop', 'reviewer'] as const;
const openings = new Map<string, string>();
for (const role of ROLES) {
  const persona = await prompt(role);
  const [opening = role] = persona.split('\n');
  openings.set(role, opening);
}
const PROJECT_RULE = 'PROJECT_RULE_EVIDENCE: run the project checks before pushing.';
const MARKER = 'guard-marker';

const wire = (raw: string): Wire => {
  const body = record(JSON.parse(raw));
  const system = text(body.system);
  return {
    messages: list(body.messages).map((message) => {
      const { content } = record(message);
      return typeof content === 'string'
        ? [{ text: content, type: 'text' }]
        : list(content).map(record);
    }),
    role: ROLES.find((role) => system.includes(openings.get(role) ?? role)) ?? 'other',
    system,
    tools: list(body.tools ?? []).map((tool) => String(record(tool).name)),
  };
};
const toolResults = (body: Wire): Block[] =>
  body.messages.flat().filter((block) => block.type === 'tool_result');

/** One Anthropic Messages SSE response carrying a single content block. */
const sse = (start: Block, delta: Block, stopReason: string): string =>
  (
    [
      [
        'message_start',
        {
          message: {
            content: [],
            id: 'msg_local',
            model: 'fake',
            role: 'assistant',
            stop_reason: null,
            type: 'message',
            usage: { input_tokens: 1, output_tokens: 0 },
          },
        },
      ],
      ['content_block_start', { content_block: start, index: 0 }],
      ['content_block_delta', { delta, index: 0 }],
      ['content_block_stop', { index: 0 }],
      ['message_delta', { delta: { stop_reason: stopReason }, usage: { output_tokens: 1 } }],
      ['message_stop', {}],
    ] as const
  )
    .map(([type, data]) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`)
    .join('');
const say = (value: string): string =>
  sse({ text: '', type: 'text' }, { text: value, type: 'text_delta' }, 'end_turn');
const callTool = (tool: string, input: Record<string, string>): string =>
  sse(
    { id: `toolu_${tool}`, input: {}, name: tool, type: 'tool_use' },
    { partial_json: JSON.stringify(input), type: 'input_json_delta' },
    'tool_use',
  );

// The main loop runs a hook-bypassing commit, delegates to the reviewer, then finishes.
const STEPS = [
  callTool('bash', {
    command: `touch ${MARKER} && git commit --no-verify -m evidence`,
    description: 'Commit without hooks',
  }),
  callTool('maestria_reviewer', { description: 'evidence', prompt: 'REVIEW_EVIDENCE' }),
];
const requests: Wire[] = [];
const respond = (body: Wire): string => {
  if (body.role === 'reviewer') {
    return say('REVIEWER_CHILD_EVIDENCE');
  }
  const next = body.role === 'main-loop' ? STEPS[toolResults(body).length] : undefined;
  return next ?? say('Deterministic evidence response');
};
const serveFake = async (
  request: http.IncomingMessage,
  response: http.ServerResponse,
): Promise<void> => {
  try {
    let raw = '';
    for await (const data of request) {
      raw += String(data);
    }
    if (request.url?.endsWith('/v1/messages') !== true) {
      response.writeHead(404);
      response.end();
      return;
    }
    const body = wire(raw);
    requests.push(body);
    response.setHeader('Content-Type', 'text/event-stream');
    response.end(respond(body));
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
};
const fake = http.createServer((request, response) => {
  void serveFake(request, response);
});
const listening = once(fake, 'listening');
fake.listen(0, '127.0.0.1');
await listening;
const fakeAddress = fake.address();
if (fakeAddress === null || typeof fakeAddress === 'string') {
  throw new Error('Missing fake address');
}

const env = {
  DEEPSEEK_API_KEY: 'local-placeholder',
  DEEPSEEK_BASE_URL: `http://127.0.0.1:${fakeAddress.port}`,
  DSH_AGENTS_HOME: path.join(root, 'agents'),
  DSH_HOME: path.join(root, 'dsh'),
  HOME: path.join(root, 'home'),
  PATH: process.env.PATH,
};
for (const dir of ['agents', 'home', 'pack', 'work']) {
  await fs.mkdir(path.join(root, dir));
}
/** Setup commands run before the host serves, so blocking does not starve the fake. */
const run = (args: string[], command = binary, cwd = path.join(root, 'work')): string => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf-8', env });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr}`);
  }
  return result.stdout;
};
// The path `maestria install deepseek` reads to detect the installed version.
const webProfile = path.join(root, 'dsh/profiles/web');
const installedManifest = path.join(webProfile, 'node_modules/@maestria/deepseek/package.json');
const exists = async (file: string): Promise<boolean> => {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
};
/** Whether the web profile lists the bundle as a layer and has its package installed. */
const installed = async (): Promise<boolean> => {
  const manifest = record(
    JSON.parse(await fs.readFile(path.join(webProfile, 'package.json'), 'utf-8')),
  );
  const layers = list(record(record(manifest.dsh).profile).bundles);
  return layers.includes('@maestria/deepseek') && (await exists(installedManifest));
};
let child: ChildProcess | undefined;
let logs = '';
const report: Record<string, unknown> = {};
try {
  const work = path.join(root, 'work');
  run(['init', '-q', '-b', 'main'], 'git', work);
  await fs.mkdir(path.join(work, '.maestria'));
  await fs.writeFile(path.join(work, '.maestria/rules.md'), `${PROJECT_RULE}\n`);
  run(['pack', '--pack-destination', path.join(root, 'pack')], 'npm', packageDir);
  const [tarball = ''] = await fs.readdir(path.join(root, 'pack'));
  run(['plugin', '--profile', 'web', 'add', path.join(root, 'pack', tarball)]);
  check('dsh plugin add installs the bundle where the CLI detects it', await installed());
  child = spawn(binary, ['web', '--no-open', '--port', '0'], {
    cwd: path.join(root, 'work'),
    env,
  });
  child.stdout?.on('data', (data: Buffer) => {
    logs += data.toString();
  });
  child.stderr?.on('data', (data: Buffer) => {
    logs += data.toString();
  });
  const deadline = Date.now() + 60_000;
  const launchUrl = /(?<url>http:\/\/\S+\?token=\S+)/u;
  while (!launchUrl.test(logs) && Date.now() < deadline) {
    await delay(100);
  }
  const launch = launchUrl.exec(logs)?.groups?.url;
  if (launch === undefined) {
    throw new Error(`dsh web did not start:\n${logs}`);
  }
  const { origin } = new URL(launch);
  const login = await fetch(launch, { redirect: 'manual' });
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const call = async (method: string, args: unknown): Promise<Record<string, unknown>> => {
    const response = await fetch(`${origin}/api/${method}`, {
      body: JSON.stringify({
        method,
        payload: { args },
        rpcId: crypto.randomUUID(),
        type: 'client-request',
      }),
      headers: { 'content-type': 'application/json', cookie, origin },
      method: 'POST',
    });
    const reply: unknown = await response.json();
    const result = record(record(reply).result);
    if (result.ok !== true) {
      throw new Error(`${method} failed: ${JSON.stringify(result.error)}`);
    }
    return record(result.value);
  };

  const roster = await call('agentPresets/list', {});
  const presets = list(roster.presets).map(record);
  check(
    'the maestria and maestria-reviewer presets activate beside the shipped presets',
    ['maestria', 'maestria-reviewer'].every((id) => presets.some((preset) => preset.id === id)),
  );
  const created = await call('session/create', { request: { agentPreset: 'maestria' } });
  const sessionId = String(created.sessionId);
  const catalog = await call('skills/list', { request: { sessionId } });
  const skills = list(catalog.skills).map(record);
  const bundled = skills
    .filter((skill) => String(skill.path).includes('@maestria/deepseek'))
    .map((skill) => String(skill.name));
  report.skills = bundled.toSorted();
  const shipped = await fs.readdir(path.join(packageDir, 'skills'));
  check(
    'every bundled skill resolves through the installed package',
    shipped.every((name) => bundled.includes(name)),
  );
  await call('session/prompt', {
    request: {
      content: [{ text: 'PROMPT_EVIDENCE', type: 'text' }],
      mode: 'queue',
      requestId: crypto.randomUUID(),
      sessionId,
    },
  });
  // The reviewer runs in the background; its result reaches the main loop as a settlement notice.
  const delivered = (body: Wire): boolean =>
    body.messages.flat().some((block) => text([block]).includes('REVIEWER_CHILD_EVIDENCE'));
  const settled = (): boolean =>
    requests.some((body) => body.role === 'main-loop' && delivered(body));
  const turnDeadline = Date.now() + 90_000;
  while (!settled() && Date.now() < turnDeadline) {
    await delay(200);
  }

  const [main, reviewer] = ROLES.map((role) => requests.find((body) => body.role === role));
  const final = requests.findLast((body) => body.role === 'main-loop');
  const results = final === undefined ? [] : toolResults(final);
  report.toolResults = results.map((block) => text(block.content));
  check(
    'the main-loop persona renders with the DSH integration note and the main-session rules',
    ['## DeepSeek Harness Integration', '# Main Session'].every(
      (heading) => main?.system.includes(heading) === true,
    ),
  );
  check(
    'no prompt variable is left unresolved',
    requests.every((body) => !/\{\{\w+\}\}/u.test(body.system)),
  );
  check(
    'project-root .maestria/rules.md reaches the main loop',
    main?.messages.flat().some((block) => text([block]).includes(PROJECT_RULE)) === true,
  );
  check(
    'the guard denies a hook-bypassing commit before any of the command runs',
    text(results[0]?.content).includes('maestria:') && !(await exists(path.join(work, MARKER))),
  );
  check(
    'the main loop receives the maestria_reviewer tool',
    main?.tools.includes('maestria_reviewer') === true,
  );
  check(
    'the reviewer runs on its own persona and rules, without the main loop',
    reviewer !== undefined &&
      reviewer.system.includes('# Acceptance and Blind Review') &&
      !reviewer.system.includes(openings.get('main-loop') ?? '\0') &&
      !reviewer.system.includes('# Main Session'),
  );
  check(
    'the reviewer has no shell, edit, write, or delegation tool',
    reviewer !== undefined &&
      ['read', 'glob', 'grep', 'skill'].every((tool) => reviewer.tools.includes(tool)) &&
      reviewer.tools.every((tool) =>
        ['glob', 'grep', 'read', 'read_image', 'skill', 'working_directory'].includes(tool),
      ),
  );
  check('the reviewer result returns to the main loop', final !== undefined && delivered(final));

  child.kill();
  // The CLI's uninstall verb; pnpm treats it as `remove`.
  run(['plugin', '--profile', 'web', 'uninstall', '@maestria/deepseek']);
  check('dsh plugin uninstall removes the package and its bundle layer', !(await installed()));
} catch (error) {
  check('the scripted run completes', false);
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  report.requests = requests.map((body) => ({
    role: body.role,
    system: body.system.slice(0, 120),
    tools: body.tools,
  }));
  child?.kill();
  fake.close();
}
const version = spawnSync(binary, ['--version'], { encoding: 'utf-8', env });
const artifact = {
  checks,
  dshVersion: version.status === 0 ? version.stdout.trim() : 'unknown',
  logs: logs.replaceAll(/token=\S+/gu, 'token=<redacted>'),
  ...report,
};
await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
await fs.writeFile(out, `${JSON.stringify(artifact, null, 2)}\n`);
await fs.rm(root, { force: true, recursive: true });
const failed = checks.filter((entry) => !entry.pass);
console.log(`${checks.length - failed.length}/${checks.length} checks passed; evidence in ${out}`);
if (failed.length > 0) {
  console.error(failed.map((entry) => `FAIL ${entry.name}`).join('\n'));
  process.exitCode = 1;
}

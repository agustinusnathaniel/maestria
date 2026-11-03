// Per-host session outputs for the consolidated plugin: each host's always-on core within its
// cap, Devin's mode skills, and the Claude Code and ZCode SessionStart hook context.

export const compose = (...parts: string[]): string =>
  parts.map((part) => part.trim()).join('\n\n');

type Document = (body: string, metadata?: Record<string, unknown> | null) => string;

export interface SessionInputs {
  readonly arguments: string;
  readonly contexts: Record<string, string>;
  readonly modes: Record<string, { body: string; metadata: Record<string, unknown> }>;
  readonly roles: Record<string, string>;
  readonly rules: string;
}

// Each host that reads a plain session file gets its own, holding the always-on core and only its
// own host note, so it stays under that host's cap. Devin loads the root AGENTS.md always-on and
// reads its modes as skills; the CLI installs the Codex file into Codex's global AGENTS.md;
// Hermes users add theirs as project context; Kimi Code reads its file through `systemPromptPath`.
// Hermes caps context files in characters, which UTF-16 length never undercounts.
const SESSION_FILES = [
  { cap: 'Devin 16 KiB', file: 'AGENTS.md', host: 'devin', limit: 16 * 1024, modes: false },
  { cap: 'Codex 32 KiB', file: 'codex.agents.md', host: 'codex', limit: 32 * 1024, modes: true },
  {
    cap: 'Hermes 20,000-character',
    file: 'hermes.context.md',
    host: 'hermes',
    limit: 20_000,
    modes: false,
  },
  {
    cap: 'Kimi Code 32 KiB',
    file: 'kimi.system-prompt.md',
    host: 'kimi-code',
    limit: 32 * 1024,
    modes: true,
  },
] as const;

// Claude Code moves any hook string over 10,000 characters to a file behind a short preview, so
// the SessionStart hook prints the core as two parts, each under that cap.
const HOOK_CONTEXT_LIMIT = 10_000;

const demote = (markdown: string): string =>
  markdown.replaceAll(/^(?<hashes>#{2,5}) /gmu, '#$<hashes> ');

const checked = (file: string, content: string, size: number, limit: number, cap: string) => {
  if (size > limit) {
    throw new Error(`${file} exceeds the ${cap} cap`);
  }
  return [file, content] as const;
};

export const hostSessionOutputs = (
  input: SessionInputs,
  routerPolicy: string,
  document: Document,
): (readonly [string, string])[] => {
  const modes = Object.entries(input.modes);
  const sessionFiles = SESSION_FILES.map(({ cap, file, host, limit, modes: withModes }) => {
    const content = document(
      compose(
        routerPolicy,
        ...(withModes ? modes.map(([, mode]) => mode.body) : []),
        '## Host Notes',
        demote(input.contexts[host]),
      ),
    );
    const size = host === 'hermes' ? content.length : Buffer.byteLength(content);
    return checked(file, content, size, limit, cap);
  });
  // Devin has no plugin commands component, so its modes ship as skills only its manifest
  // selects; Claude Code and ZCode get the core from the hook, so their commands carry only the
  // mode body.
  const modeFiles = modes.flatMap(([name, { body, metadata }]) => [
    [
      `devin/skills/${name}/SKILL.md`,
      document(compose(body, input.arguments), { description: metadata.description, name }),
    ] as const,
    [
      `modes/${name}.md`,
      document(compose(body, input.arguments), { description: metadata.description }),
    ] as const,
  ]);
  const hookParts = Object.entries({
    'core-loop': compose(input.roles['main-loop'], input.contexts['claude-code']),
    'core-rules': input.rules,
  }).map(([part, body]) => {
    const content = document(body);
    return checked(
      `hooks/context/${part}.md`,
      content,
      content.length,
      HOOK_CONTEXT_LIMIT,
      'Claude Code 10,000-character hook',
    );
  });
  return [...sessionFiles, ...modeFiles, ...hookParts];
};

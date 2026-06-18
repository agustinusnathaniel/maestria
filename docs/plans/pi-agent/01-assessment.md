# 01. Pi Coding Agent — Deep Dive

This document covers what the Pi coding agent is, how it works, and how its
primitives differ from OpenCode's. It's the foundation for the integration
strategy in [`02-integration-strategy.md`](./02-integration-strategy.md).

Pi is at v0.79.6 (released 2026-06-16), MIT-licensed, and built by Mario
Zechner / badlogic at Earendil Inc. The CLI is a TUI/RPC/JSON/print
application; the agent core is a session-driven loop with an event-based
extension surface.

## 1. What Pi Is

Pi (`@earendil-works/pi-coding-agent`) is a terminal-based coding agent CLI.
It exposes a single primary agent loop, manages session state as a tree
(branching via `/fork` and `/clone`), and supports a rich extension API.

Source of truth: [`packages/coding-agent/docs/`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/docs)
in the pi-mono repository. This plan cites specific files in the
opensrc cache at `~/.opensrc/repos/github.com/earendil-works/pi/main/`.

### 1.1 The 4-Resource Model

Pi distributes 4 kinds of resources:

| Resource       | What it is                     | Loaded how                             | File format            |
| -------------- | ------------------------------ | -------------------------------------- | ---------------------- |
| **Extensions** | TypeScript modules             | jiti (TypeScript at runtime)           | `.ts` files            |
| **Skills**     | On-demand methodology packages | Agent Skills spec, loaded by `read`    | `SKILL.md` directories |
| **Prompts**    | User-invokable prompt snippets | Auto-loaded into `/` command namespace | `.md` files            |
| **Themes**     | Color scheme JSON              | TUI color theme                        | `.json` files          |

A "Pi package" bundles any combination of these under a single `pi` key in
`package.json`. A package can also rely on convention directories
(`extensions/`, `skills/`, `prompts/`, `themes/`) without an explicit
manifest.

References:

- [Pi packages docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)
- [Pi extensions docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- [Pi skills docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)
- [Pi prompt templates docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/prompt-templates.md)
- [Pi themes docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/themes.md)

### 1.2 The Single Primary Agent Loop

Pi has **one** primary agent loop. There is no OpenCode-style `task()`
subagent primitive in the core — only the single loop with extension
listeners. This is a meaningful difference from OpenCode and shapes the
entire integration strategy.

The loop lifecycle, from the extensions docs:

```
pi starts
  ├─► project_trust (user/global and CLI extensions only)
  ├─► session_start { reason: "startup" }
  └─► resources_discover { reason: "startup" }

user sends prompt
  ├─► (extension commands checked first, bypass if found)
  ├─► input (can intercept, transform, or handle)
  ├─► (skill/template expansion if not handled)
  ├─► before_agent_start (can inject message, modify system prompt)
  ├─► agent_start
  ├─► message_start / message_update / message_end
  │   ┌─── turn (repeats while LLM calls tools) ───┐
  │   │   ├─► turn_start
  │   │   │   ├─► context (can modify messages)
  │   │   │   ├─► before_provider_request
  │   │   │   └─► after_provider_response
  │   │   │
  │   │   LLM responds, may call tools:
  │   │     ├─► tool_execution_start
  │   │     ├─► tool_call (can block, or mutate event.input)
  │   │     ├─► tool_execution_update
  │   │     ├─► tool_result (can modify)
  │   │     └─► tool_execution_end
  │   │
  │   └─► turn_end
  └─► agent_end

user navigates session tree (/tree)
  ├─► session_before_tree (can { cancel: true } or return { summary })
  └─► session_tree (post-navigation; newLeafId, oldLeafId, summaryEntry?)
```

Source:
[extensions.md:276-342](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

### 1.3 The "Subagent" Pattern

Pi does not have a `task()` primitive, but it does have an established
pattern for delegating work to a fresh context: **spawn a separate `pi`
subprocess via `pi --mode json -p` and stream its output as a custom tool
result**. This is implemented in the example extension at
`examples/extensions/subagent/index.ts`.

The pattern, in summary:

1. A custom tool (e.g., `subagent`) is registered via `pi.registerTool`.
2. When the LLM calls the tool, the extension spawns a `pi` subprocess
   with flags `--mode json -p --no-session` plus an
   `--append-system-prompt` file containing the specialist's prompt.
3. The subprocess runs the specialist with a fresh context window.
4. The parent extension parses the subprocess's JSON output (via
   `message_end`, `tool_result_end` events on stdout) and returns the
   final output to the parent LLM as the tool result.
5. Parallel and chain modes compose multiple subprocess invocations.

This is the key insight that makes maestria on Pi viable. The
`subagent` example is 1,009 lines of TypeScript and provides:

- Isolated context per subagent
- Streaming output as the subprocess runs
- Parallel mode with concurrency limits (max 8 tasks, 4 concurrent)
- Chain mode with `{previous}` placeholder substitution
- Per-task usage stats and cost tracking
- Abort propagation (Ctrl+C kills the subprocess)
- Project-agent confirmation prompt (for `.pi/agents/`)

Source: [`examples/extensions/subagent/index.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/subagent/index.ts),
[`examples/extensions/subagent/README.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/subagent/README.md)

## 2. The Extension API Surface

The `ExtensionAPI` is a single object the extension's default-exported
factory function receives. It exposes event subscription, tool/command
registration, and a handful of session/messaging methods.

### 2.1 Default Export Contract

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Synchronous or async — async factories complete before session_start,
  // before resources_discover, and before registerProvider flushes.
}
```

Source: [extensions.md:154-176](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

### 2.2 Event Categories

Pi exposes 30+ lifecycle events. Grouped by concern:

**Startup (3):**

| Event                | When                                          | Can...                                           |
| -------------------- | --------------------------------------------- | ------------------------------------------------ |
| `project_trust`      | Before deciding whether to trust the project  | Return `{ trusted, remember }` to own decision   |
| `session_start`      | New session started (startup/new/resume/fork) | Read entries, set up state                       |
| `resources_discover` | After session_start                           | Return `skillPaths`, `promptPaths`, `themePaths` |

**Session (7):**

| Event                    | When                              | Can...                                                              |
| ------------------------ | --------------------------------- | ------------------------------------------------------------------- |
| `session_before_switch`  | Before `/new` or `/resume`        | Return `{ cancel: true }` to cancel                                 |
| `session_shutdown`       | Before teardown                   | Cleanup                                                             |
| `session_before_compact` | Before `/compact` or auto-compact | Return custom summary or cancel                                     |
| `session_compact`        | After compaction                  | Inspect saved compaction                                            |
| `session_before_fork`    | Before `/fork` or `/clone`        | Return `{ cancel: true }` to cancel                                 |
| `session_before_tree`    | Before `/tree` navigation         | Return `{ cancel: true }` or `{ summary: { summary, details? } }`   |
| `session_tree`           | After `/tree` navigation          | Inspect `newLeafId`, `oldLeafId`, `summaryEntry?`, `fromExtension?` |

**Agent (4):**

| Event                | When                            | Can...                               |
| -------------------- | ------------------------------- | ------------------------------------ |
| `before_agent_start` | After user submits, before loop | Inject message, modify system prompt |
| `agent_start`        | Once per user prompt            | Read-only context setup              |
| `agent_end`          | End of user prompt              | Read final messages                  |
| `turn_start/end`     | Per LLM turn                    | Track turn-level state               |

**Message (3):**

| Event            | When                                  | Can...                          |
| ---------------- | ------------------------------------- | ------------------------------- |
| `message_start`  | User / assistant / toolResult message | Inspect                         |
| `message_update` | Stream token                          | Inspect                         |
| `message_end`    | Message finalized                     | Return `{ message }` to replace |

**Tool (6):**

| Event                   | When                                 | Can...                                            |
| ----------------------- | ------------------------------------ | ------------------------------------------------- |
| `tool_execution_start`  | Before tool call                     | Inspect                                           |
| `tool_call`             | After `_start`, before tool executes | **`{ block: true, reason }` to prevent call**     |
| `tool_execution_update` | Streaming tool result                | Inspect                                           |
| `tool_result`           | After tool finishes                  | **Modify result (`content`/`details`/`isError`)** |
| `tool_execution_end`    | After tool completes                 | Inspect                                           |
| `user_bash`             | User `!` or `!!` command             | Intercept / wrap                                  |

**Input (1):**

| Event   | When                                  | Can...                               |
| ------- | ------------------------------------- | ------------------------------------ |
| `input` | User input received, before expansion | `continue` / `transform` / `handled` |

**Model (2):**

| Event                   | When                  | Can...              |
| ----------------------- | --------------------- | ------------------- |
| `model_select`          | Model change          | Inspect (read-only) |
| `thinking_level_select` | Thinking level change | Inspect (read-only) |

**Context & payload (3):**

| Event                     | When                             | Can...                            |
| ------------------------- | -------------------------------- | --------------------------------- |
| `context`                 | Before each LLM call             | Modify messages non-destructively |
| `before_provider_request` | Right before HTTP request        | Replace payload                   |
| `after_provider_response` | After response, before streaming | Inspect headers                   |

### 2.3 `ExtensionAPI` Methods

```typescript
interface ExtensionAPI {
  on(event, handler): void;
  registerTool(definition): void;
  registerCommand(name, definition): void;
  registerShortcut(key, definition): void;
  registerFlag(name, definition): void;
  registerProvider(name, definition): void;
  sendMessage(message, options?): void;
  sendUserMessage(content, options?): void;
  appendEntry(customType, data?): void;
  setSessionName(name): void;
  getSessionName(): string | undefined;
  setLabel(entryId: string, label: string | undefined): void;
  registerMessageRenderer<T = unknown>(customType: string, renderer: MessageRenderer<T>): void;
  exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
  getAllTools(): ToolInfo[];
  getActiveTools(): string[];
  setActiveTools(toolNames: string[]): void;
  getCommands(): SlashCommandInfo[];
  getFlag(name: string): boolean | string | undefined;
  setModel(model: Model<any>): Promise<boolean>;
  getThinkingLevel(): ThinkingLevel;
  setThinkingLevel(level: ThinkingLevel): void;
  unregisterProvider(name: string): void;
  events: EventBus;
}

// Result of `pi.exec`. Defined in `core/exec.ts:23-28`.
interface ExecResult {
  stdout: string;
  stderr: string;
  code: number; // exit code; 0 on success
  killed: boolean; // true if killed by timeout or abort signal
}

// Options for `pi.exec`. Defined in `core/exec.ts:11-18`.
interface ExecOptions {
  signal?: AbortSignal;
  timeout?: number; // milliseconds
  cwd?: string;
}
```

The `setLabel` signature takes an entry id (so the LLM can target a
specific entry) and a label string or `undefined` (to clear). The
`exec` signature takes positional `args` (not a single command string)
and returns `code` (not `exitCode`). The `registerMessageRenderer` is
parameterized over the custom message type and takes a renderer
callback, not a varargs list. See
[`types.ts:1242-1347`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts).

References: [extensions.md:1263-1392](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

### 2.4 `ExtensionContext` (the `ctx` argument)

Every event handler, tool, and command receives a context object with the
runtime state:

```typescript
interface ExtensionContext {
  ui: {
    select(title, options): Promise<option | undefined>;
    confirm(title, message): Promise<boolean>;
    input(title, placeholder?): Promise<string | undefined>;
    notify(message, level?): void;
    setStatus(id, text | undefined): void;
    setWidget(id, lines, placement?): void;
    setTitle(title): void;
    setEditorText(text): void;
    editor(title, prefill?): Promise<string | undefined>;
    custom<T>(factory): Promise<T>;
    // ... more
  };
  mode: "tui" | "rpc" | "json" | "print";
  hasUI: boolean;
  cwd: string;
  isProjectTrusted(): boolean;
  sessionManager: ReadonlySessionManager;
  modelRegistry: ModelRegistry;
  model: Model | undefined;
  signal: AbortSignal | undefined;
  isIdle(): boolean;
  abort(): void;
  hasPendingMessages(): boolean;
  shutdown(): void;
  getContextUsage(): ContextUsage | undefined;
  compact(options?): void;
  getSystemPrompt(): string;
  // Command-only methods (ExtensionCommandContext):
  getSystemPromptOptions(): SystemPromptOptions;
  waitForIdle(): Promise<void>;
  newSession(options?): Promise<{ cancelled: boolean }>;
  fork(entryId, options?): Promise<{ cancelled: boolean }>;
  switchSession(sessionPath, options?): Promise<{ cancelled: boolean }>;
  navigateTree(targetId, options?): Promise<{ cancelled: boolean }>;
  reload(): Promise<void>;
}
```

References: [extensions.md:881-1262](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

#### 2.4.1 `ReplacedSessionContext` (the `withSession` callback)

`newSession`, `fork`, and `switchSession` accept a
`withSession?: (ctx: ReplacedSessionContext) => Promise<void>`
callback. The `ReplacedSessionContext` extends `ExtensionCommandContext`
with `sendMessage` and `sendUserMessage` bound to the **replacement**
session (not the current one).

This matters because **captured `pi` and the command `ctx` are stale
after session replacement.** For `newSession`, `fork`, `switchSession`,
move post-replacement work into the `withSession` callback. Calling
`ctx.sendUserMessage(...)` from the outer scope after the session has
been replaced will route the message to the wrong session.

```typescript
// Correct
pi.on("command_name", async (args, ctx) => {
  const cancelled = await ctx.newSession({
    withSession: async (newCtx) => {
      // newCtx.sendUserMessage(...) targets the new session
      await newCtx.sendUserMessage("Fresh prompt for the new session");
    },
  });
  if (cancelled) {
    // user cancelled; outer ctx still valid
  }
});

// Wrong — outer ctx.sendUserMessage would target the OLD session
pi.on("command_name", async (args, ctx) => {
  await ctx.newSession();
  await ctx.sendUserMessage("This goes to the wrong session");
});
```

Source: [types.ts:339-390](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts),
[extensions.md:1071-1205](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

### 2.5 Tool Registration

Custom tools are registered with a TypeBox schema for parameters and an
async `execute` function:

```typescript
import { Type } from "typebox";

pi.registerTool({
  name: "greet",
  label: "Greet",
  description: "Greet someone by name",
  parameters: Type.Object({
    name: Type.String({ description: "Name to greet" }),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    return {
      content: [{ type: "text", text: `Hello, ${params.name}!` }],
      details: {},
    };
  },
});
```

`promptSnippet` and `promptGuidelines` are optional but recommended —
they show in the system prompt's "Available tools" and "Guidelines"
sections, helping the LLM understand when to use the tool.

Source: [extensions.md:1283-1318](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

### 2.6 Command Registration

Commands are user-invokable via `/name`:

```typescript
pi.registerCommand("hello", {
  description: "Say hello",
  handler: async (args, ctx) => {
    ctx.ui.notify(`Hello ${args || "world"}!`, "info");
  },
});
```

Source: [extensions.md:92-99](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

### 2.7 Provider Registration

Extensions can register alternative LLM providers at startup:

```typescript
pi.registerProvider("local-openai", {
  baseUrl: "http://localhost:1234/v1",
  apiKey: "$LOCAL_OPENAI_API_KEY",
  api: "openai-completions",
  models: [...],
});
```

The async factory pattern (returning `Promise<void>`) ensures providers
are registered before `session_start` and before `registerProvider`
registrations from other extensions flush. This enables fetching model
lists at startup.

Source: [extensions.md:180-217](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

### 2.8 The jiti Loader

Extensions are loaded via [jiti](https://github.com/unjs/jiti), which
runs TypeScript at runtime without a separate build step. This means an
extension can ship as a single `.ts` file and Pi will load it directly.

> Extensions are loaded via jiti, so TypeScript works without compilation.
> — [extensions.md:178](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

We will still use `tsc` to produce `.d.ts` types and a small `dist/` —
see ADR-011 in [`05-architecture-decisions.md`](./05-architecture-decisions.md#adr-011-build-tool-choice-tsc-vs-tsdown-vs-unbuild-vs-no-build).

## 3. The Pi Package Manifest

A "Pi package" is an npm package with a `pi` key in `package.json` and
the `pi-package` keyword.

### 3.1 Minimal Manifest

```json
{
  "name": "@maestria/pi",
  "version": "0.1.0",
  "keywords": ["pi-package"],
  "type": "module",
  "pi": {
    "extensions": ["./dist/extension.js"],
    "prompts": ["./prompts"],
    "skills": ["./skills"]
  }
}
```

Paths are relative to the package root. Arrays support glob patterns and
`!exclusions`.

### 3.1 The Pi CLI Surface

The relevant CLI commands and flags for `@maestria/pi`:

| Command / Flag                | Purpose                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `pi install <pkg>`            | Install a package (npm, git, or local path)               |
| `pi -e <ext>`                 | Load an extension (transient, not persisted)              |
| `pi -p <prompt>` / `--print`  | Non-interactive print mode (run a single prompt and exit) |
| `pi --no-builtin-tools`       | Start without built-in tools (for testing)                |
| `pi --no-skills`              | Start without auto-loading skills                         |
| `pi --no-prompt-templates`    | Start without auto-loading prompt templates               |
| `pi --skill <path>`           | Load a specific skill by path                             |
| `pi --prompt-template <path>` | Load a specific prompt template by path                   |
| `pi update <pkg>`             | Update an installed package                               |
| `pi list`                     | List installed packages                                   |

`pi -e` is the development tool — it loads an extension
transiently, useful for testing without polluting settings.
`pi -p` (or `--print`) is the non-interactive mode that runs a
single prompt and exits, suitable for shell scripts and CI.

Source: [packages.md:115-148](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md),
[usage.md:165, 196-219](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/usage.md)

### 3.2 Convention Directories

If no `pi` manifest is present, Pi auto-discovers:

- `extensions/*.ts` (and `*.js`)
- `skills/**/SKILL.md` (recursive) and root-level `*.md` files
- `prompts/*.md` (non-recursive)
- `themes/*.json`

We use the explicit `pi` manifest for clarity and to avoid ambiguity.

Source: [packages.md:154-164](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)

### 3.3 Dependency Rules

The rules from the Pi packages docs are precise. We follow them
verbatim.

#### Third-party dependencies → `dependencies`

Any package that is not Pi core goes in `dependencies`. Pi runs
`npm install` when installing a package, so these are available at
runtime.

#### Pi core packages → `peerDependencies` with `"*"`

The following packages are bundled by Pi and must NOT be bundled by us:

- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-agent-core`
- `@earendil-works/pi-ai`
- `@earendil-works/pi-tui`
- `typebox`

We list them in `peerDependencies` with a `"*"` range:

```json
{
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-ai": "*",
    "typebox": "*"
  }
}
```

(`@earendil-works/pi-agent-core` and `@earendil-works/pi-tui` are also
peer deps, but we don't import them directly.)

#### Other Pi packages → `dependencies` + `bundledDependencies`

If we depend on another Pi package, we add it to both `dependencies` and
`bundledDependencies`, then reference it through `node_modules/` paths in
the `pi` manifest.

For v1, we do not depend on any other Pi package. We depend on no
third-party packages either.

#### Backward-compat `@mariozechner/*` aliases

Per [`loader.ts:43-61`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/loader.ts),
imports can use either the new `@earendil-works/*` namespace or the
legacy `@mariozechner/*` namespace. Pi resolves both. The maestria
package uses the new `@earendil-works/*` namespace throughout; the
`@mariozechner/*` aliases are mentioned for completeness (e.g., if a
user copies a code snippet from an older extension that uses the
legacy namespace).

Source: [packages.md:165-186](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)

### 3.4 Gallery Metadata

For the [pi.dev/packages](https://pi.dev/packages) gallery, we can add:

```json
{
  "pi": {
    "video": "https://example.com/demo.mp4",
    "image": "https://example.com/screenshot.png"
  }
}
```

Both are optional. Skip in v1.

### 3.5 Package Filtering

Users can filter what a package loads in their `settings.json`:

```json
{
  "packages": [
    {
      "source": "npm:@maestria/pi",
      "prompts": ["prompts/orchestrator.md"],
      "skills": []
    }
  ]
}
```

`+path` and `-path` are exact paths. `!pattern` excludes. Filters layer on
top of the manifest — they narrow what is already allowed.

Source: [packages.md:188-214](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)

## 4. Skills (Agent Skills Spec)

Pi implements the [Agent Skills standard](https://agentskills.io/specification)
with one intentional deviation: **skill `name` does not have to match the
parent directory**. This is documented in the skills docs as a deliberate
choice to support shared skill directories across multiple agent harnesses.

### 4.1 Frontmatter

Per the Agent Skills spec:

| Field                      | Required | Notes                                     |
| -------------------------- | -------- | ----------------------------------------- |
| `name`                     | Yes      | 1–64 chars, lowercase a-z 0-9 hyphens     |
| `description`              | Yes      | Max 1024 chars, **required for load**     |
| `license`                  | No       | Name or reference                         |
| `compatibility`            | No       | Max 500 chars                             |
| `metadata`                 | No       | Arbitrary key-value                       |
| `allowed-tools`            | No       | Space-delimited, experimental             |
| `disable-model-invocation` | No       | Hide from system prompt; user must invoke |

Skills without `description` are not loaded.

Source: [skills.md:137-189](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)

### 4.2 Progressive Disclosure

Only the `name` and `description` are in the system prompt. The full
body loads on demand when the agent uses `read` to fetch the SKILL.md, or
when the user invokes `/skill:name`. This keeps system prompt size small
regardless of how many skills are available.

Source: [skills.md:65-73](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)

### 4.3 Locations

Pi loads skills from:

- Global: `~/.pi/agent/skills/`, `~/.agents/skills/`
- Project: `.pi/skills/`, `.agents/skills/` (only after trust)
- Packages: `skills/` directories or `pi.skills` manifest entries
- Settings: `skills` array
- CLI: `--skill <path>`

Our package's `skills/` directory is loaded as part of the package
install.

Source: [skills.md:23-41](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)

## 5. Prompt Templates

A prompt template is a `.md` file with optional YAML frontmatter. The
filename becomes the command name (`review.md` → `/review`).

### 5.1 Frontmatter

| Field           | Required | Default                                 |
| --------------- | -------- | --------------------------------------- |
| `description`   | No       | First non-empty line                    |
| `argument-hint` | No       | `<required>` / `[optional]` for UI hint |

Source: [prompt-templates.md:19-54](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/prompt-templates.md)

### 5.2 Argument Syntax

| Syntax              | Meaning                      |
| ------------------- | ---------------------------- |
| `$1`, `$2`, ...     | Positional arg N             |
| `$@` / `$ARGUMENTS` | All args joined              |
| `${1:-default}`     | Arg 1, or `default` if empty |
| `${@:N}`            | Args from Nth position       |
| `${@:N:L}`          | `L` args starting at N       |

This is the mechanism we use to pass handoff-contract arguments from the
orchestrator to a specialist template (see ADR-014 in
[`05-architecture-decisions.md`](./05-architecture-decisions.md#adr-014-prompt-template-argument-binding)).

### 5.3 Loading Rules

Template discovery in `prompts/` is **non-recursive**. Subdirectories need
explicit manifest entries. We use a flat `prompts/` directory in v1.

Source: [prompt-templates.md:90-95](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/prompt-templates.md)

## 6. Compaction

Compaction is Pi's mechanism for managing context growth. When the
context window fills up, Pi summarizes older messages into a
`CompactionEntry` and keeps recent messages from `firstKeptEntryId`
onward.

### 6.1 Trigger

Auto-compaction triggers when:

```
contextTokens > contextWindow - reserveTokens
```

`reserveTokens` defaults to 16384; `keepRecentTokens` defaults to 20000.
Both are configurable in `settings.json`. Manual `/compact [instructions]`
also works.

Source: [compaction.md:25-37](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/compaction.md)

### 6.2 Extension Customization

Two events:

- `session_before_compact` — can cancel, or return a custom summary
- `session_compact` — fires after compaction is saved

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  // event.preparation.messagesToSummarize
  // event.preparation.turnPrefixMessages
  // event.preparation.previousSummary
  // event.preparation.tokensBefore
  // event.preparation.firstKeptEntryId

  return {
    compaction: {
      summary: "Your summary...",
      firstKeptEntryId: event.preparation.firstKeptEntryId,
      tokensBefore: event.preparation.tokensBefore,
    },
  };
});
```

Source: [compaction.md:269-339](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/compaction.md)

### 6.3 What We Preserve

The `summary` field is plain markdown that the next turn sees as the
"old conversation" prefix. We use this to preserve the maestria session
state:

- Active task (the user's current goal)
- Completion promise ("This task is complete when...")
- Blockers (Tried X, Y, Z. Blocked by [cause]. Need [input].)
- File references (modified / read so far)
- Last handoff (who handed off to whom, with what)

The `details` field can store structured state. We use it for
machine-readable bits the prompt can reference.

## 7. Pi vs OpenCode — The Comparison

Both platforms encode the maestria methodology. They are not equivalent
in capabilities.

| Concern                       | OpenCode                                        | Pi                                                                     |
| ----------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| **Subagent model**            | Native `task()` subagent                        | No native primitive; spawn subprocess via custom tool                  |
| **Subagent context**          | Inherited from parent's context window          | Isolated per subprocess (clean room)                                   |
| **Lifecycle hooks**           | 2 (`config`, `experimental.session.compacting`) | 30+ events across startup, session, agent, message, tool, input, model |
| **System prompt injection**   | `input.instructions` in `config` hook           | `before_agent_start` event handler                                     |
| **Compaction preservation**   | `experimental.session.compacting` hook          | `session_before_compact` / `session_compact` events                    |
| **Tool permission model**     | Per-agent YAML frontmatter                      | Per-session via `tool_call` interception + tool allow-list             |
| **Custom tools**              | Via plugin code + skill files                   | Via `pi.registerTool` with TypeBox schemas                             |
| **User commands**             | n/a (slash commands are platform-built)         | `pi.registerCommand` for custom `/cmd`                                 |
| **Provider registration**     | Per OpenCode config                             | `pi.registerProvider` at extension startup                             |
| **UI hooks**                  | None (TUI is platform-fixed)                    | `ctx.ui.setStatus`, `setWidget`, `setEditorText`, `custom`             |
| **Skill format**              | Custom (markdown + frontmatter)                 | Agent Skills spec                                                      |
| **Prompt templates**          | n/a (skills only)                               | Native `/name` invocation                                              |
| **Themes**                    | n/a                                             | JSON files in `themes/`                                                |
| **Pure plugin distribution**  | Yes (no postinstall)                            | Yes (no postinstall; npm/git/local source)                             |
| **Manifest format**           | `package.json` `main`/`exports`                 | `package.json` `pi` key + `pi-package` keyword                         |
| **Build at install**          | No                                              | No                                                                     |
| **TypeScript**                | `tsc` to `dist/`                                | jiti at runtime (no build needed) — we still `tsc`                     |
| **Trusted-code distribution** | Yes (OpenCode plugin)                           | Yes (Pi package; explicit "trust" UX)                                  |
| **Version target**            | `@opencode-ai/plugin@^1.17`                     | `@earendil-works/pi-coding-agent@^0.79`                                |

### 7.1 What Pi Does Better Than OpenCode

- **Subprocess isolation for subagents.** The subagent extension pattern
  gives us isolated context windows per specialist. OpenCode's `task()`
  shares the parent's context, which can pollute the specialist's
  reasoning with parent-level noise. On Pi, the `subagent` tool spawns
  a fresh `pi` process with a clean context — the specialist sees only
  what we put into its task description and the loaded skill descriptions.

- **Model registry access.** `ctx.modelRegistry` lets an extension look
  up models by provider and resolve API keys. To switch the active
  model, use `pi.setModel(model)` (or the user invokes `/model`
  interactively). We use this for the maker/checker split: a `/review`
  command calls `pi.setModel(reviewModel)` to a different provider
  (e.g., a reasoning model) to get a fresh perspective. OpenCode has
  no equivalent hook.

- **Tool-call interception and result mutation.** `tool_call` can
  block destructive operations, and `tool_result` can modify what the
  LLM sees. This gives us finer-grained control than OpenCode's
  `edit: deny` frontmatter (which is static, not contextual).

- **30+ lifecycle events.** We can hook into input, model changes,
  context, before_provider_request, after_provider_response, and many
  more. The opencode plugin is limited to `config` and
  `experimental.session.compacting`.

- **Custom UI hooks.** `ctx.ui.custom` lets an extension render a full
  TUI component with keyboard input. The `tools` example extension
  shows a settings-list with `SettingsList` from `@earendil-works/pi-tui`.
  OpenCode's TUI is not extensible.

- **Native prompt templates.** The `/name` invocation is built into Pi.
  OpenCode has no analog — specialists are spawned as subagents, not
  invoked as commands.

### 7.2 What OpenCode Does Better Than Pi

- **Native subagent primitive.** `task()` is a one-liner; Pi's
  subprocess pattern is ~1000 lines of code. The cost of Pi's
  flexibility is implementation overhead.

- **Permission frontmatter.** Per-agent YAML permissions are
  declarative and human-readable. Pi's `tool_call` interception is
  programmatic TypeScript. The declarative version is easier to audit.

- **Maturity.** OpenCode is at 1.17.x. Pi is at 0.79.6 — pre-1.0,
  with API surface changes still happening.

- **No subprocess overhead.** OpenCode subagents are in-process. Pi
  subprocesses cost ~100–500ms of cold start each. Parallel
  subagent invocation on Pi is slower than OpenCode's parallel `task()`
  calls.

[`packages/opencode/src/index.ts`](../../packages/opencode/src/index.ts)
is 189 lines.

### 7.3 What Neither Platform Does

- **Real model-aware permissions.** Neither platform lets you say
  "allow `edit` only when the model is Claude Sonnet, deny when it's
  Haiku." The maker/checker split on both platforms is enforced
  structurally (separate agent / separate session) not via model
  identity.

- **First-class handoff contract validation.** Both platforms let
  you pass structured payloads between stages. Neither validates
  that the payload has all six required fields (Goal, Context,
  Requirements, Known problems, Success criteria, Next step). This
  is a methodology gap that the maestria skill (handoff contract)
  addresses in-process.

## 8. What Pi Cannot Do (and Our Workarounds)

Some maestria patterns do not map cleanly to Pi primitives. These are
the gaps, with the workarounds adopted in this plan.

### 8.1 No `edit: deny` Per Agent

**Gap:** OpenCode agents can declare `edit: deny` in YAML frontmatter.
Pi has no equivalent — there is no per-agent YAML; the agent is the
primary loop, and it always has the full toolset.

**Workaround:** The `tool_call` event handler returns
`{ block: true, reason }` for any `edit` / `write` / `bash` tool call
when the session is in "review mode". Review mode is a session-level
flag set when the user invokes `/review` and cleared when the review
turn ends. The handler is implemented in `src/extension.ts` and
checks `pi.appendEntry`-persisted state. Defense-in-depth: we also
rely on the model itself to follow the review-mode instructions in
the prompt template.

### 8.2 No Per-Subagent Tool Restrictions

**Gap:** OpenCode's subagent can have a restricted tool set (e.g.,
`adventurer` cannot `edit` or `bash`). On Pi, the subprocess inherits
the parent's toolset unless `--tools` is passed.

**Workaround:** The subagent tool passes `--tools <restricted-list>`
when spawning the subprocess. The specialist's allowed tools are
declared in the agent `.md` file's `tools:` field, and the orchestrator
passes them at spawn time. This is the same mechanism the example
subagent extension uses.

### 8.3 No Per-Agent System Prompt Layering

**Gap:** OpenCode's `task(adventurer, ...)` swaps the system prompt
to the agent's markdown body. Pi's `before_agent_start` modifies the
parent's system prompt — there is no per-subagent system prompt
isolation in the same way.

**Workaround:** The `subagent` tool passes
`--append-system-prompt <file>` to the subprocess, where `<file>` is
the specialist's prompt template. The subprocess's system prompt is
the parent's plus the specialist's appendix. This is correct for our
needs: the specialist should see the global rules (inherited from
the parent) plus its own specialist prompt.

### 8.4 No Native Compaction Hint Mechanism

**Gap:** OpenCode's `experimental.session.compacting` adds state to
the compaction summary. Pi's `session_before_compact` can return a
custom summary, but it must contain the full state, not append to
the auto-generated summary.

**Workaround:** The extension listens to `agent_end` and `turn_end`
to maintain a `MaestriaState` in module scope. On
`session_before_compact`, the extension serializes the state and
returns it as the compaction summary. The state's structure is
defined in `src/compaction.ts`.

### 8.5 No Declarative Skill Loading Per Agent

**Gap:** OpenCode's agents can declare which skills they "always
load" via their markdown. Pi's specialist prompts are prompt
templates, which are invoked as commands; the skills the specialist
should load are referenced in the prompt body, not in frontmatter.

**Workaround:** The specialist prompt template has a "Skills to Load"
section at the top, listing each skill the specialist should fetch
with `read` on first invocation. The handoff skill (bundled with
`@maestria/pi`) is referenced by name; the LLM loads it via
`read /path/to/skill.md` (which it discovers through the skill
description in the system prompt).

## 9. Summary

Pi is a more expressive substrate than OpenCode in several meaningful
ways (subprocess isolation, model registry, tool interception, native
prompt templates) at the cost of more code and a younger API. The
maestria methodology maps to Pi's primitives, with the gaps handled
via workarounds documented above and in the ADRs.

The core conclusion: **we can build `@maestria/pi` and it will be
capable of encoding the full maestria methodology, with some
adaptations for the parts of the methodology that depended on
OpenCode's permission model.**

The next document — [`02-integration-strategy.md`](./02-integration-strategy.md) —
maps each maestria pattern to specific Pi primitives and event handlers.

## Date

2026-06-18

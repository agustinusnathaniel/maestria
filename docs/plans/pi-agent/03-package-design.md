# 03. Package Design — The `@maestria/pi` Package Layout

This document specifies the exact file layout, `package.json` manifest,
build configuration, and settings.json snippet for `@maestria/pi`. A
developer following this document should be able to scaffold the
package without asking questions.

The design implements the integration strategy in
[`02-integration-strategy.md`](./02-integration-strategy.md). Every
file in the layout is justified by an ADR in
[`05-architecture-decisions.md`](./05-architecture-decisions.md).

> **Scope reduction (ADR-015):** Following the Pi ecosystem survey,
> `@maestria/pi` defers subagent runtime to `@gotgenes/pi-subagents`
> and workflow engine to future evaluation (`pi-crew`,
> `pi-dynamic-workflows` considered for v1.1). The package focuses on
> its differentiators: spec-driven orchestration, session tree
> integration, and structured agent handoff contracts.

## 1. Directory Tree

```
packages/
└── pi/
    ├── package.json
    ├── tsconfig.json
    ├── README.md
    ├── CHANGELOG.md
    ├── LICENSE
    ├── src/
    │   ├── extension.ts        # Main extension entry point
    │   ├── rules.ts            # Loads global rules content
    │   ├── compaction.ts       # MaestriaState + compaction summary renderer
    │   ├── state.ts            # State management (in-memory + persisted)
    │   ├── subagent.ts         # Custom subagent delegation tool
    │   ├── commands.ts         # /orchestrate, /review, /handoff, /maestria-status
    │   ├── tools.ts            # Tool-call interceptor (maker/checker + dangerous commands)
    │   └── safety.ts           # Shared DANGEROUS_PATTERNS + isDestructiveBash
    ├── dist/                   # Build output (tsc)
    │   ├── extension.js
    │   ├── extension.d.ts
    │   ├── rules.js
    │   ├── rules.d.ts
    │   ├── compaction.js
    │   ├── compaction.d.ts
    │   ├── state.js
    │   ├── state.d.ts
    │   ├── subagent.js
    │   ├── subagent.d.ts
    │   ├── commands.js
    │   ├── commands.d.ts
    │   ├── tools.js
    │   ├── tools.d.ts
    │   ├── rules-content.js    # Bundled rules markdown as a string
    │   └── rules-content.d.ts
    ├── rules/
    │   └── AGENTS.md           # Source for the global rules (built into dist/rules-content.js)
    ├── prompts/
    │   ├── orchestrator.md     # /orchestrator, /orchestrate
    │   ├── adventurer.md       # /adventurer
    │   ├── architect.md        # /architect
    │   ├── planner.md          # /planner
    │   ├── builder.md          # /builder
    │   ├── diagnose.md         # /diagnose
    │   ├── reviewer.md         # /reviewer
    │   └── writer.md           # /writer
    ├── skills/
    │   ├── handoff/
    │   │   └── SKILL.md        # Handoff contract template and rules
    │   └── iteration-limits/
    │       └── SKILL.md        # Iteration limit pattern with verifiable termination
    ├── scripts/
    │   ├── build-rules.ts      # Reads rules/AGENTS.md, generates src/rules-content.ts
    │   ├── validate-prompts.mjs# Frontmatter validation for prompts/*.md
    │   └── validate-skills.mjs # Frontmatter validation for skills/*/SKILL.md
    └── tests/
        ├── extension.test.ts
        ├── state.test.ts
        ├── compaction.test.ts
        ├── tools.test.ts
        ├── subagent.test.ts
        └── rules.test.ts
```

## 2. `package.json`

```json
{
  "name": "@maestria/pi",
  "version": "0.1.0",
  "description": "Pi coding agent extension encoding AI engineering praxis: rules, prompt templates, and workflow discipline.",
  "keywords": ["pi-package", "maestria", "ai", "agents", "coding-agent"],
  "homepage": "https://github.com/agustinusnathaniel/maestria/tree/main/packages/pi#readme",
  "bugs": {
    "url": "https://github.com/agustinusnathaniel/maestria/issues"
  },
  "license": "MIT",
  "author": "agustinusnathaniel",
  "repository": {
    "type": "git",
    "url": "https://github.com/agustinusnathaniel/maestria.git",
    "directory": "packages/pi"
  },
  "type": "module",
  "main": "./dist/extension.js",
  "types": "./dist/extension.d.ts",
  "exports": {
    ".": {
      "types": "./dist/extension.d.ts",
      "import": "./dist/extension.js"
    }
  },
  "files": ["dist", "prompts", "skills", "README.md", "CHANGELOG.md", "LICENSE"],
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "scripts": {
    "build": "node --experimental-strip-types scripts/build-rules.ts && tsc",
    "prebuild": "node --experimental-strip-types scripts/build-rules.ts",
    "test": "vp test",
    "lint": "vp check",
    "lint:fix": "vp check --fix",
    "prepublishOnly": "npm run build"
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-ai": "*",
    "typebox": "*"
  },
  "dependencies": {
    "@gotgenes/pi-subagents": "^17.0.0"
  },
  "devDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-ai": "*",
    "typebox": "*",
    "@types/node": "catalog:",
    "commit-and-tag-version": "catalog:",
    "typescript": "catalog:"
  },
  "engines": {
    "node": ">=22.19.0"
  },
  "pi": {
    "extensions": ["./dist/extension.js"],
    "prompts": ["./prompts"],
    "skills": ["./skills"]
  }
}
```

### 2.1 Why These Choices

- **`pi-package` keyword** — required for [pi.dev/packages](https://pi.dev/packages)
  gallery discovery. Source: [packages.md:115-148](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).
- **`peerDependencies` with `"*"`** — Pi core packages
  (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`,
  `typebox`) are bundled by Pi. We do not bundle them. Per the Pi
  packages docs: "Pi bundles core packages for extensions and skills.
  If you import any of these, list them in `peerDependencies` with a
  `"*"` range and do not bundle them."
  Source: [packages.md:165-186](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).
- **`devDependencies` mirrors `peerDependencies`** — we list the same
  three Pi core packages in `devDependencies` with `"*"` so that
  `tsc --noEmit` resolves the types and the `vite-plus` test task
  can `import` from them. Without these, type checking and tests
  would fail in CI. The matching catalog entries to add to
  `pnpm-workspace.yaml` are:

  ```yaml
  catalog:
    # ... existing catalog entries ...
    "@earendil-works/pi-coding-agent": "*"
    "@earendil-works/pi-ai": "*"
    typebox: "*"
  ```

  (If `pnpm` rejects `"*"` ranges in the catalog, use
  `"npm:@earendil-works/pi-coding-agent@*"` instead — the intent
  is "whatever Pi bundles, we use the same version".)

- **`dependencies`** — v1 has one third-party runtime dep:
  `@gotgenes/pi-subagents@^17.0.0` for subagent dispatch
  (MIT license, in-process model). See ADR-015 for the ecosystem
  survey and selection rationale.
- **No `bundledDependencies`** — same reason.
- **`files` array** — `dist` (compiled TS), `prompts` (specialist
  templates), `skills` (methodology skills), plus README/CHANGELOG/LICENSE.
  The `rules/` directory is NOT in the files array because the rules
  content is bundled into `dist/rules-content.js` at build time.
- **`type: "module"`** — matches the rest of the monorepo and Pi's
  expectations.
- **`main` and `exports`** — point to `dist/extension.js` for the
  compiled extension. Pi loads this via jiti but the type info is
  available for IDEs.
- **`engines.node >= 22.19.0`** — matches Pi's minimum
  (`packages/coding-agent/package.json:95`) and is less restrictive
  than the monorepo's `>=24.16.x` (so the package can be used on
  slightly older Node where Pi runs).
- **`prepublishOnly`** — runs `tsc` before `npm publish` to ensure
  `dist/` is current. Matches the opencode package convention.

## 3. `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

This is a copy of `packages/opencode/tsconfig.json` with the same
compiler options. The `rootDir` is `src`; `dist/` is the output.

We use `tsc` (not `tsdown` or `unbuild`) for consistency with the
opencode package. See ADR-011 in
[`05-architecture-decisions.md`](./05-architecture-decisions.md#adr-011-build-tool-choice-tsc-vs-tsdown-vs-unbuild-vs-no-build).

## 4. File-by-File Purpose

### 4.1 `src/extension.ts` — Main Entry Point

The default export. Wires up all event handlers, registers the
subagent tool, and registers the commands. Imports from the
other modules in `src/`.

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { MAESTRIA_RULES_CONTENT } from "./rules-content.js";
import { installRulesInjection } from "./rules.js";
import { installCompactionHandlers } from "./compaction.js";
import { installSubagentTool } from "./subagent.js";
import { installCommands } from "./commands.js";
import { installToolInterceptors } from "./tools.js";

export default function (pi: ExtensionAPI): void {
  installRulesInjection(pi, MAESTRIA_RULES_CONTENT);
  installCompactionHandlers(pi);
  installSubagentTool(pi);
  installCommands(pi);
  installToolInterceptors(pi);
}
```

This file is intentionally short. The logic lives in
single-purpose modules. The extension is the wiring.

### 4.2 `src/rules.ts` — Rules Injection

Exports `installRulesInjection(pi, content)`. Subscribes to
`before_agent_start` and appends the rules content to the system
prompt.

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function installRulesInjection(pi: ExtensionAPI, rulesContent: string): void {
  pi.on("before_agent_start", async (event) => {
    return {
      systemPrompt: event.systemPrompt + "\n\n## Maestria Global Rules\n\n" + rulesContent,
    };
  });
}
```

The rules content is read from `dist/rules-content.js` (built from
`rules/AGENTS.md`) and passed in as a string. This keeps the
injection self-contained — no runtime file system reads at
extension load.

### 4.3 `src/compaction.ts` — Compaction Preservation

Exports `installCompactionHandlers(pi)`. Subscribes to
`session_before_compact` and `session_before_tree` and returns a
custom summary that includes the `MaestriaState`.

**v1 behavior:** the returned summary is the rendered maestria
state plus a pointer to the session file for full conversation
context. **v1.1** will add the LLM-summarization fallback via
`convertToLlm` + `serializeConversation` (see
[`06-risks-and-open-questions.md` R-13](./06-risks-and-open-questions.md)).
The state is capped at `MAX_FILE_REFS = 10` for `filesRead` /
`filesModified` and the last 5 handoffs (see §4.4).

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getMaestriaState, renderMaestriaSummary } from "./state.js";

export function installCompactionHandlers(pi: ExtensionAPI): void {
  pi.on("session_before_compact", async (event) => {
    const state = getMaestriaState();
    const summary = renderMaestriaSummary(state);
    return {
      compaction: {
        summary,
        firstKeptEntryId: event.preparation.firstKeptEntryId,
        tokensBefore: event.preparation.tokensBefore,
      },
    };
  });

  pi.on("session_before_tree", async (event) => {
    if (!event.preparation.userWantsSummary) return;
    const state = getMaestriaState();
    return {
      summary: {
        summary: renderMaestriaSummary(state),
        details: state,
      },
    };
  });
}
```

The "see session for full history" pointer is appended at the
bottom of `renderMaestriaSummary`'s output (see §4.4). The
compaction `details` field is also populated with the structured
`MaestriaState` for future-proofing, in case future Pi versions
make `details` visible to the LLM.

### 4.4 `src/state.ts` — Session State

Maintains the `MaestriaState` in module scope. Exposes get/set
helpers. Updates the state on tool_call events for file tracking
and on subagent invocations for handoff history.

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Cap on file references to keep the compaction summary small.
// Each file path is ~30–80 chars; 10 entries = ~600 chars, well
// under any model-context budget. See R-13 in
// 06-risks-and-open-questions.md for the rationale.
const MAX_FILE_REFS = 10;

export interface MaestriaState {
  activeTask: string;
  completionPromise: string;
  specialistsDelegated: string[];
  blockers: string[];
  filesModified: string[];
  filesRead: string[];
  handoffHistory: HandoffEntry[];
  reviewMode: boolean;
  reviewModel: string | null;
}

export interface HandoffEntry {
  from: string;
  to: string;
  task: string;
  timestamp: number;
}

let state: MaestriaState = createEmptyState();

export function getMaestriaState(): MaestriaState {
  return state;
}

export function recordHandoff(from: string, to: string, task: string): void {
  state.handoffHistory.push({
    from,
    to,
    task: task.slice(0, 200),
    timestamp: Date.now(),
  });
  // Keep last 5
  if (state.handoffHistory.length > 5) {
    state.handoffHistory = state.handoffHistory.slice(-5);
  }
}

export function recordFileModified(path: string): void {
  if (!state.filesModified.includes(path)) {
    state.filesModified.push(path);
  }
  // Cap to last 10 (most recent appends; older entries fall off
  // the front).
  if (state.filesModified.length > MAX_FILE_REFS) {
    state.filesModified = state.filesModified.slice(-MAX_FILE_REFS);
  }
}

export function recordFileRead(path: string): void {
  if (!state.filesRead.includes(path)) {
    state.filesRead.push(path);
  }
  if (state.filesRead.length > MAX_FILE_REFS) {
    state.filesRead = state.filesRead.slice(-MAX_FILE_REFS);
  }
}

export function setReviewMode(active: boolean, model: string | null = null): void {
  state.reviewMode = active;
  state.reviewModel = active ? model : null;
}

export function renderMaestriaSummary(state: MaestriaState): string {
  // Renders the state as markdown for compaction. The
  // MAX_FILE_REFS cap keeps this small (~1–2KB total).
  // Appends a "see session for full history" pointer because
  // v1 does not include Pi's default auto-summary (see R-13);
  // v1.1 will replace this with the LLM-summarization fallback.
  // ... (full implementation in src/state.ts)
}

function createEmptyState(): MaestriaState {
  return {
    activeTask: "",
    completionPromise: "",
    specialistsDelegated: [],
    blockers: [],
    filesModified: [],
    filesRead: [],
    handoffHistory: [],
    reviewMode: false,
    reviewModel: null,
  };
}
```

The state is in-memory only. Compaction is the only persistence
mechanism (the state is rebuilt from the compaction summary on the
next turn). This is acceptable because the state is recoverable:
the next turn's `before_agent_start` handler can repopulate the
state from the compaction summary by parsing the markdown.

### Persistence (v1.1 — design done, implementation deferred)

State survives process restart via `pi.appendEntry`:

**Entry format:**

- Key pattern: `maestria:state:{sessionId}:{key}`
- Values: JSON-serialized, chunked if > 8KB

**On `session_start`:**

1. Query all `maestria:state:{sessionId}:*` entries via
   `pi.appendEntry`'s read API
2. Deserialize and merge into `MaestriaState`
3. If no saved state, initialize empty

**On state mutation:**

1. Write full state snapshot as entry (or delta for large states)
2. Cap at `MAX_ENTRIES = 50` per session
3. Oldest entries pruned when limit reached

Schema documented per R-10 in
[`06-risks-and-open-questions.md`](./06-risks-and-open-questions.md).
Implementation deferred to Phase 3 (currently implements
module-scope only).

### 4.5 `src/subagent.ts` — Adapter for `@gotgenes/pi-subagents`

**Strategy:** Adapter on top of `@gotgenes/pi-subagents` (see
ADR-015).

Instead of building a subprocess-based subagent tool from scratch,
`@maestria/pi` wraps `@gotgenes/pi-subagents` with:

1. **Handoff validation pre-check** — Before spawning a specialist,
   verify the 6-field handoff contract exists and is non-empty.
   Reject with clear error if malformed.
2. **Spec-driven orchestration integration** — The specialist's
   assigned spec (from the orchestrator's workflow DAG) is passed
   alongside the handoff contract.
3. **Session tree metadata** — Each subagent invocation records
   its parent task ID for session tree reconstruction.

#### Key APIs Consumed

- `getSubagentsService()` — access to the in-process subagent
  runtime
- `subagents:*` events — lifecycle hooks for the orchestrator
- `WorkspaceProvider` — isolation seam (for future worktree
  isolation)

#### Design Constraint

`@gotgenes/pi-subagents` has a recursion guard that prevents
subagents from spawning their own subagents. `@maestria/pi`'s
orchestration layer sits above the subagent layer — the
orchestrator dispatches specialists, specialists do not
self-orchestrate.

#### Implementation Sketch

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getSubagentsService } from "@gotgenes/pi-subagents";
import { recordHandoff } from "./state.js";

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;

// Validates the 6-field handoff contract.
// Returns { valid: true } or { valid: false, errors: string[] }.
function validateHandoff(handoff: string): { valid: boolean; errors: string[] } {
  const requiredFields = [
    "Goal",
    "Context",
    "Requirements",
    "Known problems",
    "Success criteria",
    "Next step",
  ];
  const errors: string[] = [];
  for (const field of requiredFields) {
    // Check field is present with non-empty content
    const re = new RegExp(`^${field}:\\s*(.+)$`, "m");
    const match = handoff.match(re);
    if (!match || !match[1]?.trim()) {
      errors.push(`Missing or empty field: ${field}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function installSubagentTool(pi: ExtensionAPI): void {
  const subagents = getSubagentsService(pi);

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description: [
      "Delegate tasks to specialized subagents with isolated context.",
      "Available agents: adventurer, architect, builder, diagnose, planner, reviewer, writer.",
      "Modes: single (agent + task), parallel (tasks array, max 8), chain (sequential with {previous} placeholder).",
      "Each subagent runs in-process with its own context via @gotgenes/pi-subagents.",
      "The handoff contract (Goal, Context, Requirements, Known Problems, Success Criteria, Next Step) is validated before dispatch.",
    ].join(" "),
    parameters: Type.Object({
      agent: Type.Optional(Type.String({ description: "Name of the agent (single mode)" })),
      task: Type.Optional(Type.String({ description: "Task to delegate (single mode)" })),
      // ... parallel and chain parameters (same shape as before) ...
    }),

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      // Validate handoff contract before dispatch
      const handoff = params.task ?? "";
      const validation = validateHandoff(handoff);
      if (!validation.valid) {
        return {
          content: [
            {
              type: "text",
              text: `Handoff contract validation failed:\n- ${validation.errors.join("\n- ")}`,
            },
          ],
          isError: true,
        };
      }

      // Dispatch via @gotgenes/pi-subagents in-process runtime
      const result = await subagents.spawn({
        agent: params.agent,
        task: handoff,
        // Spec-driven orchestration metadata
        spec: ctx.maestria?.currentSpec,
        parentTaskId: ctx.maestria?.currentTaskId,
      });

      recordHandoff("orchestrator", params.agent, handoff);
      return result;
    },
  });
}
```

The module is ~100 lines (vs ~400 lines for a custom subprocess
implementation). Key differences from the original design:

1. **No subprocess management.** `@gotgenes/pi-subagents` handles
   spawning, lifecycle, and streaming. No `child_process.spawn`,
   no temp-file prompt writes, no `--tools` argument construction.
2. **Handoff validation is blocking, not advisory.** Missing
   fields produce a clear error before the specialist is spawned.
3. **In-process runtime.** Shared session context means no
   cold-start latency (~0ms vs 100-500ms subprocess). The
   recursion guard is by design.
4. **Lifecycle events.** `@maestria/pi` hooks into
   `subagents:*` events for orchestration, not raw
   subprocess I/O.

### 4.6 `src/commands.ts` — User Commands

Registers `/orchestrate`, `/review`, `/handoff`, and
`/maestria-status`. These are user-facing commands that wrap the
methodology in a single-keyword UX.

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function installCommands(pi: ExtensionAPI): void {
  pi.registerCommand("orchestrate", {
    description: "Run the full maestria pipeline on a goal",
    handler: async (args, ctx) => {
      // Send a user message that triggers the orchestrator template + subagent chain
      ctx.sendUserMessage(
        `Run the maestria default pipeline on: ${args}\n\n` +
          `Follow the orchestrator prompt template. Use the subagent tool to delegate.`,
      );
    },
  });

  pi.registerCommand("review", {
    description: "Switch to a fresh model and run the reviewer methodology",
    handler: async (args, ctx) => {
      // See src/commands.ts for the model-cycling implementation
    },
  });

  pi.registerCommand("handoff", {
    description: "Generate a handoff prompt to a new session",
    handler: async (args, ctx) => {
      // Delegates to the handoff skill (see skills/handoff/SKILL.md)
    },
  });

  pi.registerCommand("maestria-status", {
    description: "Show current Maestria state (task, blockers, review mode)",
    handler: async (_args, ctx) => {
      const state = getMaestriaState();
      // Render into the editor so the user can read, copy, and
      // modify the multi-section markdown (rather than seeing a
      // one-line notification toast).
      ctx.ui.setEditorText(renderMaestriaSummary(state));
    },
  });
}
```

#### 4.6.1 `/review` Implementation Detail

The `/review` command:

1. Records the current model and toolset:
   ```typescript
   const savedTools = pi.getActiveTools();
   const savedModel = pi.getModel?.(); // if exposed
   ```
2. Looks up a "review model" via `ctx.modelRegistry`. The review
   model is configurable in `settings.json` under
   `maestria.reviewModel`. If not set, defaults to a different
   provider than the current one (e.g., if the user is on
   `anthropic/claude-sonnet`, switch to a `google/gemini` model).
3. Cycles to the review model via `pi.setModel(reviewModel)`.
4. Switches the runtime toolset to read-only with
   `pi.setActiveTools(["read", "grep", "find", "ls"])` — this
   removes `edit`/`write`/`bash` for the review turn and is the
   strongest single-action enforcement on the parent session.
5. Sets `maestria.reviewMode = true` in state (the `tool_call`
   handler in `src/tools.ts` is the second-layer defense if the
   LLM somehow re-enables a tool).
6. Sends a user message: `Review: <args>. Use the reviewer
prompt template. Read only, no edits, report findings.`
7. After the review turn, restores the original toolset via
   `pi.setActiveTools(savedTools)`, restores the original model
   via `pi.setModel(savedModel)`, and clears `reviewMode` (via a
   `turn_end` listener scoped to the review session).

Reference: [extensions.md:1535-1552](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md),
[`examples/extensions/plan-mode/index.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/plan-mode/index.ts).

#### 4.6.2 `/handoff` Implementation Detail

`/handoff` is a thin wrapper around Pi's built-in `/handoff`-like
pattern (see [`examples/extensions/handoff.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/handoff.ts))
that uses the maestria handoff-contract template. The full
implementation is in `src/commands.ts`.

### 4.7 `src/tools.ts` — Tool-Call Interceptors

The `tool_call` event handler that enforces the maker/checker
split. Two checks:

1. **Review-mode block.** If `state.reviewMode === true`, block
   `edit`, `write`, and `bash` calls (the parent-session `/review`
   cannot rely on subprocess `--tools`; we block the full set
   here).
2. **Dangerous-command block.** Always block `rm -rf`, `sudo`,
   `chmod 777`, etc. (consistent with the example
   `permission-gate.ts`).

`DANGEROUS_PATTERNS` and `isDestructiveBash` are defined in
`src/safety.ts` (see §4.13) and imported by both `src/tools.ts`
and `src/subagent.ts`. The subagent tool uses them to validate
the `--tools` argument it passes to the subprocess.

```typescript
import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getMaestriaState } from "./state.js";
import { DANGEROUS_PATTERNS, isDestructiveBash } from "./safety.js";

export function installToolInterceptors(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    const state = getMaestriaState();

    // Review mode: block edits, writes, and ALL bash
    if (state.reviewMode) {
      if (
        isToolCallEventType("edit", event) ||
        isToolCallEventType("write", event) ||
        isToolCallEventType("bash", event)
      ) {
        return {
          block: true,
          reason: "Review mode is active. Report findings, do not edit.",
        };
      }
    }

    // Always: block dangerous patterns
    if (isToolCallEventType("bash", event)) {
      const command = event.input.command as string;
      if (DANGEROUS_PATTERNS.some((p) => p.test(command))) {
        if (!ctx.hasUI) {
          return { block: true, reason: "Dangerous command (no UI for confirmation)" };
        }
        const ok = await ctx.ui.confirm("Dangerous command", `Allow?\n\n  ${command}`);
        if (!ok) {
          return { block: true, reason: "Blocked by user" };
        }
      }
    }
  });
}
```

The dangerous-pattern block is always active. The review-mode
block only activates after `/review` is invoked.

### 4.8 `rules/AGENTS.md` — Source of Global Rules

This is the source file for the global rules. It is read at build
time by a small script (or manually kept in sync) and embedded
into `src/rules-content.ts` (a generated file, not committed).

The content is identical to
[`packages/opencode/rules/AGENTS.md`](../../packages/opencode/rules/AGENTS.md).
The orchestrator table and the methodology rules are the same.

The rules content includes these directives (as of `@maestria/opencode@0.3.8`):

- **Orchestration** — don't assume, read docs first, use opensrc for repos
- **Delegation** — 7-specialist table with delegation triggers
- **Context management** — progressive disclosure, checkpointing, completion promises
- **Webfetch may hang** — proceed without result if a fetch hangs, surface the skip
- **CLI references** — use `bash --help` or load the relevant skill first
- **Local files** — read directly, don't `webfetch` a file you have access to

> **Update (June 2026):** The opencode package's custom YAML frontmatter parser
> (previously in `packages/opencode/src/index.ts`) has been replaced with the
> `yaml@^2.7.0` library on main (v0.3.7). The Pi package's `discoverSpecialists`
> in `src/subagent.ts` still uses a regex approach for frontmatter, which is
> sufficient for the single `model:` field it parses.

We embed the content as a string constant so the extension has
no runtime file system reads at load time. The build step
generates `src/rules-content.ts`:

```typescript
// GENERATED FILE — DO NOT EDIT
// Source: rules/AGENTS.md
export const MAESTRIA_RULES_CONTENT = `# Global Agent Rules — @maestria/pi

## Orchestration

... (full content of rules/AGENTS.md) ...

`;
```

The generation step is `npm run build` or a separate
`scripts/build-rules.ts`. We keep it simple: a 20-line script
that reads `rules/AGENTS.md` and writes `src/rules-content.ts`.

### 4.9 `prompts/*.md` — The 8 Specialist Templates

Each prompt template is a single `.md` file. The content is
adapted from the corresponding opencode agent (e.g.,
`prompts/adventurer.md` is based on
[`packages/opencode/agents/adventurer.md`](../../packages/opencode/agents/adventurer.md)).

The adaptations are documented in
[`02-integration-strategy.md`](./02-integration-strategy.md) §4.2.
Key differences:

- No YAML frontmatter (no `description`, no `mode`, no `permission`).
- The 6-field handoff contract is in the prompt body, not split
  with frontmatter.
- The skill prescription is in the prompt body, with explicit
  `read /skill:<name>` references.
- Iteration limits are in the prompt body, not in frontmatter.
- The `!!!` convention is preserved (per ADR-003 in
  [`docs/adr/ADR-003-agent-conventions.md`](../adr/ADR-003-agent-conventions.md)).

The orchestrator template is the most complex. It contains:

- The 7-specialist table
- The default pipeline diagram
- The handoff contract template
- The iteration-limit format
- The maker/checker rule
- The completion-promise format
- A "post-compaction recovery" section
- A "subagent tool" usage guide

The total prompt-template content is ~3,000 lines across the 8
files, with the orchestrator template being ~600 lines.

### 4.10 `skills/handoff/SKILL.md` — Handoff Contract Skill

A skill that codifies the 6-field handoff contract for specialists
to reference. Loaded on demand by any specialist that needs to
write or receive a handoff.

```markdown
---
name: handoff
description: The 6-field handoff contract for inter-specialist delegation.
  Load when receiving a task from another specialist, or when handing off work
  to the next stage in the pipeline. Defines the contract format and the
  "ambiguity flag" rule.
---

# Handoff Contract

A handoff contract has 6 fields. Every delegation crossing a specialist
boundary must be a complete briefing.

## Fields

1. **Goal** — What to achieve and why it matters
2. **Context** — Relevant paths, constraints, prior decisions, what's been tried
3. **Requirements** — Specific expectations and boundaries
4. **Known problems** — Issues already identified, what to watch for
5. **Success criteria** — How to verify the work is done (the completions promise)
6. **Next step** — What happens after this task completes

## Ambiguity Rule

End every handoff with: "If anything is unclear or ambiguous, ask
before proceeding."

## Example

Goal: Map the auth module's session handling paths before we refactor login.
Context: /src/auth/session.ts (the main file), ADR-003 in docs/adr/.
We already know the token refresh path has a race condition (issue #42).
Requirements: Trace every code path that reads or writes session state.
Do not edit any files — read only. List files and line numbers.
Known problems: The JWT expiration check in session.ts line 89 uses wall
clock time instead of server time, which causes intermittent failures
across timezones.
Success criteria: A complete call graph of session operations with file
paths, line numbers, and the race condition's entry points documented.
Next step: @architect receives this map to design the fix strategy.
```

### 4.11 `skills/iteration-limits/SKILL.md` — Iteration Limits

Codifies the iteration-limit pattern (verifiable termination +
max-N + escalation format).

```markdown
---
name: iteration-limits
description: The iteration-limit pattern with verifiable termination and
  escalation format. Load when defining termination conditions for a loop,
  when a loop is at risk of running too long, or when a specialist needs to
  escalate persistent blockers.
---

# Iteration Limits

Every loop must have three controls. They prevent infinite loops, agent
ping-pong, and silent failure.

## 1. Verifiable Termination Condition

A concrete, measurable state that stops the loop. Not "done when it
feels right." Done when the success criteria are met.

## 2. Max-N Hard Limit

Usually 3 attempts before escalation. If the loop fails after N tries,
it's not a persistence problem — it's a context, skill, or approach
problem that needs human judgment.

## 3. Escalation Format

A structured message so the next stage or the human operator can take
over without guessing what went wrong:

> Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.

## Why This Matters

The model that wrote the code is too nice grading its own homework.
Iteration limits prevent the model from retrying in a loop instead of
escalating.
```

### 4.12 `tests/` — Unit Tests

Vitest-based unit tests. Pi doesn't ship test infrastructure for
extensions, so we test the extension modules in isolation.

Tests:

- `state.test.ts` — MaestriaState CRUD, handoff history trimming,
  summary rendering.
- `compaction.test.ts` — Compaction summary structure, recovery
  parsing.
- `tools.test.ts` — Tool-call interceptor logic, dangerous pattern
  detection, review-mode block.
- `subagent.test.ts` — Subprocess spawn args, tool-restriction
  lookup, handoff recording. (Mocked `pi` API.)
- `extension.test.ts` — Integration test: install all handlers on
  a mock `pi` API, verify all events are subscribed.

We use `vitest` (consistent with the rest of the monorepo) and
the `@vitest` catalog version. See [pnpm-workspace.yaml](../../pnpm-workspace.yaml).

### 4.13 `src/safety.ts` — Shared Danger Patterns

A small module that exports `DANGEROUS_PATTERNS` (the regex set for
destructive bash) and `isDestructiveBash(command: string)`. Both
`src/tools.ts` (the `tool_call` interceptor) and `src/subagent.ts`
(the subprocess toolset validator) import from here. Single source
of truth for "what counts as destructive".

```typescript
/**
 * Patterns that indicate a destructive bash command.
 * Matches `rm -rf`, `sudo`, `chmod 777`, etc.
 * Same set as the upstream `permission-gate.ts` example.
 */
export const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+(-rf?|--recursive)/i,
  /\bsudo\b/i,
  /\b(chmod|chown)\b.*777/i,
];

export function isDestructiveBash(command: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(command));
}
```

## 5. The `pi` Manifest Entry

The `pi` key in `package.json`:

```json
"pi": {
  "extensions": ["./dist/extension.js"],
  "prompts": ["./prompts"],
  "skills": ["./skills"]
}
```

- `./dist/extension.js` — the single extension entry point.
  All logic is wired through this file.
- `./prompts` — directory containing the 8 specialist templates.
  Pi auto-discovers `*.md` files (non-recursive).
- `./skills` — directory containing the 2 skill directories.
  Pi auto-discovers `SKILL.md` recursively.

We deliberately use `./dist/extension.js` (not `./src/extension.ts`).
Even though Pi can load `.ts` via jiti, we ship `.js` for:

1. Faster load (jiti compiles on first import, which is slow).
2. Avoids requiring tsconfig compatibility.
3. Consistent with the opencode package convention.
4. Lets users `node -e "require('@maestria/pi')"` if they want
   to inspect the API.

Source: [packages.md:115-148](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)

## 6. The `files` Array for npm Publish

```json
"files": [
  "dist",
  "prompts",
  "skills",
  "README.md",
  "CHANGELOG.md",
  "LICENSE"
]
```

- `dist` — the compiled TypeScript
- `prompts` — the specialist templates
- `skills` — the methodology skills
- `README.md`, `CHANGELOG.md`, `LICENSE` — package metadata

`src/`, `tests/`, `rules/`, `tsconfig.json` are excluded (they're
dev-only or are bundled into `dist/rules-content.js`).

The `LICENSE` is a copy of the root [MIT LICENSE](../../LICENSE).

## 7. Build Strategy

### 7.1 The Build Command

```bash
npm run build
```

This runs:

1. `node --experimental-strip-types scripts/build-rules.ts` (also
   wired as `prebuild`, so `npm run build` and `vp run build` both
   trigger it) — reads `rules/AGENTS.md`, writes
   `src/rules-content.ts`. Node 22+ runs TypeScript directly with
   `--experimental-strip-types`, no separate compile step needed for
   the script itself.
2. `tsc` — compiles `src/` (including the generated
   `src/rules-content.ts`) to `dist/`.

We could combine these into a single `tsc` with a custom
transformer, but a 20-line `scripts/build-rules.ts` is simpler.

### 7.2 Why Not Skip Build Entirely?

Pi loads TypeScript via jiti at runtime. We could ship
`./src/extension.ts` and skip the build step entirely. We choose
not to because:

1. **Type hints.** `.d.ts` files give IDEs and type-checking
   tools a public API. Users can import from `@maestria/pi` and
   get completion.
2. **Consistency with `@maestria/opencode`.** Same build tool,
   same output structure, same `vp check` integration.
3. **Cold-start speed.** Pre-compiled JS loads faster than
   jiti-compiled TS.
4. **No tsconfig assumptions.** Users don't have to match our
   TypeScript version.

See ADR-011 in
[`05-architecture-decisions.md`](./05-architecture-decisions.md#adr-011-build-tool-choice-tsc-vs-tsdown-vs-unbuild-vs-no-build).

### 7.3 Build Output

The `dist/` directory contains ~16 files (7 source files × 2
extensions = 14 + the generated `rules-content.{js,d.ts}` = 2).
Total size is ~50KB minified, ~150KB with sourcemaps. Small enough
that the npm package stays under 100KB.

## 8. Installation Paths

### 8.1 User Installation (npm)

```bash
pi install npm:@maestria/pi
```

This installs `@maestria/pi` to `~/.pi/agent/npm/@maestria/pi/`
and adds it to `~/.pi/agent/settings.json`. The `pi` key in our
`package.json` is read, the extension is registered, and the
prompts and skills are loaded.

### 8.2 Project Installation (shared with team)

Add to `.pi/settings.json` in the project:

```json
{
  "packages": ["npm:@maestria/pi"]
}
```

When the project is trusted, Pi auto-installs the package and
loads the resources. Source:
[packages.md:38-42](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).

### 8.3 Local Path (development)

```bash
pi install /absolute/path/to/packages/pi
# or
pi install ./packages/pi
```

Useful for testing the package during development. The package
is loaded from the local path, not npm. Source:
[packages.md:105-112](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).

### 8.4 Git Install (version pinning)

```bash
pi install git:github.com/agustinusnathaniel/maestria@v0.1.0
```

For users who want to pin to a specific tag. The repository's
`packages/pi` subdirectory is loaded.

## 9. Settings JSON Snippets

### 9.1 Minimal (just install)

The user adds the package to their global or project settings:

```json
{
  "packages": ["npm:@maestria/pi"],
  "enableSkillCommands": true
}
```

The `enableSkillCommands: true` flag is required for the
`/skill:handoff` and `/skill:iteration-limits` invocations in
Phase 7. Without it, the user has to load skills via the
`read` tool only. Source:
[skills.md:85-90](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md).

This is enough to get all 8 prompt templates, 2 skills, and the
extension. The extension registers the `subagent` tool, the
`/orchestrate`, `/review`, `/handoff`, `/maestria-status`
commands, the rules injection, and the compaction preservation.

### 9.2 With Review Model Configuration

```json
{
  "packages": ["npm:@maestria/pi"],
  "maestria": {
    "reviewModel": "google/gemini-2.5-pro"
  }
}
```

The `maestria.reviewModel` key tells the `/review` command which
model to switch to. If unset, `/review` picks a different
provider than the active model.

### 9.3 With Subagent Resource Limits

```json
{
  "packages": ["npm:@maestria/pi"],
  "maestria": {
    "subagent": {
      "maxParallel": 4,
      "timeoutMs": 300000
    }
  }
}
```

Optional. `maxParallel` defaults to 4 (matching the example
extension's `MAX_CONCURRENCY`). `timeoutMs` defaults to 5 minutes
per subagent call.

## 10. Verification Commands

The package is correct if these commands succeed:

```bash
# Type check
npx tsc --noEmit

# Lint (oxlint via vp)
vp check

# Tests (vitest via vp)
vp test

# Build
npm run build

# Verify build output
ls -la dist/extension.js
test -f dist/extension.js && echo "OK"

# Verify pi manifest
node -e "const p = require('./package.json'); console.log(p.pi);"

# Verify files array
node -e "const p = require('./package.json'); console.log(p.files);"
```

The end-to-end verification (does the extension actually load in
Pi?) requires running Pi and invoking the commands. This is done
in Phase 1 of the implementation, see
[`04-implementation-phases.md`](./04-implementation-phases.md#phase-1-skeleton--install).

## 11. Summary

The package is:

- **7 TypeScript source files** in `src/` (extension, rules,
  compaction, state, subagent, commands, tools)
- **8 prompt templates** in `prompts/` (orchestrator + 7
  specialists)
- **2 skills** in `skills/` (handoff, iteration-limits)
- **6 test files** in `tests/` (vitest)
- **1 `package.json`** with the `pi` manifest, peer deps, and
  `files` array
- **1 `tsconfig.json`** (same as opencode package)
- **Build with `tsc`**, consistent with the opencode package
- **No postinstall, no file-system side effects** beyond the
  package directory

A developer can scaffold this in a day. The full implementation
(Phase 1–8) is ~2 weeks of focused work. See
[`04-implementation-phases.md`](./04-implementation-phases.md).

## Date

2026-06-18

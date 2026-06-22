# 03. Package Design — The `@maestria/pi` Package Layout

> **Note — implementation divergences from this plan:**
> This document described a pre-implementation design that differs from
> the shipped `@maestria/pi@0.1.0` in several respects:
>
> - **Build tool:** `vp pack` (not `tsc`) → produces `dist/extension.mjs` (not `dist/extension.js`)
> - **Source files:** 9 TS files (not 7) — `modes.ts` was added for workflow mode commands
> - **Node engine:** `>=22.12.0` (not `>=22.19.0`)
> - **`files` array:** includes `rules/` (plan said exclude) and excludes `CHANGELOG.md` (plan said include)
> - **`publishConfig.provenance`:** not set (plan said `true`)
> - **Tool name:** registered as `maestria_subagent` (not `subagent`)
> - **Dependency versions:** actual `package.json` has fewer devDependencies and no `commit-and-tag-version`
>
> Each divergence is annotated inline below. The canonical source is [`packages/pi/`](../../packages/pi/).

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
    │   ├── subagent.ts         # Custom subagent delegation tool (registered as `maestria_subagent`)
    │   ├── commands.ts         # /orchestrate, /review, /handoff, /maestria-status
    │   ├── tools.ts            # Tool-call interceptor (maker/checker + inline dangerous patterns)
    │   ├── modes.ts            # Workflow mode commands (/fein, /sonar, /blitz)
    │   └── rules-content.ts    # Generated — bundles rules/AGENTS.md as a string
    ├── dist/                   # Build output (vp pack / Rolldown)
    │   ├── extension.mjs       # Single bundled artifact
    │   └── extension.mjs.map   # Sourcemap
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

## 2. `package.json` (as implemented)

> **Note:** The actual `package.json` differs from the planned version below.
> Key changes:
>
> - `files` includes `rules/` and omits `CHANGELOG.md`
> - Build is `vp pack` (not `tsc`) — no `prepublishOnly`, no `lint:fix`
> - `publishConfig.provenance` is not set
> - No `main`/`types`/`exports` fields (bundled `.mjs` has no need)
> - `engines.node` is `>=22.12.0`
> - Simpler `devDependencies` — Pi core packages are NOT in devDeps (not needed since `vp pack` bundles them externally)
> - No `"pi-package"` keyword (omitted; not required for package discovery)

```json
{
  "name": "@maestria/pi",
  "version": "0.1.0",
  "description": "Maestria extension for the Pi coding agent",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/agustinusnathaniel/maestria.git",
    "directory": "packages/pi"
  },
  "files": ["dist", "prompts", "rules", "skills", "README.md", "LICENSE"],
  "type": "module",
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "vp pack",
    "prebuild": "node --experimental-strip-types scripts/build-rules.ts",
    "test": "vp test",
    "lint": "vp check"
  },
  "dependencies": {
    "@gotgenes/pi-subagents": "^17.0.0"
  },
  "peerDependencies": {
    "@earendil-works/pi-ai": "*",
    "@earendil-works/pi-coding-agent": "*",
    "typebox": "*"
  },
  "engines": {
    "node": ">=22.12.0"
  },
  "pi": {
    "extensions": ["./dist/extension.mjs"],
    "prompts": ["./prompts"],
    "skills": ["./skills"]
  }
}
```

### 2.1 Why These Choices (Annotated With Implementation Truth)

- **No `pi-package` keyword** — optional for discovery; the package installs
  fine without it. Plan anticipated using it; implementation omitted it.
- **`peerDependencies` with `"*"`** — Pi core packages
  (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`,
  `typebox`) are bundled by Pi. We do not bundle them. Per the Pi
  packages docs: "Pi bundles core packages for extensions and skills.
  If you import any of these, list them in `peerDependencies` with a
  `"*"` range and do not bundle them."
  Source: [packages.md:165-186](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).
- **`devDependencies`** — simpler than planned. Pi core packages
  are NOT in devDeps (the Rolldown bundle via `vp pack` resolves them
  externally at runtime). Only `@types/node`, `typescript`, and `vitest`
  are needed for type checking and tests.
- **`dependencies`** — v1 has one third-party runtime dep:
  `@gotgenes/pi-subagents@^17.0.0` for subagent dispatch
  (MIT license, in-process model). See ADR-015 for the ecosystem
  survey and selection rationale. Version confirmed working: `17.2.0`
  with `@earendil-works/pi-coding-agent@0.79.9`.
- **`files` array** — includes `rules/` (diverges from plan). The plan said
  rules should be excluded because they're bundled into `rules-content.ts`,
  but Pi's package loader resolves `rules/` from the package directory at
  runtime. Including `rules/` in the files array ensures they're present in
  the npm tarball for reference. `CHANGELOG.md` is NOT in the array (the
  changelog lives in the git repo; publishing it is unnecessary).
- **Build: `vp pack`** — uses Rolldown (via Vite+) to produce a single
  `dist/extension.mjs` bundle (not `tsc` with multiple output files).
  See [vite.config.ts](../../packages/pi/vite.config.ts) for the config.
  The bundled approach avoids module resolution issues that `tsc` would
  have with Pi's jiti loader and external peer dependencies.
- **No `main`/`types`/`exports`** — the bundle is a single `.mjs` file.
  Pi's `pi.extensions` manifest points directly to it. No need for
  package entry points.
- **`engines.node >= 22.12.0`** — based on the actual Node.js features
  used (not Pi's minimum). Pi runs on >= 22.12.0 as well.
- **`publishConfig.provenance`** — not set (plan said `true`).
  Deferred to a future release when npm provenance build infrastructure
  is in place in the monorepo. The package is published with standard
  `access: public` only.

## 3. `tsconfig.json` (as implemented)

> **Note:** The actual `tsconfig.json` has `noEmit: true` because `vp pack`
> (Rolldown) handles compilation. `tsc` is used for type checking only.
> The planned `outDir`/`rootDir`/`declaration` options are unnecessary.

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "tests"],
  "exclude": ["dist", "node_modules"]
}
```

Uses `noEmit: true` — compilation is handled by `vp pack` (Rolldown).
TypeScript is for type-checking only. See ADR-011 in
[`05-architecture-decisions.md`](./05-architecture-decisions.md#adr-011-build-tool-choice-tsc-vs-tsdown-vs-unbuild-vs-no-build)
for the divergence rationale.

## 4. File-by-File Purpose

### 4.1 `src/extension.ts` — Main Entry Point

The default export. Wires up all event handlers, registers the
subagent tool, and registers the commands. Imports from the
other modules in `src/`.

```typescript
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { MAESTRIA_RULES_CONTENT } from './rules-content.js';
import { installRulesInjection } from './rules.js';
import { installCompactionHandlers } from './compaction.js';
import { installSubagentTool } from './subagent.js';
import { installCommands } from './commands.js';
import { installToolInterceptors } from './tools.js';

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
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export function installRulesInjection(pi: ExtensionAPI, rulesContent: string): void {
  pi.on('before_agent_start', async (event) => {
    return {
      systemPrompt: event.systemPrompt + '\n\n## Maestria Global Rules\n\n' + rulesContent,
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
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { getMaestriaState, renderMaestriaSummary } from './state.js';

export function installCompactionHandlers(pi: ExtensionAPI): void {
  pi.on('session_before_compact', async (event) => {
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

  pi.on('session_before_tree', async (event) => {
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
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

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
    activeTask: '',
    completionPromise: '',
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
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { getSubagentsService } from '@gotgenes/pi-subagents';
import { recordHandoff } from './state.js';

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;

// Validates the 6-field handoff contract.
// Returns { valid: true } or { valid: false, errors: string[] }.
function validateHandoff(handoff: string): { valid: boolean; errors: string[] } {
  const requiredFields = [
    'Goal',
    'Context',
    'Requirements',
    'Known problems',
    'Success criteria',
    'Next step',
  ];
  const errors: string[] = [];
  for (const field of requiredFields) {
    // Check field is present with non-empty content
    const re = new RegExp(`^${field}:\\s*(.+)$`, 'm');
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
    name: 'subagent',
    label: 'Subagent',
    description: [
      'Delegate tasks to specialized subagents with isolated context.',
      'Available agents: adventurer, architect, builder, diagnose, planner, reviewer, writer.',
      'Modes: single (agent + task), parallel (tasks array, max 8), chain (sequential with {previous} placeholder).',
      'Each subagent runs in-process with its own context via @gotgenes/pi-subagents.',
      'The handoff contract (Goal, Context, Requirements, Known Problems, Success Criteria, Next Step) is validated before dispatch.',
    ].join(' '),
    parameters: Type.Object({
      agent: Type.Optional(Type.String({ description: 'Name of the agent (single mode)' })),
      task: Type.Optional(Type.String({ description: 'Task to delegate (single mode)' })),
      // ... parallel and chain parameters (same shape as before) ...
    }),

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      // Validate handoff contract before dispatch
      const handoff = params.task ?? '';
      const validation = validateHandoff(handoff);
      if (!validation.valid) {
        return {
          content: [
            {
              type: 'text',
              text: `Handoff contract validation failed:\n- ${validation.errors.join('\n- ')}`,
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

      recordHandoff('orchestrator', params.agent, handoff);
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
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export function installCommands(pi: ExtensionAPI): void {
  pi.registerCommand('orchestrate', {
    description: 'Run the full maestria pipeline on a goal',
    handler: async (args, ctx) => {
      // Send a user message that triggers the orchestrator template + subagent chain
      ctx.sendUserMessage(
        `Run the maestria default pipeline on: ${args}\n\n` +
          `Follow the orchestrator prompt template. Use the subagent tool to delegate.`,
      );
    },
  });

  pi.registerCommand('review', {
    description: 'Switch to a fresh model and run the reviewer methodology',
    handler: async (args, ctx) => {
      // See src/commands.ts for the model-cycling implementation
    },
  });

  pi.registerCommand('handoff', {
    description: 'Generate a handoff prompt to a new session',
    handler: async (args, ctx) => {
      // Delegates to the handoff skill (see skills/handoff/SKILL.md)
    },
  });

  pi.registerCommand('maestria-status', {
    description: 'Show current Maestria state (task, blockers, review mode)',
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

### 4.7 `src/modes.ts` — Workflow Mode Commands (Added During Implementation)

> **Note:** This module was not in the original plan. It was added during
> Phase 1/5 implementation to support the workflow mode keywords (`fein`,
> `sonar`, `blitz`) from the opencode orchestrator rules.

Exports `installModeCommands(pi, state)`. Registers `/fein`, `/sonar`,
`/blitz` commands that set a workflow mode in the session state and (when
a goal is provided) dispatch a mode-prefixed user message.

Each mode has a structured prompt (full pipeline, research only, fast
implementation) that is injected via `before_agent_start` when the mode
is active. The mode state survives compaction via `MaestriaState.mode`.

```typescript
export function installModeCommands(pi: ExtensionAPI, state: MaestriaState): void {
  for (const keyword of MODE_KEYWORDS) {
    pi.registerCommand(keyword, {
      description: `Set workflow mode to ${keyword}`,
      handler: async (args, ctx) => {
        state.mode = keyword;
        if (args.trim()) {
          // Send mode prompt + goal
        } else {
          ctx.ui.notify(`Mode set to ${keyword}.`);
        }
      },
    });
  }
}
```

Key details:

- Modes are additive to the system prompt: when a mode is active,
  `rules.ts` prepends the mode prompt after the global rules.
- `fein` = full pipeline (adventurer → architect/planner → builder → reviewer)
- `sonar` = research only (adventurer → architect/planner → STOP)
- `blitz` = fast implementation (builder directly, skip recon/review)
- The mode is cleared by setting to `null` or by starting a new session.

### 4.8 `src/tools.ts` — Tool-Call Interceptors

A single module for tool-call interception. Contains:

1. **`DANGEROUS_PATTERNS`** — Inlined from Pi's `permission-gate.ts`
   example. A `const` array of `RegExp` patterns matching destructive
   commands (`rm -rf`, `dd if=`, `> /dev/sda`, `chmod -R 777 /`). When
   a bash tool call matches, it is blocked with a confirmation prompt
   (or returned as an error when there's no UI for confirmation).

2. **Review-mode interceptor** — Unique maestria methodology. When
   `state.reviewMode` is active, blocks `edit`, `write`, and
   destructive `bash` tool calls for the reviewer specialist. Uses
   `tool_call` event with `{ block: true, reason }`.

```typescript
import { isToolCallEventType, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { getMaestriaState } from './state.js';

// Patterns matching destructive bash commands, inlined from
// Pi's canonical permission-gate.ts example.
const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+(-rf?|--recursive)\b/i,
  /\bdd\s+if=/i,
  />\s+\/dev\/sd[a-z]/i,
  /\bchmod\s+-R\s+777\s+\//i,
];

export function installToolInterceptors(pi: ExtensionAPI): void {
  pi.on('tool_call', async (event, ctx) => {
    const state = getMaestriaState();

    // Review mode: block edits, writes, and ALL bash
    if (state.reviewMode) {
      if (
        isToolCallEventType('edit', event) ||
        isToolCallEventType('write', event) ||
        isToolCallEventType('bash', event)
      ) {
        return {
          block: true,
          reason: 'Review mode is active. Report findings, do not edit.',
        };
      }
    }

    // Always: block dangerous patterns
    if (isToolCallEventType('bash', event)) {
      const command = event.input.command as string;
      if (DANGEROUS_PATTERNS.some((p) => p.test(command))) {
        if (!ctx.hasUI) {
          return { block: true, reason: 'Dangerous command (no UI for confirmation)' };
        }
        const ok = await ctx.ui.confirm('Dangerous command', `Allow?\n\n  ${command}`);
        if (!ok) {
          return { block: true, reason: 'Blocked by user' };
        }
      }
    }
  });
}
```

Previously these were split across `src/safety.ts` and `src/tools.ts`.
Consolidated after ecosystem audit (see ADR-015): the safety patterns
are identical to Pi's canonical `permission-gate.ts` example and do not
warrant a separate module.

**Optional:** Users who want configurable policy enforcement
(allow/ask/deny permissions) can add
`@gotgenes/pi-permission-system` as a peer dependency.

The dangerous-pattern block is always active. The review-mode
block only activates after `/review` is invoked.

### 4.9 `rules/AGENTS.md` — Source of Global Rules

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

### 4.10 `prompts/*.md` — The 8 Specialist Templates

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

### 4.11 `skills/handoff/SKILL.md` — Handoff Contract Skill

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

### 4.12 `skills/iteration-limits/SKILL.md` — Iteration Limits

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

### 4.13 `tests/` — Unit Tests

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

## 5. The `pi` Manifest Entry (As Implemented)

> **Note:** The actual manifest points to `./dist/extension.mjs` (bundled),
> not `./dist/extension.js` (compiled). Also note no `rules` directory is
> in the manifest — Pi auto-discovers prompts and skills from directories,
> but extensions must be explicitly listed.

The `pi` key in `package.json`:

```json
"pi": {
  "extensions": ["./dist/extension.mjs"],
  "prompts": ["./prompts"],
  "skills": ["./skills"]
}
```

- `./dist/extension.mjs` — the single bundled extension entry point.
  All logic is wired through this file. Rolldown produces a
  self-contained `.mjs` that Pi's dynamic import can consume directly.
- `./prompts` — directory containing the 8 specialist templates.
  Pi auto-discovers `*.md` files (non-recursive).
- `./skills` — directory containing the 2 skill directories.
  Pi auto-discovers `SKILL.md` recursively.

We use `.mjs` (not `.ts`) because:

1. **Faster load** — pre-compiled bundle avoids jiti compilation.
2. **No tsconfig assumptions** — users don't need to match our TS config.
3. **Simpler module resolution** — `vp pack` externalizes peer deps but
   bundles everything else; no import-map or path-mapping needed at runtime.

Source: [packages.md:115-148](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)

## 6. The `files` Array for npm Publish (As Implemented)

> **Note:** The actual files array includes `rules/` and excludes
> `CHANGELOG.md`. The plan's rationale for excluding `rules/` was that
> rules content is bundled into `rules-content.ts` at build time. However,
> Pi's package loader resolves `rules/` from the package directory for
> reference; including them in the tarball costs ~4KB and enables users
> to inspect the rules source without unpacking the bundle. `CHANGELOG.md`
> was omitted to keep the published package minimal — the changelog lives
> in the git repository.

```json
"files": [
  "dist",
  "prompts",
  "rules",
  "skills",
  "README.md",
  "LICENSE"
]
```

- `dist` — the bundled `extension.mjs` + sourcemap
- `prompts` — the specialist templates
- `rules` — the AGENTS.md source (included for reference)
- `skills` — the methodology skills
- `README.md`, `LICENSE` — package metadata

`src/`, `tests/`, `tsconfig.json` are excluded (dev-only).
`CHANGELOG.md` is excluded (lives in git repo only).

The `LICENSE` is a copy of the root [MIT LICENSE](../../LICENSE).

## 7. Build Strategy

### 7.1 The Build Command (As Implemented)

> **Note:** The actual build uses `vp pack` (Rolldown), not `tsc`.
> The prebuild step (rules-content generation) is identical.

```bash
npm run build    # runs: node --experimental-strip-types scripts/build-rules.ts && vp pack
```

This runs:

1. `node --experimental-strip-types scripts/build-rules.ts` (via
   `prebuild` script) — reads `rules/AGENTS.md`, writes
   `src/rules-content.ts`. Node 22+ runs TypeScript directly with
   `--experimental-strip-types`, no separate compile step.
2. `vp pack` — Rolldown bundles `src/extension.ts` and all its
   imports into a single `dist/extension.mjs` with sourcemap.
   Peer dependencies (`@earendil-works/pi-*`, `typebox`) are
   marked as external in `vite.config.ts`.

### 7.2 Why Vinalla `vp pack` Instead of `tsc`?

The plan specified `tsc` for consistency with `@maestria/opencode`.
The implementation uses `vp pack` for these practical reasons:

1. **Single file output.** Pi loads one extension entry point.
   A bundle is simpler than 7+ separate `.js` files + `.d.ts` pairs.
2. **Module resolution.** `tsc` output would need Pi's jiti loader
   to resolve all imports, including external peer deps. The Rolldown
   bundle marks peer deps as external and inlines everything else,
   avoiding module resolution edge cases.
3. **`.mjs` support.** Pi's dynamic import works natively with `.mjs`.
   No ESM/CJS interop issues.
4. **Size.** The single-file bundle is ~35KB minified, smaller than
   the multi-file `tsc` output would be.
5. **Faster builds.** Rolldown is ~10x faster than `tsc` for this
   project size.

The trade-off: no `.d.ts` files. Type checking is done via
`tsc --noEmit` at dev time. See ADR-011 in
[`05-architecture-decisions.md`](./05-architecture-decisions.md#adr-011-build-tool-choice-tsc-vs-tsdown-vs-unbuild-vs-no-build).

### 7.3 Build Output (As Implemented)

> **Note:** The actual build output is a single bundled `.mjs` file, not
> multiple `.js`/`.d.ts` pairs. `vp pack` (Rolldown) produces a single
> `dist/extension.mjs` with inline sourcemap (`extension.mjs.map`). Total
> size is ~35KB minified, ~70KB with sourcemap.

The `dist/` directory contains:

- `extension.mjs` — the bundled extension (all 9 source files + rules-content)
- `extension.mjs.map` — sourcemap for debugging

No `.d.ts` files are produced (the bundled format doesn't need them; type
checking is done via `tsc --noEmit` at dev time). The tarball is ~30KB
compressed, well under 100KB.

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
ls -la dist/extension.mjs
test -f dist/extension.mjs && echo "OK"

# Verify pi manifest
node -e "const p = require('./package.json'); console.log(p.pi);"

# Verify files array
node -e "const p = require('./package.json'); console.log(p.files);"
```

The end-to-end verification (does the extension actually load in
Pi?) requires running Pi and invoking the commands. This is done
in Phase 1 of the implementation, see
[`04-implementation-phases.md`](./04-implementation-phases.md#phase-1-skeleton--install).

## 11. Summary (As Implemented)

The package is:

- **9 TypeScript source files** in `src/` (extension, rules, rules-content,
  compaction, state, subagent, commands, tools, **modes**)
- **8 prompt templates** in `prompts/` (orchestrator + 7 specialists)
- **2 skills** in `skills/` (handoff, iteration-limits)
- **7 test files** in `tests/` (vitest) — added modes.test.ts
- **1 `package.json`** with the `pi` manifest, peer deps, and `files` array
- **1 `tsconfig.json`** with `noEmit: true` (type-checking only)
- **1 `vite.config.ts`** for Vite+ pack/test tasks
- **Build with `vp pack`** (Rolldown), not `tsc` — produces `dist/extension.mjs`
- **No postinstall, no file-system side effects** beyond the package directory
- **Tool named `maestria_subagent`** (not `subagent`) to avoid collision with
  `@gotgenes/pi-subagents`

The implementation took ~9 working days as estimated. See
[`04-implementation-phases.md`](./04-implementation-phases.md) for
the phase completion status.

## Date

2026-06-18

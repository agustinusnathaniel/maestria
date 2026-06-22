# 07. References

> **Note:** This document was updated post-implementation to include
> references to the actual source files and community extensions
> examined. New sections are marked with 🆕.

This document lists every source cited in this plan. It is the
audit trail for the claims made about Pi, the maestria
methodology, and the existing `@maestria/opencode` package.

## 1. Pi Documentation

The official Pi docs. Four pages are most relevant to
`@maestria/pi`:

| Page                | URL                                                                                           | Cited in                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pi Packages         | https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md         | `01-assessment.md` §3; `03-package-design.md` §2, §5, §8; `05-architecture-decisions.md` ADR-010                                                   |
| Pi Extensions       | https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md       | `01-assessment.md` §1.2, §2; `02-integration-strategy.md` §3, §5; `03-package-design.md` §4.1–4.7; `05-architecture-decisions.md` ADR-009, ADR-012 |
| Pi Prompt Templates | https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/prompt-templates.md | `01-assessment.md` §5; `03-package-design.md` §4.9; `05-architecture-decisions.md` ADR-014                                                         |
| Pi Skills           | https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md           | `01-assessment.md` §4; `03-package-design.md` §4.10, §4.11                                                                                         |
| Pi Themes           | https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/themes.md           | `01-assessment.md` §1.1; `06-risks-and-open-questions.md` O-02                                                                                     |
| Pi Compaction       | https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/compaction.md       | `01-assessment.md` §6; `02-integration-strategy.md` §6, §7; `05-architecture-decisions.md` ADR-013                                                 |

Other Pi docs that informed this plan but aren't cited
extensively:

- [Pi Quickstart](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/quickstart.md)
- [Pi Usage](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/usage.md)
- [Pi Sessions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sessions.md)
- [Pi RPC](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md)
- [Pi SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)
- [Pi Keybindings](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/keybindings.md)
- [Pi Settings](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/settings.md)

## 2. Pi Source Repository

The Pi source is at
[github.com/earendil-works/pi](https://github.com/earendil-works/pi).
The opensrc cache at
`~/.opensrc/repos/github.com/earendil-works/pi/main/` has
a local clone at v0.79.6 (the current latest).

### 2.1 Key Source Files

| File                                             | Path in opensrc cache                                                                               | Used in                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/coding-agent/package.json`             | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/package.json`             | Version pinning (`@earendil-works/pi-coding-agent@0.79.6`) |
| `packages/coding-agent/docs/extensions.md`       | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/docs/extensions.md`       | Event API, ExtensionContext, ExtensionAPI methods          |
| `packages/coding-agent/docs/packages.md`         | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/docs/packages.md`         | Package manifest format, dependency rules, install flow    |
| `packages/coding-agent/docs/skills.md`           | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/docs/skills.md`           | Agent Skills spec, frontmatter, locations                  |
| `packages/coding-agent/docs/prompt-templates.md` | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/docs/prompt-templates.md` | Argument syntax, loading rules                             |
| `packages/coding-agent/docs/compaction.md`       | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/docs/compaction.md`       | Compaction event API, CompactionEntry structure            |
| `packages/coding-agent/docs/themes.md`           | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/docs/themes.md`           | Theme JSON schema (not adopted in v1)                      |

### 2.2 Example Extensions We Studied

The Pi repository has 75+ example extensions in
`packages/coding-agent/examples/extensions/`. The ones
most relevant to `@maestria/pi`:

| Extension                       | Path                                                                                                                         | Relevance                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `subagent/`                     | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/subagent/index.ts`             | The subagent delegation pattern. Our `subagent` tool is adapted from this. 1,009 lines.                               |
| `subagent/README.md`            | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/subagent/README.md`            | Subagent architecture, security model, tool modes                                                                     |
| `subagent/agents/scout.md`      | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/subagent/agents/scout.md`      | Sample specialist agent format. Our `prompts/adventurer.md` follows the same structure.                               |
| `subagent/prompts/implement.md` | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/subagent/prompts/implement.md` | Sample workflow prompt template. Our `prompts/orchestrator.md` follows the same approach.                             |
| `claude-rules.ts`               | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/claude-rules.ts`               | Pattern for injecting rules into the system prompt. Our `src/rules.ts` is simpler but inspired by this.               |
| `custom-compaction.ts`          | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/custom-compaction.ts`          | Custom compaction with model switching. Pattern reference for our `src/compaction.ts`.                                |
| `permission-gate.ts`            | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/permission-gate.ts`            | `tool_call` event with `block: true` and user confirmation. Our `src/tools.ts` extends this.                          |
| `handoff.ts`                    | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/handoff.ts`                    | `/handoff` command that creates a new session with a generated prompt. Our `src/commands.ts` `/handoff` extends this. |
| `send-user-message.ts`          | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/send-user-message.ts`          | `pi.sendUserMessage` and `pi.sendMessage` patterns.                                                                   |
| `system-prompt-header.ts`       | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/system-prompt-header.ts`       | `ctx.getSystemPrompt()` access pattern.                                                                               |
| `tools.ts`                      | `~/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/tools.ts`                      | `pi.setActiveTools()` for tool-set restriction. The mechanism for the maker/checker split.                            |

Other example extensions reviewed for general patterns but
not directly cited:

- `auto-commit-on-exit.ts`, `bash-spawn-hook.ts`, `bookmark.ts`
- `command-spawn.ts`, `confirm-destructive.ts`, `custom-footer.ts`
- `custom-header.ts`, `dirty-repo-guard.ts`, `dynamic-resources/`
- `dynamic-tools.ts`, `event-bus.ts`, `file-trigger.ts`
- `git-checkpoint.ts`, `git-merge-and-resolve.ts`, `github-issue-autocomplete.ts`
- `hello.ts`, `hidden-thinking-label.ts`, `inline-bash.ts`
- `input-transform.ts`, `input-transform-streaming.ts`, `interactive-shell.ts`
- `mac-system-theme.ts`, `message-renderer.ts`, `minimal-mode.ts`
- `modal-editor.ts`, `model-status.ts`, `notify.ts`
- `overlay-qa-tests.ts`, `overlay-test.ts`, `pirate.ts`
- `plan-mode/`, `preset.ts`, `project-trust.ts`
- `prompt-customizer.ts`, `protected-paths.ts`, `provider-payload.ts`
- `qna.ts`, `question.ts`, `questionnaire.ts`
- `rainbow-editor.ts`, `reload-runtime.ts`, `rpc-demo.ts`
- `sandbox/`, `session-name.ts`, `shutdown-command.ts`
- `snake.ts`, `space-invaders.ts`, `ssh.ts`
- `status-line.ts`, `structured-output.ts`, `summarize.ts`
- `tic-tac-toe.ts`, `timed-confirm.ts`, `titlebar-spinner.ts`
- `todo.ts`, `tool-override.ts`, `truncated-tool.ts`
- `trigger-compact.ts`, `widget-placement.ts`, `with-deps/`
- `working-indicator.ts`, `working-message-test.ts`

## 3. Maestria Documentation

| File               | Path                                     | Cited in                                                                                   |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `VISION.md`        | [`../../VISION.md`](../../VISION.md)     | Plan motivation, package table, goals/non-goals                                            |
| `PATTERNS.md`      | [`../../PATTERNS.md`](../../PATTERNS.md) | Pipeline Composition, Maker/Checker Split, handoff contract fields, iteration limit format |
| `README.md` (root) | [`../../README.md`](../../README.md)     | Monorepo overview                                                                          |
| `AGENTS.md` (root) | [`../../AGENTS.md`](../../AGENTS.md)     | Monorepo conventions, Vite+ usage                                                          |

## 4. Existing Maestria ADRs

ADRs in `docs/adr/` that are referenced throughout this
plan:

| ADR     | File                                                                                               | Relevance to `@maestria/pi`                                                                           |
| ------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ADR-001 | [`../adr/ADR-001-global-rules-scope.md`](../adr/ADR-001-global-rules-scope.md)                     | What belongs in `rules/AGENTS.md`; same filter applies to the Pi package                              |
| ADR-002 | [`../adr/ADR-002-plugin-architecture.md`](../adr/ADR-002-plugin-architecture.md)                   | The pure-plugin philosophy. This plan extends the same philosophy to Pi.                              |
| ADR-003 | [`../adr/ADR-003-agent-conventions.md`](../adr/ADR-003-agent-conventions.md)                       | `!!!` markers, agent cross-references, skill pattern, conventional comments. All carried over to Pi.  |
| ADR-004 | [`../adr/ADR-004-agent-prompt-template.md`](../adr/ADR-004-agent-prompt-template.md)               | 4-bucket skills, 5-section handoff, iteration limits, rules bullets. Applied to Pi prompt templates.  |
| ADR-005 | [`../adr/ADR-005-skill-install-flow.md`](../adr/ADR-005-skill-install-flow.md)                     | Skill install flow. The Pi equivalent uses `pi` manifest, not npx.                                    |
| ADR-006 | [`../adr/ADR-006-tool-permission-design.md`](../adr/ADR-006-tool-permission-design.md)             | Permissions-permissive, policy-in-directives principle. Carried over to Pi's `tool_call` interceptor. |
| ADR-007 | [`../adr/ADR-007-opensrc-vs-webfetch-guidance.md`](../adr/ADR-007-opensrc-vs-webfetch-guidance.md) | External repo access guidance. Same guidance applies to Pi agents.                                    |

## 5. `@maestria/opencode` Reference Files

Files in the opencode package that this plan references:

| File                     | Path                                                                                               | Relevance                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `package.json`           | [`../../packages/opencode/package.json`](../../packages/opencode/package.json)                     | Package structure, files array, scripts. We mirror these.                  |
| `src/index.ts`           | [`../../packages/opencode/src/index.ts`](../../packages/opencode/src/index.ts)                     | The opencode plugin. Our `src/extension.ts` is the Pi analog.              |
| `rules/AGENTS.md`        | [`../../packages/opencode/rules/AGENTS.md`](../../packages/opencode/rules/AGENTS.md)               | The source rules content. Copied to `packages/pi/rules/AGENTS.md`.         |
| `tsconfig.json`          | [`../../packages/opencode/tsconfig.json`](../../packages/opencode/tsconfig.json)                   | The TypeScript config. We use the same.                                    |
| `agents/orchestrator.md` | [`../../packages/opencode/agents/orchestrator.md`](../../packages/opencode/agents/orchestrator.md) | The orchestrator prompt. Adapted to `packages/pi/prompts/orchestrator.md`. |
| `agents/adventurer.md`   | [`../../packages/opencode/agents/adventurer.md`](../../packages/opencode/agents/adventurer.md)     | The adventurer prompt. Adapted to `packages/pi/prompts/adventurer.md`.     |
| `agents/architect.md`    | [`../../packages/opencode/agents/architect.md`](../../packages/opencode/agents/architect.md)       | Architect prompt.                                                          |
| `agents/builder.md`      | [`../../packages/opencode/agents/builder.md`](../../packages/opencode/agents/builder.md)           | Builder prompt.                                                            |
| `agents/diagnose.md`     | [`../../packages/opencode/agents/diagnose.md`](../../packages/opencode/agents/diagnose.md)         | Diagnose prompt.                                                           |
| `agents/planner.md`      | [`../../packages/opencode/agents/planner.md`](../../packages/opencode/agents/planner.md)           | Planner prompt.                                                            |
| `agents/reviewer.md`     | [`../../packages/opencode/agents/reviewer.md`](../../packages/opencode/agents/reviewer.md)         | Reviewer prompt.                                                           |
| `agents/writer.md`       | [`../../packages/opencode/agents/writer.md`](../../packages/opencode/agents/writer.md)             | Writer prompt.                                                             |
| `CHANGELOG.md`           | [`../../packages/opencode/CHANGELOG.md`](../../packages/opencode/CHANGELOG.md)                     | The CHANGELOG format. We mirror for v0.1.0.                                |
| `README.md`              | [`../../packages/opencode/README.md`](../../packages/opencode/README.md)                           | The README structure. We mirror for `@maestria/pi`.                        |

## 6. Agent Skills Specification

Pi implements the [Agent Skills standard](https://agentskills.io/specification).
The relevant pages:

- [Specification](https://agentskills.io/specification) — the
  format Pi validates against
- [Integrate skills](https://agentskills.io/integrate-skills) —
  the XML format Pi uses in the system prompt

## 7. Tools and Monorepo Configuration

| File                   | Path                                                     | Relevance                                     |
| ---------------------- | -------------------------------------------------------- | --------------------------------------------- |
| Root `package.json`    | [`../../package.json`](../../package.json)               | Monorepo root, `engines.node`, packageManager |
| `pnpm-workspace.yaml`  | [`../../pnpm-workspace.yaml`](../../pnpm-workspace.yaml) | Catalog dependencies, package manager version |
| `vite.config.ts`       | [`../../vite.config.ts`](../../vite.config.ts)           | Vite+ tasks, lint config                      |
| `tsconfig.json` (root) | [`../../tsconfig.json`](../../tsconfig.json)             | Root TypeScript config                        |
| `.changeset/`          | [`../../.changeset/`](../../.changeset)                  | Changeset workflow for versioning             |
| `LICENSE`              | [`../../LICENSE`](../../LICENSE)                         | MIT license, copied to `packages/pi/LICENSE`  |

## 8. Specific Lines Cited in This Plan

For convenience, the most important line-level citations
are reproduced here:

### 8.1 Pi Dependency Rules (packages.md:165-186)

> Third party runtime dependencies belong in `dependencies`
> in `package.json`. Dependencies that do not register
> extensions, skills, prompt templates, or themes also
> belong in `dependencies`. When pi installs a package from
> npm or git, it runs `npm install`, so those dependencies
> are installed automatically.
>
> Pi bundles core packages for extensions and skills. If
> you import any of these, list them in `peerDependencies`
> with a `"*"` range and do not bundle them:
> `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`,
> `@earendil-works/pi-coding-agent`,
> `@earendil-works/pi-tui`, `typebox`.
>
> Other pi packages must be bundled in your tarball. Add
> them to `dependencies` and `bundledDependencies`, then
> reference their resources through `node_modules/` paths.
> Pi loads packages with separate module roots, so
> separate installs do not collide or share modules.

### 8.2 Pi jiti Loader (extensions.md:178)

> Extensions are loaded via jiti, so TypeScript works
> without compilation.

### 8.3 Pi Security Warning (extensions.md:110)

> **Security:** Extensions run with your full system
> permissions and can execute arbitrary code. Only install
> from sources you trust.

### 8.4 Pi `before_agent_start` Event (extensions.md:494-528)

> Fired after user submits prompt, before agent loop. Can
> inject a message and/or modify the system prompt.

### 8.5 Pi `tool_call` Event (extensions.md:700-740)

> Fired after `tool_execution_start`, before the tool
> executes. **Can block.** Use `isToolCallEventType` to
> narrow and get typed inputs.

### 8.6 Pi Prompt Template Argument Syntax (prompt-templates.md:67-74)

> Templates support positional arguments, defaults, and
> simple slicing:
>
> - `$1`, `$2`, ... positional args
> - `$@` or `$ARGUMENTS` for all args joined
> - `${1:-default}` uses arg 1 when present/non-empty,
>   otherwise `default`
> - `${@:N}` for args from the Nth position (1-indexed)
> - `${@:N:L}` for `L` args starting at N

### 8.7 Pi Skills Frontmatter (skills.md:139-150)

> Per the [Agent Skills specification](https://agentskills.io/specification#frontmatter-required):
>
> | Field                      | Required | Description                                                                    |
> | -------------------------- | -------- | ------------------------------------------------------------------------------ |
> | `name`                     | Yes      | Max 64 chars. Lowercase a-z, 0-9, hyphens. ...                                 |
> | `description`              | Yes      | Max 1024 chars. What the skill does and when to use it.                        |
> | `license`                  | No       | License name or reference to bundled file.                                     |
> | `compatibility`            | No       | Max 500 chars. Environment requirements.                                       |
> | `metadata`                 | No       | Arbitrary key-value mapping.                                                   |
> | `allowed-tools`            | No       | Space-delimited list of pre-approved tools (experimental).                     |
> | `disable-model-invocation` | No       | When `true`, skill is hidden from system prompt. Users must use `/skill:name`. |

### 8.8 Maestria PATTERNS.md (Handoff Contract)

> The contract has six fields:
>
> | Field                | Purpose                                                         |
> | -------------------- | --------------------------------------------------------------- |
> | **Goal**             | What to achieve and why it matters                              |
> | **Context**          | Relevant paths, constraints, prior decisions, what's been tried |
> | **Requirements**     | Specific expectations and boundaries                            |
> | **Known problems**   | Issues already identified, things to watch for                  |
> | **Success criteria** | How to verify the work is done (the completions promise)        |
> | **Next step**        | What happens after this task completes                          |

Source: [`../../PATTERNS.md` §"Handoff Contract"](../../PATTERNS.md)

### 8.9 OpenCode Compaction Hook (src/index.ts:179-185)

```typescript
"experimental.session.compacting": async (_input, output) => {
  output.context.push(
    "Session was compacted. Task tracking is maintained via todowrite. " +
      "Active context (files, decisions, blockers) was captured before compaction. " +
      "Continue where you left off.",
  );
},
```

Source: [`../../packages/opencode/src/index.ts`](../../packages/opencode/src/index.ts)

### 8.10 OpenCode Reviewer Frontmatter (agents/reviewer.md:1-19)

```yaml
---
description: Code review with quality gates.
  Reviews code for correctness, edge cases, security, performance, maintainability,
  and adherence to conventions. Provides specific, actionable feedback.
  Use for: PR review, pre-commit review, architecture document review.
mode: subagent
permission:
  read: allow
  glob: allow
  grep: allow
  lsp: allow
  skill: allow
  edit: deny
  bash:
    "*": ask
    "git status*": allow
    "git diff*": allow
    "git log*": allow
  webfetch: allow
---
```

The `edit: deny` here is the OpenCode mechanism we
replicate on Pi via subprocess `--tools` + `tool_call`
interception + prompt discipline.

## 9. How to Verify Citations

To verify a citation in this plan:

1. **Pi docs** — the opensrc cache at
   `~/.opensrc/repos/github.com/earendil-works/pi/main/`
   has a local clone of the docs. Read directly.
2. **Pi source** — same cache, `packages/coding-agent/src/`
   for the implementation. The `examples/extensions/`
   directory has the example extensions.
3. **Maestria files** — the monorepo at the path given in
   the citation.
4. **External URLs** — the URL given in the citation.

If a citation is unclear, find the matching section in
the relevant document and verify the quote.

## 🆕 10. Actual Source Files (Post-Implementation)

The following source files in [`packages/pi/`](../../packages/pi/)
represent the actual implementation. These supersede the plan's
design documents.

### 10.1 TypeScript Source Files

| File                                                             | Purpose                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`src/extension.ts`](../../packages/pi/src/extension.ts)         | Main entry point — wires event handlers, tools, commands            |
| [`src/state.ts`](../../packages/pi/src/state.ts)                 | `MaestriaState` interface, CRUD helpers, summary renderer           |
| [`src/rules.ts`](../../packages/pi/src/rules.ts)                 | `before_agent_start` handler — injects global rules + mode prompts  |
| [`src/rules-content.ts`](../../packages/pi/src/rules-content.ts) | Generated — bundles `rules/AGENTS.md` as a string constant          |
| [`src/compaction.ts`](../../packages/pi/src/compaction.ts)       | `session_before_compact` and `session_before_tree` handlers         |
| [`src/subagent.ts`](../../packages/pi/src/subagent.ts)           | `maestria_subagent` tool registration + handoff validation          |
| [`src/commands.ts`](../../packages/pi/src/commands.ts)           | `/orchestrate`, `/review`, `/maestria-status` commands              |
| [`src/tools.ts`](../../packages/pi/src/tools.ts)                 | `tool_call` interceptor — review mode blocking + dangerous patterns |
| [`src/modes.ts`](../../packages/pi/src/modes.ts)                 | `/fein`, `/sonar`, `/blitz` workflow mode commands                  |

### 10.2 Configuration Files

| File                                                   | Purpose                               |
| ------------------------------------------------------ | ------------------------------------- |
| [`package.json`](../../packages/pi/package.json)       | Package manifest, pi entry, peer deps |
| [`tsconfig.json`](../../packages/pi/tsconfig.json)     | TypeScript config (`noEmit: true`)    |
| [`vite.config.ts`](../../packages/pi/vite.config.ts)   | Vite+ pack/test task config           |
| [`rules/AGENTS.md`](../../packages/pi/rules/AGENTS.md) | Source global rules content           |

### 10.3 Test Files

| File                                                                     | Purpose                                         |
| ------------------------------------------------------------------------ | ----------------------------------------------- |
| [`tests/state.test.ts`](../../packages/pi/tests/state.test.ts)           | State CRUD, handoff trimming, summary rendering |
| [`tests/compaction.test.ts`](../../packages/pi/tests/compaction.test.ts) | Compaction summary structure                    |
| [`tests/tools.test.ts`](../../packages/pi/tests/tools.test.ts)           | Tool-call interceptor logic, dangerous patterns |
| [`tests/subagent.test.ts`](../../packages/pi/tests/subagent.test.ts)     | Handoff validation, agent name checks           |
| [`tests/modes.test.ts`](../../packages/pi/tests/modes.test.ts)           | Mode prompt generation                          |
| [`tests/rules.test.ts`](../../packages/pi/tests/rules.test.ts)           | Rules injection handler behavior                |
| [`tests/skills.test.ts`](../../packages/pi/tests/skills.test.ts)         | Skill frontmatter validation                    |

### 10.4 Community Extensions Examined 🆕

| Package                              | Purpose                         | Reference                             |
| ------------------------------------ | ------------------------------- | ------------------------------------- |
| `@gotgenes/pi-subagents@17.2.0`      | In-process subagent runtime     | `dependencies` in `package.json`      |
| `pi-subagentura`                     | In-process subagent (smaller)   | Considered, not adopted               |
| `pi-crew`                            | Multi-agent orchestration       | Deferred to v1.1                      |
| `@quintinshaw/pi-dynamic-workflows`  | Workflow fan-out                | Deferred to v1.1                      |
| `@juicesharp/rpiv-pi`                | Skill-based dev workflow        | Considered, not adopted               |
| `pi-permission-system` (`@gotgenes`) | Configurable policy enforcement | Referenced in plan as optional add-on |
| `shitty-extensions`                  | Various Pi extension patterns   | Surveyed for patterns                 |
| Pi example extensions (75+)          | Reference implementations       | See §2.2 in this document             |

### 10.5 Pi API Files Inspected via opensrc

The following files in the Pi source repo were directly inspected
during implementation:

- `packages/coding-agent/src/core/extensions/types.ts` — `ExtensionAPI`, `ExtensionContext` types
- `packages/coding-agent/docs/extensions.md` — Event API reference
- `packages/coding-agent/docs/compaction.md` — Compaction event contract
- `packages/coding-agent/examples/extensions/subagent/index.ts` — Subprocess subagent pattern
- `packages/coding-agent/examples/extensions/permission-gate.ts` — Dangerous pattern detection
- `packages/coding-agent/examples/extensions/tools.ts` — `setActiveTools()` pattern
- `packages/coding-agent/examples/extensions/custom-compaction.ts` — Custom compaction with model switching

## 11. Source-of-Truth Hierarchy

When sources conflict, the order of authority is:

1. **Pi source code** (the implementation) — highest
   authority. The docs may lag behind the source.
2. **Pi docs** (the user-facing documentation) — second
   authority.
3. **Pi example extensions** (working code) — third
   authority. They demonstrate intended use.
4. **Maestria VISION.md / PATTERNS.md** — methodology
   truth. Pi source/docs must serve the methodology, not
   the other way around.
5. **Existing maestria ADRs** — already-decided
   architectural choices. New ADRs (this document)
   extend, not contradict.
6. **This plan** — research notes, not authority.

## Date

2026-06-18

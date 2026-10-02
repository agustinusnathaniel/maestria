# ADR-PI-003: Target Pi 1.0 Host Line

## Status

Accepted (2026-10-02), Confidence: High.

## Context

`@maestria/pi` declares `@earendil-works/pi-coding-agent` as a peer dependency. The peer floor sat at `^0.84.1` while upstream published `1.0.0` on 2026-10-01 (prior line `0.99.0`/`0.99.2` on 2026-09-30). Upstream breaking changes between `0.84.2` and `1.0.0` that touch extension authors: provider stream inputs moved from `Context` to `TranscriptContext` (`0.86.0`); `shouldStopAfterTurn` removed in favor of `finishTurn`, `ContextEditEntry` added to the `SessionEntry` union, `ExtensionRunner.emit()` no longer accepts `turn_end`, and `context` handlers no longer see system messages (`0.87.0`); codemode, `tool_search`, and MCP became built-in with new tool APIs (`0.99.0`); fullscreen TUI by default and per-server MCP OAuth credentials (`1.0.0`).

Our adapter surface against the host is narrow, all `[verified]` against the installed `1.0.0` package on 2026-10-02: every host import is a bare root specifier (zero subpath imports); all narrowing over session entries uses `if`/guard shapes with unknown types skipped (no `switch` over `SessionEntry`, so the additive `ContextEditEntry` member is structurally safe); `maestria_subagent` sets only `name`, `label`, `description`, `parameters`, plus `promptGuidelines`/`promptSnippet`; our `before_agent_start` handler reads only `event.systemPrompt` and returns either `{}` or a whole-string `{ systemPrompt }`. The one break found during verification was test-only: the `BeforeAgentStartEvent` fixture in `packages/pi/tests/rules.test.ts` constructed `systemPromptOptions: { cwd: '' }`, while `1.0.0` types the event field as `NormalizedBuildSystemPromptOptions` (all normalized fields required). No file under `packages/pi/src/**` needed any change.

## Decision

1. **Target Pi 1.0.** The peer range for `@earendil-works/pi-coding-agent` in `packages/pi/package.json` moves from `^0.84.1` to `^1.0.0`, and the workspace catalog entry in `pnpm-workspace.yaml` moves from `^0.85.1` to `^1.0.0`. Floor rationale: `1.0.0` is the first published stable major and the exact build our adapter was verified against (typecheck plus unit tests against the real `1.0.0` types; `before_agent_start` swallowing and whole-string return re-verified in the installed `1.0.0` runner source). Pre-1.0 lines carry divergent extension APIs we no longer exercise or assert. Ceiling rationale: caret semantics admit `>=1.0.0 <2.0.0` and exclude the next major, which must be re-verified before support is claimed.
2. **Do NOT adopt codemode.** It addresses a large-tool-surface problem we do not have: our dispatch is a single always-visible tool. `codemode.mode: "only"` would conflict with review-mode tool narrowing via `setActiveTools(READ_ONLY_TOOLS)`, and whether our read-only `tool_call` interceptor still enforces inside QuickJS scripts is unverified, which is a potential bypass of our safety boundary. No codemode prototype ships in this change.
3. **Do NOT use deferred tool loading or `exposure` on `maestria_subagent`.** The tool is needed on every turn that delegates, so deferral buys nothing and adds load-timing complexity.
4. **Defer adopting mid-conversation system-message section patching** (the transcript-backed system prompt and tool updates from `0.86.0`). Our whole-string `before_agent_start` return still works in `1.0.0` (`emitBeforeAgentStart` maps a returned `systemPrompt` onto `forceSystemPrompt`, `[verified]` in installed source), so there is no current need for the section API.

## Consequences

Positive:

- The adapter compiles and passes all 88 package tests against the real `1.0.0` host types, with zero `src` changes.
- The peer range admits the published stable host while the caret ceiling keeps the next major out until it is verified.
- The codemode and section-patching deferrals keep the safety boundary (review-mode narrowing plus the read-only interceptor) on the single mechanism that is verified.

Negative:

- Hosts older than `1.0.0` are no longer in range; users on a pre-1.0 Pi must upgrade the host to use the new package version.
- The codemode bypass question (interceptor enforcement inside QuickJS scripts) stays open and unmeasured.
- The test fixture now spells out the full normalized options shape, so future upstream additions to that type will break the fixture again (a loud, mechanical break, which is the desired behavior for a fixture).

Neutral:

- `pnpm install` records the fresh `@earendil-works/*@1.0.0` entries in `minimumReleaseAgeExclude`; that is installer bookkeeping, not a support claim.

## Alternatives Considered

- **Stay on the 0.8x floor.** Rejected because the published stable line is `1.0.0`, the catalog had already drifted ahead of the lockfile, and every upstream check showed our surface intact on `1.0.0`.
- **Adopt codemode now.** Rejected for the reasons in Decision 2: no large-surface problem to solve, a direct conflict with review-mode narrowing, and an unverified enforcement boundary inside scripts.
- **Adopt section patching now.** Rejected because the whole-string return path we rely on is intact in `1.0.0`; adopting a second injection mechanism would double the surface to verify for no behavior gain.
- **Widen the ceiling beyond the caret (for example `>=1.0.0`).** Rejected because an unbounded range would silently admit an unverified `2.0.0`.

## Assumptions

- `[verified]` `@earendil-works/pi-coding-agent@1.0.0` was published 2026-10-01 and is on npm; the prior line was `0.99.0`/`0.99.2` (2026-09-30).
- `[verified]` All host symbols our adapter imports (`BeforeAgentStartEvent`, `BeforeAgentStartEventResult`, `ExtensionAPI`, `ExtensionContext`, `defineTool`, `AgentToolUpdateCallback`) exist in the installed `1.0.0` package.
- `[inferred]` The 0.86.0 through 1.0.0 breaking-change list in Context is complete for extension authors; it rests on the staged brief plus spot checks of installed `1.0.0` sources, not a full upstream changelog audit.
- `[inferred]` No live-host run was performed (no TTY/global install in this environment), so runtime behavior beyond source inspection plus unit tests is unconfirmed; the live-host probe is recorded as an open verification gap.

## Security Boundaries

The read-only `tool_call` interceptor plus review-mode `setActiveTools` narrowing is our tool-level enforcement. Codemode's QuickJS script execution is outside the verified enforcement path: until interceptor behavior inside scripts is confirmed, codemode stays off so no alternate execution route can bypass review-mode narrowing.

## What Would Change Each Verdict

- **Host target:** a new host major with verified adapter compatibility, or a `1.x` regression that forces a tighter floor; either becomes a new record.
- **Codemode:** our tool surface grows large enough that deferred loading matters, the host documents interceptor enforcement inside scripts, and review-mode narrowing is proven compatible with a codemode setting; all three, then re-decide.
- **Deferred loading / `exposure`:** per-specialist tools replace the single dispatch tool, or always-loaded tools become measurably costly; then re-decide.
- **Section patching:** a need to update the prompt mid-conversation without a full replace, or deprecation/removal of the whole-string return; then re-decide.

## Verification

- `pnpm install` resolves `@earendil-works/pi-coding-agent@1.0.0`; `packages/pi/node_modules` links that exact build.
- `bash scripts/check-sync` passes (no canonical text touched).
- `vp check` in `packages/pi` passes: no lint, format, or type errors against real `1.0.0` types (the host is installed as a workspace peer, so the compiler reads `1.0.0` declarations directly).
- `vp test` in `packages/pi`: 9 files, 88 tests, all pass.
- `vp pack` builds `dist/extension.mjs` cleanly with the host kept external (`neverBundle`).
- `git diff --check` clean.
- Live-host probe (boot Pi `1.0.0` with the extension; mode prompt injection, subagent spawn/poll loop, review-mode narrowing/restore): NOT run in this environment; open verification gap, see Assumptions.

## Date

2026-10-02

# @maestria/hermes

## 0.1.14

### Patch Changes

- [#269](https://github.com/agustinusnathaniel/maestria/pull/269) [`ef07bf7`](https://github.com/agustinusnathaniel/maestria/commit/ef07bf78a8e5f676c76b55680301bc7c839b68a9) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add conditional visual-evidence guidance for PR delivery: confirm the project targets GitHub with authenticated gh --attach support and an available capture tool before attaching a screenshot or short video for visual or behavioral changes. Vision is optional verification only, not a precondition.

- [#269](https://github.com/agustinusnathaniel/maestria/pull/269) [`ef07bf7`](https://github.com/agustinusnathaniel/maestria/commit/ef07bf78a8e5f676c76b55680301bc7c839b68a9) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add a global testing-judgment rule (test artifacts are opt-in, behavior over implementation shape, mocks only at external seams) and align reviewer and diagnose guidance with it.

## 0.1.13

### Patch Changes

- [#190](https://github.com/agustinusnathaniel/maestria/pull/190) [`96f2649`](https://github.com/agustinusnathaniel/maestria/commit/96f264911f8756ee3528277699deb96e8a1bc9d7) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify agent workflow contracts while preserving detailed specialist guidance. Routine validated commits on recognized feature branches remain autonomous after required review; push and later lifecycle actions stay separately gated. Add bounded repair and platform-enforcement notes, refresh generated projections, and retain explicit mode reset behavior and read-only sonar profiles where supported.

- [#194](https://github.com/agustinusnathaniel/maestria/pull/194) [`b1c67ed`](https://github.com/agustinusnathaniel/maestria/commit/b1c67eddcb46b0633166c0af25b5bfd336a33abb) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Simplify and re-align the shared agent directives around outcome, evidence, runtime authority, blind review, bounded repair, and autonomous routine work. Directives now avoid unnecessary orchestration ceremony, allow the host runtime to determine whether work is performed directly or delegated, prevent nested supervisors from duplicating scheduling and lifecycle work, and keep all generated platform projections synchronized.

## 0.1.12

### Patch Changes

- [#185](https://github.com/agustinusnathaniel/maestria/pull/185) [`79e753c`](https://github.com/agustinusnathaniel/maestria/commit/79e753c104c72a3403aded79ee6c49ed3cb2b5fe) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Streamline canonical agent directives by centralizing universal contracts, preserving orchestration behavior in compact form, and adding bounded autonomy, work-unit budgets, scope control, process lifecycle evidence, and checkpoint action boundaries.

- [#181](https://github.com/agustinusnathaniel/maestria/pull/181) [`6eabeff`](https://github.com/agustinusnathaniel/maestria/commit/6eabeff0348ad5a33c21360d7c0c72d31d89c968) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Harden the Hermes adapter by wiring native session and subagent lifecycle trust, immutable mode and child safety allowlists, and the current Hermes plugin registration contracts.

## 0.1.11

### Patch Changes

- [#160](https://github.com/agustinusnathaniel/maestria/pull/160) [`a351ed0`](https://github.com/agustinusnathaniel/maestria/commit/a351ed0e5af4f1c5ea0e960145ee5ff2347e2af4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Fix the hermes delegation rules adaptation in the synced global rules.

  PR [#157](https://github.com/agustinusnathaniel/maestria/issues/157) rewrote the canonical Delegation section to be route-scoped, which
  removed the canonical phrase the hermes sync config's replace targeted. The
  `findAndReplace` transform silently no-ops on a non-matching `from`, so the
  generated `global-rules/SKILL.md` shipped the raw canonical wording ("do not
  substitute platform-native built-in agents for them") instead of the hermes
  adaptation.

  The replace is re-based onto the new route-scoped sentence. Hermes agents
  again get the correct guidance: when delegating on focused/full routes, use
  only the 7 maestria specialists and never delegate to Hermes' built-in
  `explore` or `general` agents, which bypass the pipeline.

## 0.1.10

### Patch Changes

- [#157](https://github.com/agustinusnathaniel/maestria/pull/157) [`906f836`](https://github.com/agustinusnathaniel/maestria/commit/906f836a96a2f53e838c29d3a9e82d5c2336ba49) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Selective routing contract in the canonical orchestrator directives.

  **Three routes** - `direct` (host executes, no Maestria specialist spawn),
  `focused` (one targeted specialist, one reviewer for non-trivial
  work), and `full` (bounded recon, design, implementation, and review). The
  full pipeline is an explicit option for complex or high-risk work and for
  explicit `fein` requests, not the universal default.

  **Route guidance by task class** - explanation and discovery default to
  direct, tiny edits to direct or native builder with no automatic recon or
  review, ordinary code changes to focused, and complex or high-risk work to
  full with independent review where the host supports it. Scaling guardrails
  bound child spawns, parallel fan-out, architect/planner use, review lenses,
  and context compaction per route; they are bounds, not measured savings.

  **Explicit mode semantics** - `fein` selects the full route, `sonar` is
  research-only and does not implement, and `blitz` is an explicit
  low-risk/direct bypass that does not waive safety floors. An explicit user
  mode is honored subject to safety constraints. No platform claims to enforce
  modes identically or provide clean isolated contexts.

  **Maker/checker preserved** - every routed `@builder` change is followed by
  `@reviewer`; where the host cannot enforce separate sessions (e.g. Kimi, Pi,
  OMP, Hermes), the split is advisory and stated as such.

  **How this affects you:** Maestria no longer routes every turn through the
  full pipeline. Small explanations and tiny edits run directly or through one
  specialist; the full pipeline stays available for complex, high-risk, or
  explicitly `fein` work. No action required on your end - your agents apply
  the route contract automatically.

## 0.1.9

### Patch Changes

- [#136](https://github.com/agustinusnathaniel/maestria/pull/136) [`0bee77c`](https://github.com/agustinusnathaniel/maestria/commit/0bee77ca5d09b3f4000795d761eda473ec12d4bc) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Rule-override conditions and communication conventions for agent directives.

  **When to Break the Rules** - Added 6 explicit override conditions to the
  orchestrator prompt (user skip request, safety, mode override, frustration
  escalation, rule conflicts, explanation requests). This prevents rule
  rigidity by documenting when and how to deviate from defaults.

  **Communication conventions** - Two new shared rules adopted from
  established communication practice: report errors matter-of-factly
  (state problem, cause, and fix without hedging or drama) and lead with
  the action (first line actionable, context follows).

  **Review-commit handoff** - Review Triage now chains directly into the
  commit flow after approval (guarded against unresolved `[fix]` and
  `[escalate]` items), replacing the separate "Stop & Report" step.

  **How this affects you:** Agents now have clearer guidance on when to
  flex the rules and how to communicate. Error messages are more direct.
  Responses lead with something actionable rather than preamble. No action
  required on your end - your agents handle the new conventions automatically.

## 0.1.8

### Patch Changes

- [#129](https://github.com/agustinusnathaniel/maestria/pull/129) [`7dc3df1`](https://github.com/agustinusnathaniel/maestria/commit/7dc3df17dce1707b80a018437bbf0c263c106bc0) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Blind review and fail-loud iteration exit for the review protocol.

  **Blind review** - The reviewer agent no longer receives the builder's
  handoff notes or self-assessment. It now evaluates only the diff,
  requirements, and acceptance criteria. This removes a bias: the reviewer
  was previously primed by the builder's own narrative about what changed,
  rather than judging the code against the spec directly.

  **Fail-loud iteration exit** - When the review loop runs 3 cycles with
  unresolved issues, instead of silently documenting the gap and proceeding,
  the pipeline now stops and escalates. It produces a structured report of
  what's still blocking and requires your explicit override to continue.

  **How this affects you:** Reviews are more objective now. If a review
  stalls, you'll get a clear report of what's blocking it rather than a
  quiet pass. No action required on your end - your agents handle the new
  protocol automatically.

## 0.1.7

### Patch Changes

- [#108](https://github.com/agustinusnathaniel/maestria/pull/108) [`a2e2b8a`](https://github.com/agustinusnathaniel/maestria/commit/a2e2b8a061749c268e30eda82be43f6b1dbaf507) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Refactored all agent directive prompts for better structure, clarity, and cross-platform consistency:
  - Restructured core prompts with clearer sections and emphasis on critical rules agents must follow
  - Added structured handoff verification checklists to all specialist agents so handoffs between agents are more reliable
  - Standardized "Before reporting done" completion checks across all agents, reducing premature sign-offs
  - Added Parallelization table for safer multi-agent task execution when builders work in parallel
  - Added Multi-Lens Review Swarm capability for comprehensive code review that catches more issues
  - Made prompt instructions platform-agnostic so agents behave consistently across OpenCode, Cursor, Kimi Code, Pi, and other platforms
  - Fixed several content gaps where important behavioral rules were compressed too aggressively

## 0.1.6

### Patch Changes

- [#103](https://github.com/agustinusnathaniel/maestria/pull/103) [`886dbd0`](https://github.com/agustinusnathaniel/maestria/commit/886dbd0b92256110d89f1549d7a96849950a2e82) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Sync workflow mode commands (fein/sonar/blitz) through canonical source pipeline, including Hermes

## 0.1.5

### Patch Changes

- [#94](https://github.com/agustinusnathaniel/maestria/pull/94) [`6a0243f`](https://github.com/agustinusnathaniel/maestria/commit/6a0243f3d969f4721c07ff2ebec6676f322c0486) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Compact agent directives to cut context usage (~38% on the orchestrator prompt) without removing rules or intent. The orchestrator consolidates 15 critical rules into 11 and merges the commit, review, and routing guidance into single sections. Shared specialist rules (maker/checker split, handoff validation, ambiguity handling, escalation format, tool routing) now live once in the global rules instead of being repeated per specialist. Also fixes duplicate skill prescriptions in diagnose and architect, a formatting bug in the global rules, and stale cross-references.

## 0.1.4

### Patch Changes

- [#89](https://github.com/agustinusnathaniel/maestria/pull/89) [`837a529`](https://github.com/agustinusnathaniel/maestria/commit/837a529be3d65bb826df052d64cd8d4febe2cf7b) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Orchestrator now defaults to single-thread execution for simple changes instead of always routing work through subagents. Complex tasks (multi-file, cross-domain, risky) still get delegated to specialists. Routine fixes and small features are faster with less context overhead - no change in how you use the plugin.

## 0.1.3

### Patch Changes

- [#87](https://github.com/agustinusnathaniel/maestria/pull/87) [`09e69d8`](https://github.com/agustinusnathaniel/maestria/commit/09e69d83df432da49f82c71d69ce6f9610c50d50) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Wire maestria specialist roles into Hermes plugin hook system for permission enforcement

  Three fixes to make the maestria methodology actually work at runtime:
  - **pre_gateway_dispatch hook**: Intercepts `/fein`, `/sonar`, `/blitz`, `/mode`, `/review`, `/plan` commands before the agent-busy check, so they dispatch even when the agent is processing a turn. Uses fire-and-forget async send to reply directly. **Fixed: now passes `message_thread_id` in metadata so Telegram forum topic responses route to the correct thread instead of General.**
  - **Role-based permission enforcement**: Orchestrator now passes `[MAESTRIA_ROLE: <specialist>]` in `delegate_task` context. Subagent's `pre_llm_call` hook parses it and registers in a `session_id → role` map. `pre_tool_call` hook enforces tool restrictions per specialist role (builder=full access, reviewer=read-only, etc.). Sonar mode write-block remains the reliable primary gate.
  - **Transform hook annotates results**: Write operations in fein/blitz mode append a methodology annotation to tool results instead of being a silent no-op.

## 0.1.2

### Patch Changes

- [`72f6628`](https://github.com/agustinusnathaniel/maestria/commit/72f6628b1e02a8ddea20200b18ba26087109da27) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Fix plugin loading failure due to src/ layout

  Hermes plugin discovery expects `__init__.py` at the plugin root directory,
  but the package uses a `src/` layout (code under `src/maestria_hermes/`).
  Added a root-level `__init__.py` shim that adds `src/` to `sys.path` and
  re-exports `register` from the actual package.

  Without this, `hermes plugins install` silently fails to load the plugin
  - none of its slash commands (`/fein`, `/sonar`, `/blitz`, etc.), hooks,
    or skills are available.

## 0.1.1

### Patch Changes

- [#9](https://github.com/agustinusnathaniel/maestria/pull/9) [`17c6816`](https://github.com/agustinusnathaniel/maestria/commit/17c6816c602c9c40b96b28a1a574fc2c387cca56) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Initial release of @maestria/hermes - maestria methodology adapter for Hermes Agent.

  Features:
  - Mode system: fein (full pipeline), sonar (read-only), blitz (fast execution)
  - OpenCode CLI routing tool
  - Pipeline lifecycle hooks (pre-LLM, pre-tool, transform)
  - 9 specialist skill files
  - Slash commands: /fein, /sonar, /blitz, /mode, /review, /plan

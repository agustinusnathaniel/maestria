# Changelog

## 0.3.11

### Patch Changes

- [`4500749`](https://github.com/agustinusnathaniel/maestria/commit/4500749126e1c4b37fba83bdb8daf8dc319b654a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Remove read-only bash permissions (git status/diff/log/show/branch, ls, which, pwd) from orchestrator — it is now a pure dispatcher. Any codebase inspection must go through @adventurer or @builder.

## 0.3.10

### Patch Changes

- [`a12fc6d`](https://github.com/agustinusnathaniel/maestria/commit/a12fc6d719cefc7572f4afe85c664ee0ebc4031d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Revert orchestrator to pure dispatcher — after real-world testing, read/glob/grep
  permissions on the orchestrator caused workaround behavior (preferring direct
  recon over delegation to specialist agents). The experiment confirmed that
  structural permission denial is the only reliable enforcement for an LLM-based
  orchestrator. The orchestrator remains limited to task() delegation and
  question() — no read, glob, grep, webfetch, edit, or lsp.

  Streamline orchestrator prompt — remove directives that redundantly restate
  permission blocks (tool restrictions, bash allow-lists, task routing limits)
  which are already structurally enforced through YAML frontmatter.

## 0.3.9

### Patch Changes

- [`21d866f`](https://github.com/agustinusnathaniel/maestria/commit/21d866ff9a2b41e68e4de17152c5a6727d6b0e22) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add websearch:ask for architect, adventurer, and diagnose agents — these discovery-oriented agents can now search the web (with user prompt via `ask` permission) to find relevant documentation and resources.

  Grant read/glob/grep to orchestrator — the orchestrator now has read-only reconnaissance tools for quick verification before delegation, with structural safeguards (edit/webfetch/lsp remain denied, 3-call limit).

## 0.3.8

### Patch Changes

- [`2e2f10e`](https://github.com/agustinusnathaniel/maestria/commit/2e2f10e62e932747d0fc1a260aed3ef2b65f267c) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Refine agent permissions after audit

  - Add `todowrite` to adventurer, diagnose, writer for multi-step tracking
  - Add missing git commands (status, show, diff, log) to adventurer, architect, reviewer, writer
  - Add `lsp` to writer for code navigation during doc generation
  - Add `npm view` to builder for dependency checks
  - Add `which` to planner for tool discovery

## 0.3.7

### Patch Changes

- [`86c9589`](https://github.com/agustinusnathaniel/maestria/commit/86c958922d3d52308f106bb3d9785e3cab202092) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: replace hand-rolled YAML parser with spec-compliant library

  The custom YAML frontmatter parser (~120 lines) didn't handle quoting,
  nesting, or multiline values correctly. Permission patterns like
  `"git status*": allow` and `"*": deny` were silently broken because the
  parser treated quotes as literal characters instead of YAML syntax.

  This is now replaced with the `yaml` library (eemeli/yaml) — a proper
  spec-compliant parser that handles quoting, multiline values, and
  nested structures natively. The `stripYamlQuotes` workaround, added to
  patch the old parser, has been removed as it's no longer needed.

  All 8 agent descriptions have also been converted to YAML folded block
  scalars (`>`) for cleaner multiline text that reads well both in source
  and when parsed.

  Every agent's permission model was broken out of the box — deny-by-default
  didn't deny, and allowlists didn't allow. That's fixed now.

## 0.3.6

### Patch Changes

- [`a52dd48`](https://github.com/agustinusnathaniel/maestria/commit/a52dd48b8ee2aa031f9989fde268d08d5c2569ce) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: explicitly deny orchestrator read-side tools

  The orchestrator's `read`, `glob`, `grep`, `lsp`, and `webfetch` permissions are now explicitly set to `deny`. The previous refactor relied on a missing-key default that the opencode framework does not honor, so the orchestrator was still able to use these tools. The new explicit denials make the strict-dispatcher role effective.

  The 7 specialist subagents retain full read-side tool access for the work they pick up.

## 0.3.5

### Patch Changes

- [`f9f9a7d`](https://github.com/agustinusnathaniel/maestria/commit/f9f9a7d6f08699d5db8c2ddc0d7234eb9e3b2251) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: strip orchestrator read-side tools and add missing global directives

  The orchestrator is restructured into a strict dispatcher. Its `read`, `glob`, `grep`, `lsp`, and `webfetch` permissions are removed, and the opening prompt is rewritten as a dispatcher mandate stating that `task()` and `question()` are the only tools for making progress. CRITICAL RULES are consolidated from 10 to 8 — the redundant "Shell is not a workaround" and "Prefer local tools over webfetch; webfetch may hang" directives are deleted and the rest are renumbered. The 7 specialists retain full read-side tool access for the work they pick up.

  Three directives are also added to the global rules (`packages/opencode/rules/AGENTS.md`): "Webfetch may hang — don't block on it", "CLI references — use local tools first", and "Local files — read directly". Because global rules are injected into every specialist's prompt at runtime, this closes 21 directive-coverage gaps (3 directives × 7 specialists) and the guidance now applies uniformly.

## 0.3.4

### Patch Changes

- [`361171d`](https://github.com/agustinusnathaniel/maestria/commit/361171de7b0d2b90235a98f7d61c1ba3c541f3f4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: audit and update skill prescriptions across all 7 agents
  - Fix rename: `diagnose` → `diagnosing-bugs`, `write-a-skill` → `writing-great-skills`
  - Remove dead skill: `zoom-out` (not in mattpocock/skills)
  - Fix 10 wrong source repos (ADRs → wshobson/agents, review-logging-patterns → hugorcd/evlog, etc.)
  - Remove skills from sickn33/antigravity-awesome-skills and refoundai/lenny-skills sources
  - Add 8 new skills from mattpocock/skills and anthropics/skills with cross-references across appropriate agents

## 0.3.3

### Patch Changes

- [`7c6e15c`](https://github.com/agustinusnathaniel/maestria/commit/7c6e15c61a329bccf5776201e860c6816ef11edb) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: audit and sort agent skill prescriptions across all 7 agents

  Alphabetically sorts the "Load on trigger" skill lists in all 7 agent files (adventurer, architect, builder, diagnose, planner, reviewer, writer) and adds a few missing skill entries for consistency (e.g., `session-handoff` to adventurer, `prioritizing-roadmap` and `technical-roadmaps` to planner).

## 0.3.2

### Patch Changes

- [`bda0043`](https://github.com/agustinusnathaniel/maestria/commit/bda00430d0dbfc6ba050dced54b9f52236d0811f) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: strengthen orchestrator delegation rules
  - Rule [#1](https://github.com/agustinusnathaniel/maestria/issues/1) expanded to explicitly forbid using shell commands for
    implementation work — shell is for context-gathering only, never
    for doing the work yourself. References the Available Specialists
    table instead of duplicating agent mappings inline.
  - New rule [#2](https://github.com/agustinusnathaniel/maestria/issues/2): "Shell is not a workaround" — catches the common
    failure mode of substituting shell commands for delegation.
  - Subsequent rules renumbered.

## 0.3.1

### Patch Changes

- [`fc26805`](https://github.com/agustinusnathaniel/maestria/commit/fc26805a19ee712b75e96766859d8c2d86d31266) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: restrict orchestrator task permissions to 7 registered subagents

  The orchestrator's `task` permission was changed from `"*": allow` to a
  deny-by-default pattern that explicitly allows only the 7 registered
  subagents (adventurer, architect, builder, diagnose, planner, reviewer,
  writer). Built-in `explore` and `general` subagents are removed from the
  Task tool description entirely, providing technical enforcement that
  prevents the orchestrator from delegating to them.

## 0.3.0

### Minor Changes

- [`9759d01`](https://github.com/agustinusnathaniel/maestria/commit/9759d01c08dba296a4c139be977147131be9134a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Incorporate AI engineering learnings from my-base knowledge base
  - **"Read the docs first"** — new non-negotiable directive across global rules (AGENTS.md), architect, and builder agents to prevent guessing at API behavior
  - **Diagnostic documentation mandate** — elevated from passive guidance to `!!!` non-negotiable in diagnose.md; diagnostic findings must be saved as persistent knowledge artifacts
  - **Skill prescription expansion** — builder gains `commit-work` skill, diagnose gains `dependency-updater` skill for dependency-related investigations

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.2.6](https://github.com/agustinusnathaniel/maestria/compare/v0.2.5...v0.2.6) (2026-06-14)

### Bug Fixes

- **opencode:** fix typo in builder.md agent prompt ([1c098ff](https://github.com/agustinusnathaniel/maestria/commit/1c098fffce7235c6b1e1d88d9fd1750794ec9930))

## [0.2.5](https://github.com/agustinusnathaniel/maestria/compare/v0.2.4...v0.2.5) (2026-06-12)

## [0.2.4](https://github.com/agustinusnathaniel/maestria/compare/v0.2.3...v0.2.4) (2026-06-12)

### Bug Fixes

- **opencode:** restore rules injection, remove conflicting instruction ([85d0267](https://github.com/agustinusnathaniel/maestria/commit/85d0267e9c82687b62750777b83ea54c70fb8f0e))

## [0.2.3](https://github.com/agustinusnathaniel/maestria/compare/v0.2.2...v0.2.3) (2026-06-12)

## [0.2.2](https://github.com/agustinusnathaniel/maestria/compare/v0.2.1...v0.2.2) (2026-06-12)

### Features

- **docs:** add Astro Starlight documentation site for @maestria/opencode ([06a21ac](https://github.com/agustinusnathaniel/maestria/commit/06a21ac7b95ab97bcf5773bd43081fabe1bf1be6))

### Bug Fixes

- **opencode:** correct source repos for 10 skills per my-base doc ([d2e0671](https://github.com/agustinusnathaniel/maestria/commit/d2e0671b7fd8816684bdb960b57defda1f074784))
- **opencode:** restore commit discipline, counter builder dispatch bias ([29df280](https://github.com/agustinusnathaniel/maestria/commit/29df28071b4ca996cf65b1050de7f2c69b341c2f)), closes [#3](https://github.com/agustinusnathaniel/maestria/issues/3) [#7](https://github.com/agustinusnathaniel/maestria/issues/7) [#8](https://github.com/agustinusnathaniel/maestria/issues/8) [#1](https://github.com/agustinusnathaniel/maestria/issues/1)
- **opencode:** stop injecting rules into subagent prompts ([9dfb79c](https://github.com/agustinusnathaniel/maestria/commit/9dfb79cd005629617b900d7be2b8dab42ea3e48c))
- **orchestrator:** unstick webfetch by skipping approval + preferring local tools ([23278a0](https://github.com/agustinusnathaniel/maestria/commit/23278a03667909af740648af888377dc0ce8c31f)), closes [#9](https://github.com/agustinusnathaniel/maestria/issues/9)

## [0.2.1](https://github.com/agustinusnathaniel/maestria/compare/v0.2.0...v0.2.1) (2026-06-12)

### Bug Fixes

- force orchestrator delegation via permissions, inject specialist table into global rules ([74fcecd](https://github.com/agustinusnathaniel/maestria/commit/74fcecd20ec427da7accb857df2c6bb0b444b1f8))

## 0.2.0 (2026-06-12)

### Features

- add adventurer subagent, fix orchestrator delegation and skill patterns ([4306993](https://github.com/agustinusnathaniel/maestria/commit/4306993803b2f78f09bde009d1d164ddcd28b84e))
- **opencode:** add @maestria/opencode plugin with 7 agents and rules injection ([21138d2](https://github.com/agustinusnathaniel/maestria/commit/21138d29911604035cfa7e589618caac2f92bcc5))
- **opencode:** add agent cross-references and skill discovery guidance ([b49e3e9](https://github.com/agustinusnathaniel/maestria/commit/b49e3e9427b02d0781aa15dd1a8dfc60e5140abc))
- **opencode:** add categorized skill catalog to orchestrator ([8883b11](https://github.com/agustinusnathaniel/maestria/commit/8883b11010dabb61972b353f689a7097bb8e591b))
- **opencode:** add Conventional Comments labels to reviewer output ([3578490](https://github.com/agustinusnathaniel/maestria/commit/357849075247b17e55dcb140af834554751894cb))
- **opencode:** add domain-specific skill lists to all subagents ([0f10b74](https://github.com/agustinusnathaniel/maestria/commit/0f10b74ca6d7955fd0b49c4276723ea47c646971))
- **opencode:** add opensrc pattern to global rules ([47962e9](https://github.com/agustinusnathaniel/maestria/commit/47962e9b4229e8c01ecde26fe621dbb73c41ff0d))
- **opencode:** enrich skill lists across all agents ([afb9400](https://github.com/agustinusnathaniel/maestria/commit/afb9400649918762631816e880bb8c0c6d641d15))
- **opencode:** final enrichment pass on agent skill lists ([e677425](https://github.com/agustinusnathaniel/maestria/commit/e67742538957bbd91ad3b8bc4990324c9e02041b))

### Bug Fixes

- **opencode:** add commit/push discipline rule ([e44aea3](https://github.com/agustinusnathaniel/maestria/commit/e44aea32540590b03bb59f4a5632815bf031dc6c))

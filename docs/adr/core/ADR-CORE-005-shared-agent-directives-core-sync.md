# ADR-CORE-005: Canonical Directives and Generated Host Projections

## Status

Accepted (2026-06-23), Confidence: High. Last amended 2026-11-17: one plan compiler builds every generated package.

## Context

OpenCode, Pi, and Kimi once kept separate copies of mostly identical prompts, rules, and methodology, and manual porting drifted. The differences between hosts (tool names, frontmatter, invocation syntax, file layout) were mechanical enough to project from one readable source.

## Decision

### Ownership

Author shared prompts, rules, workflow modes, and maestria's own method skills only in `packages/core/agent-directives/`, as readable Markdown with canonical role tokens. Host tool syntax, frontmatter, and layout belong to the generator. The [content ownership guide](../../../packages/core/agent-directives/README.md) owns the source layout.

### One plan compiler

`scripts/sync-consolidated-plugin.ts` builds one explicit output plan per generated package: `@maestria/agent-plugins`, plus the OpenCode and Pi adapter files listed in `scripts/native-adapter-files.ts`. Every plan is built and its paths validated before any package is written; reading a missing canonical file or `## heading` throws before the first write. Stale removal touches only files carrying the generator's notice. Generated notices are unconditional, and generated output is excluded from formatting so format and sync cannot undo each other. `scripts/sync-all` writes; `scripts/check-sync` regenerates and compares bytes, which also reports any hand edit as drift.

The compiler replaced a config-driven engine with defaults, per-file overrides, anchor validation, and a git provenance check. Those served fixed compositions that the compiler now names directly; the one remaining text rewrite (`@role` to Pi's `/role`) cannot drop content, and `packages/core/tests/roster.test.ts` checks it and each adapter's agent set.

### Development tooling

Run the generator through one root-pinned `tsx` via `pnpm exec`. A package-local `npx` fell back to registry downloads when tooling was missing and broke offline CI. The tool is not published because nothing outside this repository consumes it.

### Skill ownership

- **Method skills** maestria's own workflow names (`architecture-plan`, `create-pull-request`, `diagnose`, `docs-update`, `handoff`, `implement`, `recon`, `review-loop`) are authored once under `skills/` and copied by `scripts/sync-bundled-skills.ts` into every maestria package, so no host has a directive pointing at a missing skill. Runtimes maestria does not package install them with `npx skills add agustinusnathaniel/maestria`, which follows the Claude marketplace entry's relative source.
- **Generic engineering skills** live in their own repositories (for example `agustinusnathaniel/skills`). Directives may name them; users install them; maestria never vendors them.

An obligation every role needs stays in always-on policy; a skill is never its only home.

## Consequences

- One source removes manual porting; adding a host means adding its output plan, not changing a universal runtime.
- Maintainers must edit canonical sources and regenerate before delivery; section headings named by the compiler become a generation contract.
- Bundled skills add generated copies to every package, and a skill change ships only when each package releases.
- A mechanical projection does not establish equal runtime enforcement across hosts.

## Alternatives Considered

- **Per-plugin shell scripts:** rejected because they duplicate transforms and check, diff, and error handling.
- **Typed objects exporting prose, or conditional template engines:** rejected because owners would edit TypeScript, and host branches obscure prose.
- **Symlinks to canonical files:** rejected because they cannot adapt frontmatter or tool syntax and misbehave on Windows and in editors.
- **Warn on missing inputs, or validate while writing:** rejected because warnings permit incomplete output and a late error leaves earlier files changed.
- **A general config-driven engine:** retired 2026-11-17; its configuration surface outlived the variation it was built for.
- **Hand-authored skill copies beside the rules:** rejected after the two homes drifted.
- **Move the method skills to the generic skills repository, or install them as CLI companions:** rejected because the rules depend on them, and hosts the CLI does not manage never received them.
- **Vendor external skill repositories as submodules or copies:** rejected because it couples releases to unrelated skills.

## Related Decisions

- [CORE-002](ADR-CORE-002-plugin-architecture.md): readable Markdown and native host registration.
- [CORE-020](ADR-CORE-020-hybrid-package-topology.md): host-neutral utilities and native adapters.
- [CORE-036](ADR-CORE-036-always-on-core-and-skill-map.md): which text is always-on and which is a skill.

## Date

2026-06-23; amended 2026-10-12, 2026-10-13, and 2026-11-17.

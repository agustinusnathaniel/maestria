# ADR-CORE-005: Canonical Directives and Declarative Host Projections

## Status

Accepted (2026-06-23), Confidence: High. Consolidated 2026-10-03 with root-resolved tooling (2026-08-12), anchor preflight (2026-09-10), and fail-closed source resolution (2026-09-11).

## Context

OpenCode, Pi, and Kimi originally maintained independent copies of mostly identical specialist prompts, rules, and orchestration methodology. Manual porting and package-local shell transforms drifted. Differences in tool names, frontmatter, invocation syntax, and file layout were mechanical enough to project from one readable source once multiple hosts demonstrated the shared need.

Literal replacements introduced another risk: an anchor could disappear or be rewritten by an earlier operation, leaving a silent no-op. Missing source files also produced empty or partial output. A check that discovered failure after writing earlier files could not protect the projection boundary.

## Decision

### Ownership and projection

Author shared prompts, rules, workflow modes, and skills only in `packages/core/agent-directives/`. Keep prose readable Markdown with canonical role tokens; host-specific tool syntax, frontmatter, and layouts belong in each package's `sync.config.ts`. The [content ownership guide](../../../packages/core/agent-directives/README.md) owns the maintained source layout.

One monorepo-internal TypeScript sync tool derives host artifacts through declarative string replacements, content composition, frontmatter serialization, generated provenance, and normalized output. Configs support defaults plus explicit per-file overrides and preserved host-local content; the engine does not know platform identities. Static frontmatter avoids another dynamic extension surface. Library YAML quoting is sufficient unless a host demonstrates a stricter need.

The orchestrator follows the same projection path because its methodology was also mostly duplicated; host-local integration is not a reason to maintain the entire prompt separately. Generated notices are unconditional. `scripts/sync-all` writes projections; `scripts/check-sync` regenerates and compares byte identity, including provenance. Generated output is excluded from ordinary formatting so format and sync cannot repeatedly undo each other. Commands, flags, and exact transform ordering are maintained in [the sync source](../../../packages/core/scripts/sync.ts) and its libraries, rather than copied here.

### Root-resolved development tooling

Use one exact root-pinned `tsx` runner through `pnpm exec`, preserving each package's config working directory and the absolute script path. The root scripts discover package configs and are the supported shared entry points. A package-local `npx` invocation fell back to registry downloads when local tooling was missing and broke clean/offline CI. Per-package runner copies permit version drift; direct `node_modules` paths couple scripts to package-manager layout.

The tool is not published: it runs only within this monorepo, so a publish/consume cycle adds versioning and release work without a consumer benefit. The cost is requiring the workspace installation rather than running sync from an isolated package.

### Shared source plan and no-write preflight

Resolve one ordered plan for validation and processing: primary Markdown in walk order, then secondary configured entries in declaration order. A missing source directory or configured file absent from both resolution locations throws `ConfigError` before any writes, cleanup, or removal. Missing inputs are not a verbose-only skip. Exit codes distinguish success (0), projection drift (1), and invalid configuration (2).

Validate anchors before processing, counting matches immediately before each ordered replacement. A default operation must match somewhere across its swept files; a file operation must match in its own file. Empty and identity replacements are invalid even when they match. Dead and shadowed anchors produce deterministic diagnostics naming config, scope, file, anchor, and match count, with no output mutation. Scope remains internal to resolution rather than becoming another authoring field.

## Consequences

- One source removes manual methodology porting; adding a host requires its own projection config rather than changes to a universal runtime.
- Declarative transformations and generated provenance make ownership reviewable, but maintainers must edit canonical sources and regenerate before delivery.
- Fail-closed resolution and ordered preflight prevent silent or partial projections. Conditional replacements that stop matching now need an explicit config update.
- Validation adds source reads and configs add a navigation hop; those costs buy evidence that the actual resolved transforms apply.
- Root tooling avoids registry fallback and runner drift while depending on the workspace's package manager and installation.
- Historical migrations needed careful preservation of host-specific patches; a mechanical projection does not establish equivalent runtime enforcement across hosts.

## Alternatives Considered

- **Per-plugin shell scripts:** rejected because they duplicate transforms, portability work, and check/diff/error handling.
- **Typed objects exporting prose:** rejected because content owners would edit TypeScript instead of readable Markdown.
- **Conditional template engines:** rejected because host branches obscure prose and handle structural differences poorly.
- **Symlinks to canonical files:** rejected because they cannot adapt frontmatter or tool syntax and complicate Windows and editor behavior.
- **Publish a sync package:** rejected because the tool has no out-of-repository consumer.
- **Warn on missing inputs or dead anchors:** rejected because warnings still permit incomplete output.
- **Validate while writing:** rejected because a later error leaves earlier outputs changed.
- **Check every default against every file:** rejected because defaults legitimately apply to only some files; scope-aware aggregation preserves that use.
- **Keep configurable provenance or compatibility aliases without consumers:** rejected because unused private surface creates obligations without preserving a public contract.

## Related Decisions

- [CORE-002](ADR-CORE-002-plugin-architecture.md): readable Markdown and native host registration.
- [CORE-019](ADR-CORE-019-directive-simplification.md): single-home methodology and outcome ownership.
- [CORE-020](ADR-CORE-020-hybrid-package-topology.md): host-neutral utilities and native adapters.

## Date

2026-06-23; consolidated 2026-10-03.

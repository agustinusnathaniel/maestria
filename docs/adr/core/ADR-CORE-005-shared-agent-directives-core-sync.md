# ADR-CORE-005: Canonical Directives and Declarative Host Projections

## Status

Accepted (2026-06-23), Confidence: High. Consolidated 2026-10-03 with root-resolved tooling (2026-08-12), anchor preflight (2026-09-10), and fail-closed source resolution (2026-09-11). Amended 2026-10-12 with skill ownership tiers and 2026-10-13 with bundled methodology skills.

## Context

OpenCode, Pi, and Kimi originally maintained independent copies of mostly identical specialist prompts, rules, and orchestration methodology. Manual porting and package-local shell transforms drifted. Differences in tool names, frontmatter, invocation syntax, and file layout were mechanical enough to project from one readable source once multiple hosts demonstrated the shared need.

Literal replacements introduced another risk: an anchor could disappear or be rewritten by an earlier operation, leaving a silent no-op. Missing source files also produced empty or partial output. A check that discovered failure after writing earlier files could not protect the projection boundary.

## Decision

### Ownership and projection

Author shared prompts, rules, workflow modes, and skills only in `packages/core/agent-directives/`. Keep prose readable Markdown with canonical role tokens; host-specific tool syntax, frontmatter, and layouts belong in the native adapter packages' `sync.config.ts` (OpenCode and Pi) or, for declarative hosts, in the consolidated generator's manifest inputs (see [CORE-034](ADR-CORE-034-consolidated-declarative-plugin.md)). The [content ownership guide](../../../packages/core/agent-directives/README.md) owns the maintained source layout.

One monorepo-internal TypeScript sync tool derives host artifacts through declarative string replacements, content composition, frontmatter serialization, generated provenance, and normalized output. Configs support defaults plus explicit per-file overrides and preserved host-local content; the engine does not know platform identities. Static frontmatter avoids another dynamic extension surface. Library YAML quoting is sufficient unless a host demonstrates a stricter need.

The orchestrator follows the same projection path because its methodology was also mostly duplicated; host-local integration is not a reason to maintain the entire prompt separately. Generated notices are unconditional. `scripts/sync-all` writes projections; `scripts/check-sync` regenerates and compares byte identity, including provenance. Generated output is excluded from ordinary formatting so format and sync cannot repeatedly undo each other. Commands, flags, and exact transform ordering are maintained in [the sync source](../../../packages/core/scripts/sync.ts) and its libraries, rather than copied here.

### Root-resolved development tooling

Use one exact root-pinned `tsx` runner through `pnpm exec`, preserving each package's config working directory and the absolute script path. The root scripts discover package configs and are the supported shared entry points. A package-local `npx` invocation fell back to registry downloads when local tooling was missing and broke clean/offline CI. Per-package runner copies permit version drift; direct `node_modules` paths couple scripts to package-manager layout.

The tool is not published: it runs only within this monorepo, so a publish/consume cycle adds versioning and release work without a consumer benefit. The cost is requiring the workspace installation rather than running sync from an isolated package.

### Consolidated compositions and whole-run preflight (2026-10-11)

The consolidated plugin compiler (`scripts/sync-consolidated-plugin.ts`) composes multiple canonical role, policy, router and mode inputs into native resources while retaining core ownership and shared normalization/frontmatter helpers. Generic sync configs remain in use for the native adapters only. The root wrapper freezes the discovered config list and validates every entry with a read-only dry-run before any write. Detected processing errors return failure in dry-run and write modes as well as check mode, so output-file errors cannot silently bypass the preflight.

### Shared source plan and no-write preflight

Resolve one ordered plan for validation and processing: primary Markdown in walk order, then secondary configured entries in declaration order. A missing source directory or configured file absent from both resolution locations throws `ConfigError` before any writes, cleanup, or removal. Missing inputs are not a verbose-only skip. Exit codes distinguish success (0), projection drift (1), and invalid configuration (2).

Validate anchors before processing, counting matches immediately before each ordered replacement. A default operation must match somewhere across its swept files; a file operation must match in its own file. Empty and identity replacements are invalid even when they match. Dead and shadowed anchors produce deterministic diagnostics naming config, scope, file, anchor, and match count, with no output mutation. Scope remains internal to resolution rather than becoming another authoring field.

### Skill ownership tiers (2026-10-12, amended 2026-10-13)

Every skill has one owner and one install path:

- **Core utility skills** (`handoff`, `iteration-limits`) are projections, not authored files. Each is generated from one `rules.md` section through one shared section extractor: the generic engine selects it with a per-file `section` option, the consolidated compiler with its own utility-to-section map. A missing heading fails before any write. Hand-authored copies had drifted: Pi still described a seven-field handoff contract after the fixed schema was retired, and `iteration-limits` carried stop rules the global policy lacked.
- **Bundled methodology skills** (`create-pull-request`, `docs-update`) live once at the repository root `skills/`. `scripts/sync-bundled-skills.ts` copies each into every maestria package (`@maestria/agent-plugins`, `@maestria/opencode`, `@maestria/pi`) with a provenance notice, and `scripts/check-sync` guards the copies, so they version with each package and no host has a directive pointing at a missing skill. The OpenCode plugin registers its copy through `skills.paths` in its config hook. Runtimes maestria does not package install them from the root through `skills.sh`. Until 2026-10-13 the CLI installed them as optional companions through the pinned `skills` CLI; that left marketplace, Devin, ZCode, and Hermes users without skills the core rules name, and needed a second, unversioned Claude manifest. The CLI now only removes copies it installed earlier, using its ownership record.
- **Generic engineering skills** live in their own repositories (for example `agustinusnathaniel/skills`). Directives may name them as on-trigger loads, users install them, and maestria never vendors them.

Anything every role needs stays inline in core policy; a skill tier is never the only home of a cross-role obligation ([CORE-019](ADR-CORE-019-directive-simplification.md)).

## Consequences

- One source removes manual methodology porting; adding a host requires its own projection config rather than changes to a universal runtime.
- Declarative transformations and generated provenance make ownership reviewable, but maintainers must edit canonical sources and regenerate before delivery.
- Fail-closed resolution and ordered preflight prevent silent or partial projections. Conditional replacements that stop matching now need an explicit config update.
- Validation adds source reads and configs add a navigation hop; those costs buy evidence that the actual resolved transforms apply.
- Root tooling avoids registry fallback and runner drift while depending on the workspace's package manager and installation.
- Bundled skills add two generated copies per package to every release and make the packages larger; a change to a root skill ships only when each package releases.
- Utility skills read as policy sections rather than curated checklists, and whatever a skill-only host needs from them must live in the source section, which keeps always-on policy slightly larger. Section headings become a generation contract.
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
- **Git submodule or vendored copies of external skill repositories:** rejected because they couple releases to unrelated skills and repeat the copy layouts this generator already retired.
- **Hand-authored utility skills beside the rules:** rejected because the two homes drifted.
- **Move the methodology skills to the generic skills repository:** rejected because they are maestria-specific and the core rules depend on them.
- **CLI-installed optional companions:** retired 2026-10-13 because hosts the CLI does not manage never received them, and a selection record, ownership preflight, and separate manifest existed only to work around that.

## Related Decisions

- [CORE-002](ADR-CORE-002-plugin-architecture.md): readable Markdown and native host registration.
- [CORE-019](ADR-CORE-019-directive-simplification.md): single-home methodology and outcome ownership.
- [CORE-020](ADR-CORE-020-hybrid-package-topology.md): host-neutral utilities and native adapters.

## Date

2026-06-23; consolidated 2026-10-03; amended 2026-10-12 and 2026-10-13.

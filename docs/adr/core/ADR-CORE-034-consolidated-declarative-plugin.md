# ADR-CORE-034: Consolidated Declarative Plugin

## Status

Accepted, Confidence: Medium.

## Context

Codex, Claude Code, Cursor, and Kimi Code shipped separate packages even though their workflow methodology comes from the same canonical directives. Agent Plugins adds a portable distribution, while Devin and ZCode expose additional declarative plugin surfaces. Maintaining separate product identities and releases obscures which package users should install.

The owner approved consolidating these distributions and removing the old package directories, then selected the portable distribution for Hermes in place of its Python adapter. OpenCode and Pi retain separate runtime adapters. OMP and Prime Agent are not current native runtime adapters.

### Hermes retirement rationale (2026-10-10)

The former Hermes adapter added Python and host-version maintenance to provide tool gates, mode commands and persistence, child tracking, and an OpenCode subprocess bridge. Those capabilities could enforce behavior beyond portable skills, but duplicated host-owned lifecycle and trust mechanisms and expanded the release surface. The consolidated package accepts the loss of those adapter controls: portable methodology does not grant capabilities, while Hermes owns permissions, delegation, trust, goals, memory, and session lifecycle. Role names or delegated text are not authenticated capability grants. Hermes core owns `/goal`; the plugin does not wrap its loop or create competing persistent state. Migration disables the old adapter only after the replacement installs and leaves legacy user files intact. The retired subprocess boundary was removed with its bridge; it is not a current runtime guarantee.

## Decision

Publish one `@maestria/agent-plugins` package from `packages/agent-plugins/`. The package root is directly installable, with host manifests beside generated components, following the PostHog/Pstack structure. Its portable root manifest and native host manifests identify the same versioned product. Native agent, command, and policy compositions carry methodology; the root skill surface contains only reusable handoff and iteration-limit utilities. Native schemas and metadata preserve each host contract.

Canonical shared methodology remains in `packages/core/agent-directives/`. Host-specific profile/native metadata and manifest inputs live in the development-only `generation/` directory. The consolidated compiler is their sole resource writer and composes complete contexts from canonical core sources. Host guidance stays canonical in core; package integrations contain generated runtime guides. Sync checks cover projections and derived installation resources. No host-specific directory becomes a second methodology source.

Start the consolidated version line above every retired package version so ordinary updates are not rejected as downgrades. Keep the existing maestria CLI platform identifiers. Their installers consume the consolidated package while retaining host-native installation and managed-file ownership behavior. Remove the old source package directories and version targets; previously published packages and installed user content are not deleted by this repository migration.

Core separates semantic ownership: specialists own roles, commands own workflow definitions, rules own shared policy, and skills own reusable utility guidance. The installable root respects those semantic classes: roles in agents, modes in commands, policy in rules, and utilities in skills. Role, mode, dispatcher, and global-policy root SKILL exports are retired. These projections do not become a second methodology source. Describing a future hook, automation, or command in documentation does not implement or activate it; runtime behavior requires an explicit package resource and host configuration. The standalone CLI remains in `apps/maestria-cli`.

Hermes consumes the portable root manifest and discovers qualified skills through its host tools. Retire the Hermes Python adapter, its role gating, mode commands, subprocess bridge, and lifecycle hooks. On migration, disable the old adapter only after the replacement installs successfully; keep legacy files and user data intact.

### Direct installation root amendment (2026-10-11)

Keep `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `.devin-plugin/`, `.zcode-plugin/`, the portable manifest, and Kimi manifest directly under `packages/agent-plugins/`. Git/local loaders select this package root; npm archives expose the same resource layout. Generation tooling and manifest inputs remain under `generation/` and are excluded from publication. Track generated installation resources because Git consumers do not run the repository generator. This is one product and release version.

This amendment replaces the earlier source/bundle split that introduced a nested `plugin/` installation directory and `publishConfig.directory`. That split made Git installation paths less conventional and duplicated semantic views already owned by core. Keeping a directly installable package preserves the familiar PostHog/Pstack layout while retaining canonical ownership. Portable v1 discovery is now deliberately utility-only. Native schemas and permission differences remain explicit; complete workflows use native command/context mechanisms rather than reintroducing root role skills.

### Complete native mappings amendment (2026-10-11)

Audit every supported surface independently and map each to its native agent, command, and policy mechanisms; the current per-host mapping lives in the [capability contract](../../agent-plugin-capabilities.md), not in this record. OMP and Devin load native resources without an executable adapter.

Codex fixes portable discovery to root skills and does not activate native workflow files through the overlay selector. Marketplace installation therefore exposes utilities; the existing companion CLI installs complete TOMLs and a marked full policy/router/mode instruction block. Hermes retains the non-Python portable path with utility-only installation and optional manual host context setup. These are explicit capabilities, not implied parity.

The source/bundle detour and its root fourteen-skill compatibility layout are superseded. Supported but unused hooks, automation facilities, settings, and MCP integrations are distinguished from unsupported or unverified component loading in the [capability contract](../../agent-plugin-capabilities.md). Do not add executable scaffolding merely because a host supports it.

### Shared native profiles amendment (2026-10-12)

Ship each role once as `agents/<role>.md`, and each workflow mode once as `commands/<mode>.md`, for every Markdown host. Read-only roles carry each host's control in one frontmatter block: `readonly` for Cursor, `disallowedTools: [Write, Edit]` for Claude Code, Kimi Code, and ZCode, and `subagents: []` for Kimi. Profiles omit `model`, which Claude Code, Cursor, and ZCode treat as the main conversation's model. Codex profiles are generated TOML beside the Markdown, because Codex loads only TOML agents installed by the companion CLI. Retire the per-host agent and command copies, the dispatcher-only `orchestrator` profile (a child profile cannot dispatch on most hosts, and the always-on context already routes), and Devin's mode skill transport (Devin has no plugin command component; its always-on policy routes mode keywords).

Earlier sessions kept per-host copies on the assumption that hosts reject one another's keys and that Claude and Kimi tool names conflict. Evidence on 2026-10-12 disproved both: Claude Code and Kimi ignore unknown frontmatter fields, both accept a YAML tool list, and current Kimi names its file tools `Write` and `Edit` (the previously shipped `WriteFile` and `StrReplaceFile` matched nothing). A Cursor CLI probe loaded profiles carrying other hosts' keys unchanged. It also showed that Cursor does not enforce `readonly` for plugin-supplied profiles, although it does for project `.cursor/agents/` profiles, so Cursor plugin read-only is intent plus prompt guidance. Rules remain per host because their formats differ and OMP and Devin discover flat `rules/*.md`.

## Consequences

- Users and maintainers share one declarative plugin identity and release lifecycle: `@maestria/agent-plugins`.
- One shared profile and command set removes per-host copies; manifests select it explicitly where a host requires file lists, and per-host subfolders no longer exist to be swept by recursive discovery.
- Host enforcement still differs: a shared key is a request that each host honors on its own terms, so the capability contract records which hosts enforce read-only.
- Native dispatch, permissions, persistence, and trust remain host-owned; a portable package does not establish runtime parity.
- Existing users update through their host installer or the maestria CLI; package names and source layout change.
- More resources ship in one archive, so packed-artifact validation must check containment, reachability, and metadata, not just source-tree existence.
- Devin and ZCode began as documented candidates; Devin discovery and ZCode loading are now evidenced in the capability contract. Live host verification remains separate from manifest and package validation.
- Hermes loses adapter-level enforcement and mode persistence; its host owns trust and lifecycle. The former Python package also carried host-version coupling and subprocess-boundary maintenance, now removed with the adapter.

## Alternatives Considered

- **Keep independent declarative packages:** preserves old source paths but retains redundant release and discovery surfaces.
- **One universal runtime adapter:** rejected because hosts expose different execution, permission, and lifecycle contracts.
- **Per-host copies of identical profiles:** retired on 2026-10-12. The copies differed only in frontmatter that every host reads selectively, and their subfolders were themselves exposed to recursive discovery. Rules keep host folders because their formats genuinely differ.
- **Maintain compatibility packages indefinitely:** rejected by the owner because current adoption does not justify that additional maintenance surface.

## Supersession

- **2026-10-10:** supersedes the separate-package topology in [CORE-022](ADR-CORE-022-agent-plugins-portable-projection.md) and the older Hermes, OMP, and Prime distribution claims in [CORE-020](ADR-CORE-020-hybrid-package-topology.md). Their portable-format and shared-code boundaries remain in force. The same consolidation supersedes the standalone package topology in [CR-001](../cursor/ADR-CR-001-cursor-plugin-architecture.md), while retaining its Cursor-specific integration decision.
- **2026-10-10:** retires and consolidates Hermes records HM-000 through HM-004. The consequential rationale survives in the Hermes retirement passage above; the removed adapter's implementation details remain in Git history.
- **2026-10-10:** consolidates the former Kimi distribution record KC-000. [KC-001](../kimi-code/ADR-KC-001-kimi-code-architecture.md) remains the owner of Kimi-specific integration boundaries. Removed identifiers are not reused.

## Related Decisions

- [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): canonical methodology and generated projections.
- [CORE-022](ADR-CORE-022-agent-plugins-portable-projection.md): portable format and host-owned runtime boundaries. This decision supersedes its separate-package topology while preserving those boundaries.
- [CORE-020](ADR-CORE-020-hybrid-package-topology.md): narrow sharing boundaries remain in force; CORE-034 supersedes its older Hermes, OMP, and Prime Agent distribution-status claims.
- Host plugin references: [Claude Code components](https://code.claude.com/docs/en/plugins/components), [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins), [Cursor plugins](https://cursor.com/docs/reference/plugins.md), [Kimi Code plugins](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html) ([plugin agents](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html#plugin-agents)), [ZCode plugins](https://zcode.z.ai/en/docs/plugin), [Oh My Pi plugin documentation](https://omp.sh/docs/plugins), [Devin file format](https://docs.devin.ai/cli/extensibility/plugins/overview) ([Customize product guide](https://docs.devin.ai/product-guides/plugins)).

## Date

2026-10-10; amended 2026-10-11 and 2026-10-12.

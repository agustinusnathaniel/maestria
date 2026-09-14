# Session Record: Building `@maestria/opencode` (2026-06-12)

**Status:** Historical. The architectural decisions from this session are recorded in [ADR-CORE-001](../adr/core/ADR-CORE-001-global-rules-scope.md), [ADR-CORE-002](../adr/core/ADR-CORE-002-plugin-architecture.md), and [ADR-CORE-003](../adr/core/ADR-CORE-003-agent-conventions.md); current behavior is in `packages/opencode/` and its README. [verified] 2026-09-14: those three ADRs are Accepted and record the plugin-architecture, rules-scope, and agent-convention decisions from this session.

## Durable lessons

- Programmatic agent registration through the `config` hook replaced postinstall file copying: no filesystem side effects outside the npm package and no stale files.
- Shallow agent prompts were rejected; agent definitions must carry the full methodology, not 30-50 line summaries.
- Skills are not bundled in the plugin; users install them separately (see ADR-CORE-003).
- Arbitrary limits (for example the builder's initial "1-2 file edits" rule) were replaced by the atomic-task scope now used in the canonical directives.
- Model tiering is user configuration, not a plugin rule (ADR-CORE-001).
- Plugin API shapes were verified against `@opencode-ai/plugin` types; the package source and SDK types supersede the snippets this record originally held.

## Next step

None - informational. Use the ADRs and current package source.

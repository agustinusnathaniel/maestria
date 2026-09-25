# ADR-CORE-000: Architecture Decision Record Structure

## Status

Accepted (2026-06-18)

## Context

As more plugins land (opencode, kimi-code, future Cursor/Copilot variants), a flat `docs/adr/` directory becomes hard to navigate. Plugin-specific decisions mix with cross-cutting ones, and a pre-existing duplicate under the old flat naming scheme (what was then ADR-004 existed for both opencode and kimi-code) made upstream collision resolution brittle and required manual renumbering.

## Decision

ADRs use **prefix-scoped numbering** with one subdirectory per namespace:

### Subdirectory Layout

| Subdirectory          | Prefix | Scope                                                         |
| --------------------- | ------ | ------------------------------------------------------------- |
| `docs/adr/core/`      | CORE   | Cross-cutting decisions (global rules, architecture, etc.)    |
| `docs/adr/opencode/`  | OC     | `@maestria/opencode` plugin-specific decisions                |
| `docs/adr/kimi-code/` | KC     | `@maestria/kimi-code` plugin-specific decisions               |
| `docs/adr/cursor/`    | CR     | `@maestria/cursor` plugin-specific decisions                  |
| `docs/adr/hermes/`    | HM     | `@maestria/hermes` plugin-specific decisions                  |
| `docs/adr/pi/`        | PI     | `@maestria/pi` + `@maestria/omp` extension-specific decisions |

### Numbering Rules

- Each subdirectory has its own **prefix** and restarts at `000`.
- File names follow the pattern: `ADR-{PREFIX}-{NNN}-{slug}.md`
- Example headings: `# ADR-CORE-000`, `# ADR-OC-001`, `# ADR-KC-002`
- Prefix-scoping inherently prevents cross-directory number collisions - no manual renumbering needed when adding ADRs to different subdirectories.

### Current Prefix Assignments

Prefixes: CORE (Core, `docs/adr/core/`), CR (Cursor, `docs/adr/cursor/`), HM (Hermes, `docs/adr/hermes/`), OC (Opencode, `docs/adr/opencode/`), KC (Kimi Code, `docs/adr/kimi-code/`), PI (Pi + OMP, `docs/adr/pi/`). A new plugin (e.g. Cursor) gets its own subdirectory and prefix without disturbing existing ADRs.

## Consequences

- Plugin-specific ADRs are scoped under their plugin's subdir, making ownership and discoverability clearer.
- Prefix-scoping eliminates cross-directory number collisions - no conflict resolution or renumbering needed.
- Cross-references between ADRs use relative paths; see existing ADRs for examples (e.g. `core/ADR-CORE-001-...` referenced from a `kimi-code/` ADR uses `../core/...`).

## Related Decisions

- ADR directories (the current list lives in each subdirectory; do not enumerate ADRs here): [core](./), [opencode](../opencode/), [kimi-code](../kimi-code/), [cursor](../cursor/), [hermes](../hermes/), [pi](../pi/).
- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) - extends this layout with the shared core content package.
- [ADR-CORE-018](ADR-CORE-018-documentation-standard.md) - documents ADRs as a doc type under the documentation standard.

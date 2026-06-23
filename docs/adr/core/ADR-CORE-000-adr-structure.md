# ADR-CORE-000: Architecture Decision Record Structure

## Status

Accepted (2026-06-18)

## Context

As more plugins land (opencode, kimi-code, future Cursor/Copilot variants), a
flat `docs/adr/` directory becomes hard to navigate. ADRs for different plugins
have no clear separation, and cross-cutting decisions get mixed with
plugin-specific ones. A pre-existing duplicate under the old flat naming scheme (what was then ADR-004 existed for both opencode and
kimi-code) made the flat layout actively confusing — upstream collision
resolution was brittle and required manual renumbering.

## Decision

ADRs use **prefix-scoped numbering** with one subdirectory per namespace:

### Subdirectory Layout

| Subdirectory          | Prefix | Scope                                                      |
| --------------------- | ------ | ---------------------------------------------------------- |
| `docs/adr/core/`      | CORE   | Cross-cutting decisions (global rules, architecture, etc.) |
| `docs/adr/opencode/`  | OC     | `@maestria/opencode` plugin-specific decisions             |
| `docs/adr/kimi-code/` | KC     | `@maestria/kimi-code` plugin-specific decisions            |
| `docs/adr/pi/`        | PI     | `@maestria/pi` extension-specific decisions                |

### Numbering Rules

- Each subdirectory has its own **prefix** and restarts at `000`.
- File names follow the pattern: `ADR-{PREFIX}-{NNN}-{slug}.md`
- Example headings: `# ADR-CORE-000`, `# ADR-OC-001`, `# ADR-KC-002`
- Prefix-scoping inherently prevents cross-directory number collisions — no
  manual renumbering needed when adding ADRs to different subdirectories.

### Current Prefix Assignments

| Prefix | Name      | Subdirectory          | ADR Range |
| ------ | --------- | --------------------- | --------- |
| CORE   | Core      | `docs/adr/core/`      | 000–004   |
| OC     | Opencode  | `docs/adr/opencode/`  | 000–004   |
| KC     | Kimi Code | `docs/adr/kimi-code/` | 000–001   |
| PI     | Pi        | `docs/adr/pi/`        | 000–002   |

A new plugin (e.g. Cursor) gets its own subdirectory and prefix (e.g.
`docs/adr/cursor/`, prefix `CR`, range 000–0xx) without disturbing
existing ADRs.

## Consequences

- Plugin-specific ADRs are scoped under their plugin's subdir, making ownership
  and discoverability clearer.
- Prefix-scoping eliminates cross-directory number collisions — no conflict
  resolution or renumbering needed.
- A new plugin (e.g. Cursor) gets its own subdir and prefix without disturbing
  existing ADRs.
- Cross-references between ADRs use relative paths; see existing ADRs for
  examples (e.g. `core/ADR-CORE-001-...` referenced from a `kimi-code/` ADR
  uses `../core/...`).

## Related Decisions

- ADR-CORE-001 (global rules scope)
- ADR-CORE-002 (plugin architecture)
- ADR-CORE-003 (agent conventions)
- ADR-CORE-004 (agent prompt template)
- ADR-OC-000 (skill install flow)
- ADR-OC-001 (tool permission design)
- ADR-OC-002 (opensrc vs webfetch guidance)
- ADR-OC-003 (keyword-triggered workflow modes)
- ADR-OC-004 (commit authorization rules)
- ADR-KC-000 (kimi-code distribution)
- ADR-KC-001 (kimi-code architecture)
- ADR-PI-000 (pi ecosystem reuse)
- ADR-PI-001 (rules injection)
- ADR-PI-002 (compaction state preservation)

# ADR-000: Architecture Decision Record Structure

## Status

Accepted (2026-06-18)

## Context

As more plugins land (opencode, kimi-code, future Cursor/Copilot variants), a
flat `docs/adr/` directory becomes hard to navigate. ADRs for different plugins
have no clear separation, and cross-cutting decisions get mixed with
plugin-specific ones. A pre-existing duplicate `ADR-004` (one opencode, one
kimi-code) makes the flat layout actively confusing.

## Decision

ADRs are organized into three subdirectories:

- `docs/adr/core/` — cross-cutting decisions that apply to all maestria plugins
  (global rules, plugin architecture, conventions, agent prompt template).
- `docs/adr/<plugin>/` — plugin-specific decisions. One subdirectory per plugin:
  `opencode/`, `kimi-code/`, etc.
- ADR numbering remains flat and chronological, not per-subdir. The pre-existing
  `ADR-004` (core/ADR-004-agent-prompt-template) takes precedence; the kimi-code architecture ADR
  (originally also numbered 004) was initially renumbered to `ADR-009` to resolve
  the conflict.

### Collision Resolution (2026-06-22)

When upstream opencode ADRs (ADR-008 keyword-triggered workflow modes, ADR-009
commit authorization rules) were merged from main, their numbers collided with
the kimi-code ADRs that had been assigned ADR-008/ADR-009. Resolution:

- **Opencode ADRs keep their original numbers** (ADR-008, ADR-009) — matching
  main's canonical numbering.
- **Kimi-code ADRs move to the next available numbers**: ADR-008 (distribution)
  → ADR-010, ADR-009 (architecture) → ADR-011.

This ensures main's ADR numbering remains canonical and kimi-code-specific ADRs
occupy numbers that do not conflict with any opencode decisions.

## Consequences

- Plugin-specific ADRs are scoped under their plugin's subdir, making ownership
  and discoverability clearer.
- The flat numbering preserves historical order (later decisions get higher
  numbers regardless of which subdir they live in).
- A new plugin (e.g. Cursor) gets its own subdir without disturbing existing
  ADRs.
- Cross-references between ADRs need relative paths; see existing ADRs for
  examples (e.g. `core/ADR-001-...` from a `kimi-code/` ADR uses
  `../core/...`).

## Related Decisions

- ADR-001 (global rules scope)
- ADR-002 (plugin architecture)
- ADR-008 (keyword-triggered workflow modes)
- ADR-009 (commit authorization rules)
- ADR-010 (kimi-code distribution)
- ADR-011 (kimi-code architecture)

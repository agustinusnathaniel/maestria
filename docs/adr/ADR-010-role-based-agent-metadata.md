# ADR-010: Role-Based Agent Metadata — Thinker/Worker/Verifier Roles

**Status**: Proposed

## Context

The plugin routes by task type (trigger phrases) alone, not by cognitive role. A user who needs "a Verifier for this" has only one path — `@reviewer` — because "verify" maps to reviewer by keyword. But what if the user wants a design verified before implementation? The current model can't express "I need a Thinker for this" separate from "I need an Architect." The existing maker/checker split (ADR-004, ADR-009) already encodes role separation in prose rules; role-based metadata formalizes it machine-readably.

## Decision

Add `role` as an optional string field in agent YAML frontmatter. Valid values: `thinker`, `worker`, `verifier`. Default: `worker`. The plugin parses and validates the field against known roles but does not enforce behavior — routing remains prompt-level in the orchestrator.

Frontmatter schema change (one field in the `AgentFrontmatter` interface):

```typescript
interface AgentFrontmatter {
  description: string;
  mode: string;
  role?: 'thinker' | 'worker' | 'verifier'; // NEW
  permission: Record<string, unknown>;
  color?: string;
  maxSteps?: number;
}
```

The parser treats unknown or missing role values as `worker`, ensuring backward compatibility.

Agent-to-role mapping:

| Agent         | Role     |
| ------------- | -------- |
| `@adventurer` | thinker  |
| `@architect`  | thinker  |
| `@builder`    | worker   |
| `@diagnose`   | thinker  |
| `@planner`    | thinker  |
| `@reviewer`   | verifier |
| `@writer`     | worker   |

The orchestrator prompt gains a Role column in its delegation table and a role-based routing rule: when a specific cognitive role is needed (e.g., "verify this design"), delegate to the specialist whose role matches, even if the trigger phrase suggests a different agent. Global rules (`rules/AGENTS.md`) get the same Role column for cross-cutting visibility.

## Consequences

- **Good**: Agents self-declare cognitive role as machine-readable metadata. Orchestrator can route by role ("I need a Verifier") not just by trigger phrase. Backward compatible — default `worker` means zero migration. Prompt-level routing keeps the plugin lean (consistent with ADR-002). Role metadata visible across agent files, orchestrator prompt, and global rules.
- **Bad**: No enforcement — orchestrator can still ignore role assignments. Single-role declaration is reductive (agents like `@diagnose` both think and verify). One more frontmatter field to maintain across 7 agent files. Marginal token overhead in frontmatter parsing and prompt tables.
- **Risks**: Role inflation — unrecognized roles silently default to `worker` with no error. Stale role assignments as prompts evolve (mitigated: role is a hint, not a constraint). Over-reliance on roles may skip trigger-phrase precision for domain-specific delegation (mitigated: prompt says trigger phrases take precedence).

## Date

2026-06-22

---
description: Pass outcome, constraints, evidence, blockers, and next steps between workflow stages
name: handoff
---

<!-- Generated from packages/core/agent-directives by scripts/sync-consolidated-plugin.ts. Do not edit directly. -->

# Handoff Aid

Use a handoff when another agent or later step needs context. Include only:

- **Outcome** - what must be achieved and why
- **Context and constraints** - relevant paths, decisions, and boundaries
- **Acceptance and evidence** - how completion will be verified
- **Assumptions or blockers** - only material uncertainty or missing input
- **Next step** - who or what follows

Keep it concise, reference existing artifacts instead of copying history, and
proceed on ordinary ambiguity after documenting a material assumption.

For an optional contract header shape, see the available `spec-contract` skill; still optional and absence is normal.

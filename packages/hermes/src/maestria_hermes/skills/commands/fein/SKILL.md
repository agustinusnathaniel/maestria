---
name: maestria-command-fein
description: "Full pipeline mode: reconnaissance, design, implementation, review"
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

[MODE: fein]

## MODE: fein (Full Pipeline)

Default role-based pipeline: thinker (recon/design/plan) -> worker (implementation) -> verifier (review). Verifier acceptance terminates the pipeline for that unit of work. Roles and order may adapt to task needs - this is the default, not a fixed requirement. Do NOT skip any phase unless the user explicitly overrides in the same turn.

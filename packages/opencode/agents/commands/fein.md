<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

---
name: fein
description: Full pipeline - recon, design, implement, review
pipeline: thinker (recon/design/plan) -> worker (implementation) -> verifier (review)
precedence: mode marker overrides trigger phrases
detection: case-insensitive keyword, [MODE: fein] marker injected at front of message
---

[MODE: fein]

## MODE: fein (Full Pipeline)

Default role-based pipeline: thinker (recon/design/plan) -> worker (implementation) -> verifier (review). Verifier acceptance terminates the pipeline for that unit of work. Roles and order may adapt to task needs - this is the default, not a fixed requirement. Do NOT skip any phase unless the user explicitly overrides in the same turn.

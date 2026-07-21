---
name: fein
description: "Full pipeline mode: recon, design, implement, review"
type: prompt
whenToUse: When the user types /fein or includes "fein" in their message to run the complete maestria pipeline.
arguments: []
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

**Skill profile:** `plan` - sets workflow mode to fein. You have Read, Glob, Grep, Bash, FetchURL, and WebSearch.

[MODE: fein]

## MODE: fein (Full Pipeline)

Default role-based pipeline: thinker (recon/design/plan) -> worker (implementation) -> verifier (review). Verifier acceptance terminates the pipeline for that unit of work. Roles and order may adapt to task needs - this is the default, not a fixed requirement. Do NOT skip any phase unless the user explicitly overrides in the same turn.

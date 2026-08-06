---
name: fein
description: "Full pipeline mode: recon, design, implement, review"
type: prompt
whenToUse: When the user types /fein or includes "fein" in their message to run the complete maestria pipeline.
arguments: []
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

**Skill profile:** `plan` - workflow mode command. You have Read, Glob, Grep, Bash, FetchURL, and WebSearch.

[MODE: fein]

## MODE: fein (Full Pipeline)

Explicit selection of the `full` route. Use one thinker suited to the concern, one worker, and one independent reviewer. The reviewer receives the original requirements, acceptance criteria, and diff, not the maker's self-assessment. Triage findings as `[fix]`, `[dismiss]`, or `[escalate]`; allow at most three bounded cycles, fail loud on unresolved `[fix]` findings, and block landing on any unresolved `[escalate]` finding until its required decision is recorded. Do not silently ship the last attempt. Add specialists or review lenses only when concrete evidence identifies additional risk. Scale expensive or slow models down to one review pass.

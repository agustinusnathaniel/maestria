---
name: blitz
description: "Fast implementation mode: skip recon/design unless unknown"
type: prompt
whenToUse: When the user types /blitz or includes "blitz" in their message for fast implementation.
arguments: []
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

**Skill profile:** `plan` - workflow mode command. You have Read, Glob, Grep, Bash, FetchURL, and WebSearch.

[MODE: blitz]

## MODE: blitz (Fast Implementation)

Speed mode: skip reconnaissance and design gates. Go directly to builder for implementation. Only use adventurer if the codebase context is genuinely unknown (not as a default step). Skip reviewer unless the user explicitly requests review.

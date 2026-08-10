---
name: blitz
description: "Fast implementation mode: skip optional ceremony for familiar low-risk work; preserve safety and review floors"
type: prompt
whenToUse: When the user types /blitz or includes "blitz" in their message for fast implementation.
arguments: []
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

**Skill profile:** `plan` - workflow mode command. Use direct responses for explanation/discovery; route code changes to the `builder` coder via `Agent()`. You have Read, Glob, Grep, Bash, FetchURL, and WebSearch.

[MODE: blitz]

## MODE: blitz (Fast Implementation)

Activate the low-risk bypass. Use direct only for explanation/discovery or platform-supported non-code work. Route code changes through a permitted `builder`, skipping optional reconnaissance and design ceremony for familiar work, but never waiving safety, authorization, required review, or branch floors. Escalate safety exceptions to the normal route.

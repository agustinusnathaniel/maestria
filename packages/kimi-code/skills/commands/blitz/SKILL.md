---
name: blitz
description: "Fast implementation mode: skip optional recon/design unless unknown; required review remains"
type: prompt
whenToUse: When the user types /blitz or includes "blitz" in their message for fast implementation.
arguments: []
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

**Skill profile:** `plan` - workflow mode command. You have Read, Glob, Grep, Bash, FetchURL, and WebSearch.

[MODE: blitz]

## MODE: blitz (Fast Implementation)

Use direct execution for familiar, low-risk code or other work when the host permits it; otherwise delegate to the permitted specialist. Skip optional reconnaissance and design ceremony, but never waive safety, authorization, required review, or branch floors. Escalate safety exceptions to the normal route.

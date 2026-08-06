---
name: blitz
description: Direct zero-child execution with independent landing review before shipping
type: prompt
whenToUse: When the user types /blitz or includes "blitz" in their message for fast implementation.
arguments: []
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

**Skill profile:** `plan` - workflow mode command. You have Read, Glob, Grep, Bash, FetchURL, and WebSearch.

[MODE: blitz]

## MODE: blitz (Fast Implementation)

Explicit `direct` route for familiar, low-risk work. Execute on the host or use the platform's native direct capability. Never delegate to `builder` or any other Maestria specialist from blitz.

Safety floors still apply. Blitz does not waive security review, migration care, permission changes, production impact checks, or checkpoints for irreversible changes. A direct implementation that will land must escalate to an independent reviewer before landing, while blitz execution itself remains zero-child. Normal implementation requests authorize autonomous shipping unless the user limits the work to research-only, no-commit, or no-ship.

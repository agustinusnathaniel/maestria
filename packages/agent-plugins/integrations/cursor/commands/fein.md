---
name: fein
description: Run the full maestria pipeline (recon -> design -> implement -> review)
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

[MODE: fein]

Load the `orchestrator` and `fein` skills through the active host's skill loader, then apply them to the user's request. Preserve the user's goal, constraints, and arguments. If either required skill cannot be loaded, report the missing skill and stop before acting.

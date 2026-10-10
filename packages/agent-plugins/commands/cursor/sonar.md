---
name: sonar
description: Research-only maestria mode (recon -> design, no implementation)
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

[MODE: sonar]

Load the `orchestrator` and `sonar` skills through the active host's skill loader, then apply them to the user's request. Preserve the user's goal, constraints, and arguments. If either required skill cannot be loaded, report the missing skill and stop before acting.

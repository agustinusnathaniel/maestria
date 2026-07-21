<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

---
name: sonar
description: Research only - recon, design, STOP before implementation
pipeline: recon (@adventurer) -> design/plan (@architect/@planner) -> STOP
precedence: mode marker overrides trigger phrases
detection: case-insensitive keyword, [MODE: sonar] marker injected at front of message
---

[MODE: sonar]

## MODE: sonar (Research Only)

Research mode: reconnaissance and design only. Delegate to @adventurer (recon) followed by @architect or @planner (analysis/design). STOP after delivering findings and design. Do NOT implement, write code, or create any production files.

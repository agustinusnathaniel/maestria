---
name: sonar
description: Research only - owning specialist, optional distinct specialist, STOP before implementation
pipeline: owning research specialist -> optional distinct specialist -> STOP
precedence: mode marker overrides trigger phrases
detection: case-insensitive keyword, [MODE: sonar] marker injected at front of message
---

[MODE: sonar]

## MODE: sonar (Research Only)

Activate research-only mode. Start with the owning specialist, add a second only for a distinct unresolved required output, then stop. Do not implement, write code, or create production files.

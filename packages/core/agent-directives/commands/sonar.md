---
name: sonar
description: Research only - owning specialist, optional distinct specialist, STOP before implementation
pipeline: owning research specialist -> optional distinct specialist -> STOP
precedence: mode marker overrides trigger phrases
detection: case-insensitive keyword, [MODE: sonar] marker injected at front of message
---

[MODE: sonar]

## MODE: sonar (Research Only)

Research mode: research only. Start with the specialist that owns the research question. Add a second specialist only for a distinct unresolved required output. STOP after the required research output is delivered. Do NOT implement, write code, or create any production files.

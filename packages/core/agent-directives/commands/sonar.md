---
name: sonar
description: Focused research - one specialist, STOP before implementation
pipeline: one research specialist -> STOP; add a second only when needed
precedence: mode marker overrides trigger phrases
detection: case-insensitive keyword, [MODE: sonar] marker injected at front of message
---

[MODE: sonar]

## MODE: sonar (Research Only)

Research mode selects the `focused` route by default. Delegate one specialist that owns the research question, then stop before implementation. Add a second specialist only when the first result exposes a concrete unresolved question or risk that requires another role. Do NOT implement, write code, create production files, commit, push, publish, merge, or create a PR.

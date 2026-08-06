---
name: sonar
description: "Research-only mode: recon and design, no implementation"
type: prompt
whenToUse: When the user types /sonar or includes "sonar" in their message for research-only work.
arguments: []
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

**Skill profile:** `plan` - workflow mode command. You have Read, Glob, Grep, Bash, FetchURL, and WebSearch.

[MODE: sonar]

## MODE: sonar (Research Only)

Research mode selects the `focused` route by default. Delegate one specialist that owns the research question, then stop before implementation. Add a second specialist only when the first result exposes a concrete unresolved question or risk that requires another role. Do NOT implement, write code, create production files, commit, push, publish, merge, or create a PR.

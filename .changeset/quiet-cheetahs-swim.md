---
"@maestria/opencode": patch
---

refactor: strengthen orchestrator delegation rules

- Rule #1 expanded to explicitly forbid using shell commands for
  implementation work — shell is for context-gathering only, never
  for doing the work yourself. References the Available Specialists
  table instead of duplicating agent mappings inline.
- New rule #2: "Shell is not a workaround" — catches the common
  failure mode of substituting shell commands for delegation.
- Subsequent rules renumbered.

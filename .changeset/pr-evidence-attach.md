---
"@maestria/agent-plugins": patch
"@maestria/opencode": patch
"@maestria/pi": patch
---

On GitHub, agents now upload PR visual evidence with `gh pr create --attach` or `gh pr edit --attach` instead of committing screenshots to the branch, and every PR in a stack carries its own evidence. UI changes default to a before/after table (Area | Before | After | What changed).

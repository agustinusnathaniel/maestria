---
"@maestria/agent-plugins": minor
"@maestria/opencode": minor
"@maestria/pi": minor
---

Agents now keep your work safe and follow a few habits you kept asking for: they never `git reset`, restore, clean, revert, or force-push existing work unless you asked for that operation; they let repository hooks run instead of bypassing them; and the delivery owner waits for CI after each push and fixes or reports failures before calling delivery complete. They answer your direct questions before continuing, never shrink requested work by human time estimates, re-check their claims when you say "cmiiw", and fix pre-existing failures in the files and checks a change touches instead of stopping at them.

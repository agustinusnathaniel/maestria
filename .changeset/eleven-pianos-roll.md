---
'@maestria/pi': patch
---

Fix subagent dispatch error handling: catch block now logs the actual error instead of always reporting "Subagent SDK not available"

Add null guard in tool interceptor to prevent crashes on malformed bash events

Remove redundant build-rules.ts codegen step: rules are now read directly from rules/AGENTS.md

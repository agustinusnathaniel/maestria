---
"@maestria/opencode": patch
---

Add websearch:ask for architect, adventurer, and diagnose agents — these discovery-oriented agents can now search the web (with user prompt via `ask` permission) to find relevant documentation and resources.

Grant read/glob/grep to orchestrator — the orchestrator now has read-only reconnaissance tools for quick verification before delegation, with structural safeguards (edit/webfetch/lsp remain denied, 3-call limit).

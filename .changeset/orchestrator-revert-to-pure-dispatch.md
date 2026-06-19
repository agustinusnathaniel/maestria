---
"@maestria/opencode": patch
---

Revert orchestrator to pure dispatcher — after real-world testing, read/glob/grep
permissions on the orchestrator caused workaround behavior (preferring direct
recon over delegation to specialist agents). The experiment confirmed that
structural permission denial is the only reliable enforcement for an LLM-based
orchestrator. The orchestrator remains limited to task() delegation and
question() — no read, glob, grep, webfetch, edit, or lsp.

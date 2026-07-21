---
'@maestria/core': patch
'@maestria/opencode': patch
'@maestria/kimi-code': patch
'@maestria/pi': patch
'@maestria/hermes': patch
---

Compact agent directives to cut context usage (~38% on the orchestrator prompt) without removing rules or intent. The orchestrator consolidates 15 critical rules into 11 and merges the commit, review, and routing guidance into single sections. Shared specialist rules (maker/checker split, handoff validation, ambiguity handling, escalation format, tool routing) now live once in the global rules instead of being repeated per specialist. Also fixes duplicate skill prescriptions in diagnose and architect, a formatting bug in the global rules, and stale cross-references.

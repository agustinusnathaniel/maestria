---
'@maestria/core': patch
'@maestria/opencode': patch
'@maestria/pi': patch
'@maestria/kimi-code': patch
---

Mandate Work Results table format in orchestrator directive

Added a `!!!` CRITICAL RULE (#14) anchoring the output summary format,
strengthened the Work Results section mandate, and integrated it into
the COMMIT PROTOCOL step 5. The new rule overrides "write for humans"
guidance for this specific output to ensure consistent builder task summaries.

Also fixed a stale "step 1a" cross-reference in CRITICAL RULE #12 to point
to the correct commit protocol step (step 2), and added a documentation
audit item to the project checklist.

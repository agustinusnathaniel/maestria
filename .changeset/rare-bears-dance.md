---
'@maestria/core': patch
'@maestria/opencode': patch
'@maestria/kimi-code': patch
'@maestria/pi': patch
---

refactor: improve Work Results output format for scanning and PR reuse

Restructured the Work Results section from a 3-part narrative format (Overview, File-by-file, Cohesion) to a lean table-first format optimized for scanning instead of reading the diff. Added signature-style notation, change-type prefixes (+/~/-), breaking change markers (!), and test file annotations ((test)). Updated COMMIT PROTOCOL steps 5 and 7 to embed the Work Results table in PR descriptions. Broadened "What changed" column scope to cover deletions, new files, config changes, and dependencies.

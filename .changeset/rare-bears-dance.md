---
'@maestria/core': patch
'@maestria/opencode': patch
'@maestria/kimi-code': patch
'@maestria/pi': patch
---

refactor: improve Work Results output format for scanning and PR reuse

Restructured the Work Results section from a 3-part narrative format (Overview, File-by-file, Cohesion) to a lean table-first format optimized for scanning instead of reading the diff. Added signature-style notation, change-type prefixes (+/~/-), breaking change markers (!), and test file annotations ((test)). The Work Results table is now reused as the `## Changes` section in PR descriptions per existing COMMIT PROTOCOL step 7.

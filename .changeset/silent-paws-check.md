---
'@maestria/core': patch
---

Sync pipeline now detects hand-edited platform files. The check-sync
verifies that synced copies were generated from canonical source,
not hand-edited - catching mismatches before CI fails.

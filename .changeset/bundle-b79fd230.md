---
"maestria": patch
---

Bundle CLI runtime dependencies (effect, @clack/prompts, citty, picocolors) into output instead of externalizing them. End users no longer download 8.2 MB of transitive dependencies at install time, and the `msgpackr-extract` build script warning is eliminated.

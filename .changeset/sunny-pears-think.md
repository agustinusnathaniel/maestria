---
'@maestria/maestria-cli': patch
---

feat: add semver-compliant version comparison using localeCompare with numeric option

Replaces string-based version comparison with localeCompare-based utilities
that handle numeric segment ordering (0.10.0 > 0.9.0) and prerelease ordering
(1.0.0-alpha < 1.0.0) correctly per the semver specification.

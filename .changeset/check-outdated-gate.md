---
'maestria': patch
---

feat(cli): `maestria check` detects outdated installs

The check command fetched each plugin's latest published version but never compared it against the installed version, so CI and AI-agent consumers had no machine-readable staleness signal. Single-platform and --all checks now report an `outdated` flag in JSON, print an explicit update hint, show an Outdated column in the status table, and exit 3 when a newer version exists (0 = installed and current; 1 = not installed, unavailable, or unknown platform, unchanged from today; nothing exits 2).

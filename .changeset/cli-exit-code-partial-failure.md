---
'maestria': patch
---

fix(cli): exit non-zero when install/update/uninstall have partial failures

The install, update, and uninstall commands always exited 0 even when a platform result failed, contradicting the documented exit-code contract. They now exit 1 when any per-platform result is ok:false, so CI and AI-agent consumers can detect partial failure from the exit code alone (matching the check command).
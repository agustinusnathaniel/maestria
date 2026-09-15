---
"maestria": patch
---

Fix `maestria update` falsely reporting failure for host plugin upgrades. The OpenCode update ran under the shared 30s command timeout while cold plugin fetches take tens of seconds, so the host was killed mid-install after the new payload was already written (a retry then reported "up to date"). All host plugin install/update commands (OpenCode, Claude Code, Codex CLI, Hermes) now share the generous 120s deadline, and failed commands report the exit code or timeout plus the captured stderr/stdout instead of a bare "Command failed" message.

---
'@maestria/shared-pi': minor
'@maestria/pi': minor
'@maestria/omp': minor
---

Enforce pure dispatcher pattern on Pi and OMP with auto-detect mode keywords

- **Pure dispatcher enforcement**: when a workflow mode (fein/sonar/blitz) is active, the orchestrator is now restricted to only delegation tools (`maestria_subagent`/`task`). Implementation tools like `bash`, `edit`, and `write` are blocked at the tool level, enforcing the maker/checker split automatically.
- **Auto-detect mode keywords**: type `fein do X` at the start of any message and the plugin automatically strips the keyword and injects the mode prompt inline. No slash command needed.
- **Refactor Pi and OMP plugins** to share common infrastructure behind the scenes, ensuring consistent behavior across both platforms.

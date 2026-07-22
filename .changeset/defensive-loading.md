@maestria/opencode: patch
@maestria/pi: patch
@maestria/omp: patch
---
refactor: defer module-level file I/O to prevent fatal-yet-silent plugin loading failures

Module-level readFileSync and homedir() calls across opencode, pi, and omp
platforms could crash the entire plugin at import time if files were missing
or the runtime lacked the required API (e.g., findPackageJSON in Bun).

Changes:
- opencode: lazy-load mode prompts via Proxy with error fallback
- pi/omp: lazy-load mode prompts via getModePrompt() cache
- pi/omp: defer homedir() from module scope to function body
- opencode: add import-from-dist smoke test
- CI: add Bun smoke test job to catch runtime incompatibilities early

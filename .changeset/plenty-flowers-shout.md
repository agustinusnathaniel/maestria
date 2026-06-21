---
"@maestria/opencode": patch
---

Switch build from tsc to vp pack (tsdown), consolidate configs

- Replace tsc build with vp pack/tsdown for native @/ alias resolution
- Consolidate vitest.config.ts into single vite.config.ts with pack + test blocks
- Add integration tests for chat.message hook
- Remove tsconfig.build.json, verify-imports.sh (no longer needed)
- Add proper pack config (target, sourcemap, minify)
- Add dev watch script
- Simplify pre-push hook
- Remove redundant typecheck script (vp check covers it)

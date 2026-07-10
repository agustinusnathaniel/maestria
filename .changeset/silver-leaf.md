---
'@maestria/opencode': minor
---

Align OpenCode agent permissions with autonomous philosophy

Builder shell permissions expanded from 5 narrow patterns to a
comprehensive allow-list covering read-only file operations, git,
package managers (pnpm, npm), and build/test/lint tools (tsc, vitest,
vp, rtk, eslint, prettier). Both builder and diagnose keep *: ask
catch-all for unusual commands.

Diagnose edit permission changed from ask to allow.

Based on Claude Code's documented read-only command baseline and
maestria project's actual tooling needs (17,929 builder bash
invocations analyzed across 2,611 sessions).

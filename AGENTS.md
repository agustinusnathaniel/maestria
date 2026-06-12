<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project uses Vite+ (invoked via `vp`). Run `vp help` for commands.

Docs: `node_modules/vite-plus/docs` or https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes.
- [ ] Run `vp check` and `vp run -r test` before committing.
- [ ] If setup/runtime looks wrong, run `vp env doctor`.

<!--VITE PLUS END-->

# Project: maestria

Monorepo structure:

- **packages/opencode/** — `@maestria/opencode` plugin
- **docs/adr/** — Architecture Decision Records
- **apps/** — (reserved for future apps)

The `@maestria/opencode` plugin registers 7 subagents (agents/\*.md) via the `config` hook and injects global rules (rules/AGENTS.md) via the `system.transform` hook.

Key files:

- `packages/opencode/src/index.ts` — Plugin entry, frontmatter parser, agent loader
- `vite.config.ts` — Vite+ task/lint/fmt config
- `pnpm-workspace.yaml` — Catalog dependencies and workspace settings

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# Project: maestria

Monorepo structure:

- **packages/opencode/** — `@maestria/opencode` plugin
- **docs/adr/** — Architecture Decision Records
- **apps/** — (reserved for future apps)

The `@maestria/opencode` plugin registers 7 subagents (agents/\*.md) via the `config` hook and
injects global rules (rules/AGENTS.md) via `input.instructions`.

Key files:

- `packages/opencode/src/index.ts` — Plugin entry, frontmatter parser, agent loader
- `vite.config.ts` — Vite+ task/lint/fmt config
- `pnpm-workspace.yaml` — Catalog dependencies and workspace settings

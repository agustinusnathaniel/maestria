# Maestria Project Rules

Project-specific non-negotiable rules. These supplement the core agent rules and are propagated to all subagents via delegation prompt "Known problems" sections.

- `!!!` **Canonical source purity** - Edit canonical sources in `packages/core/agent-directives/` only. Never edit generated copies in `packages/opencode/agents/`, `packages/kimi-code/skills/`, `packages/pi/agents/`, or `packages/pi/skills/`. After editing, run `bash scripts/sync-all` to regenerate platform copies and `bash scripts/check-sync` to verify consistency. The sync pipeline exists to prevent drift; bypassing it creates technical debt.
- `!!!` **Sync pipeline correctness** - Run `scripts/check-sync` after every agent directive change. A corrupted sync breaks agents across all platforms. Accuracy matters more than speed.
- `!!!` **Full quality pipeline before every commit** - The delivery owner runs the gates in `docs/checklist.md` on the integrated result. Reuse passing evidence until affected files or acceptance conditions change.
- `!!!` **Changeset for user-facing changes** - Run `pnpm changeset` before committing any user-facing change. Only `feat` commits warrant a minor bump; all others are patch.
- `!!!` **Idempotent operations** - Running the same operation twice must produce the same result. Tasks must be safe to re-apply.
- `!!!` **Maker/checker split** - The implementer validates its work; a different specialist approves required review. Review meaningful implementation independently; low-risk formatting, comments, and mechanical non-behavioral edits need review only when risk is uncertain.

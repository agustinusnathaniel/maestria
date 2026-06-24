# Completion Checklist

Before marking any task as complete in this repo:

- [ ] Quality pipeline passes (`vp test`, `pnpm typecheck`, `pnpm build`, `pnpm lint`, `pnpm check`)
- [ ] If editing canonical agent directives: `scripts/sync-all` run && `scripts/check-sync` passes
- [ ] If adding/removing files: `package.json` files array and export map are up to date
- [ ] If changing agent prompts: README in `core/agent-directives/` is still accurate
- [ ] If introducing a new design decision: has a corresponding ADR been written?
- [ ] Changeset created if change is user-facing

# Completion Checklist

Before committing or delivering implementation in this repo, the delivery owner checks the integrated result. Read-only audits, research, and planning end at their requested artifact and need only checks relevant to that artifact:

- [ ] `pnpm check` passes (build, formatting, lint/type analysis, workspace tests, sync and manifest checks); `vp check` passes before commit. Reuse those results rather than rerunning their constituent commands unchanged.
- [ ] If editing canonical agent directives: `scripts/sync-all` run && `scripts/check-sync` passes
- [ ] If changing packaged or exported files: `package.json` files array and export map are up to date
- [ ] If changing agent prompts: README in `core/agent-directives/` is still accurate
- [ ] If introducing a new design decision: has a corresponding ADR been written?
- [ ] Documentation audit completed - checked READMEs, ADRs, changelogs, guides for needed updates
- [ ] Changeset created if change is user-facing

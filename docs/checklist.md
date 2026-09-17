# Completion Checklist

Before committing or delivering implementation, the delivery owner checks the integrated result. Read-only audits, research, and planning end at their requested artifact and need only artifact-relevant checks:

- [ ] `pnpm check` passes (build, formatting, lint/type analysis, workspace tests, sync and manifest checks); `vp check` passes before commit. Reuse those results rather than rerunning constituent commands unchanged.
- [ ] If editing canonical agent directives: run `scripts/sync-all`, then confirm `scripts/check-sync` passes
- [ ] If editing canonical agent directives: confirm before-after obligation dispositions (preserved/moved/consolidated/intentionally retired) with evidence and context reachability, per [directive change review](directive-change-review.md)
- [ ] If changing packaged or exported files: `package.json` files array and export map are up to date
- [ ] If changing agent prompts: README in `core/agent-directives/` is still accurate
- [ ] If introducing a new design decision: has a corresponding ADR been written?
- [ ] Documentation assessment completed for internal docs, user-facing docs (`apps/docs/`, package README), changelog/release notes (curated `changelog.mdx`, not generated `CHANGELOG.md`), and required changesets (`.changeset/`, published packages only): affected categories updated, plausible unaffected categories noted with reason; proportionate to the change
- [ ] Changeset created if change is user-facing

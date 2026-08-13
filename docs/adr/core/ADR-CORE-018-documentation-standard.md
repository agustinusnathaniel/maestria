# ADR-CORE-018: Documentation Standard and Content Catch-up

## Status

Accepted (2026-08-13)

## Context

The repository has grown into a multi-package, multi-platform monorepo, but its documentation is uneven. Internal guidance (`docs/guides/doc-format.md`) described the ADR template but not the full set of document types we produce; several publishable packages shipped READMEs with unrelated structures; the public Astro/Starlight docs site lacked a user-facing section for the newest package (`@maestria/prime-agent`); and the public changelog pages had not caught up with released artifacts.

As a result:

- Contributors could not tell what sections a plan, note, or guide requires without reading examples.
- Published READMEs ranged from `Motivation`/`Goals`/`Non-Goals` (opencode) to a bare feature list (pi, cursor), so consumers could not reliably find a package's support boundary, limitations, or development workflow.
- New packages had no user-facing docs until someone remembered to add them, and no checklist enforced that they ship with `index`, `getting-started`, `changelog`, and `contributing` pages.
- The docs site sidebar and LLM description omitted Prime Agent, and the public changelog.mdx pages referenced outdated or upcoming versions.

## Goals

1. Make the internal documentation rules explicit in `docs/guides/doc-format.md`: required ADR sections, required plan sections, required notes/guides sections, the internal-vs-public distinction, and `[verified]`/`[inferred]` evidence tagging.
2. Record this documentation standard as an ADR so the decision is auditable.
3. Add a user-facing docs section for `@maestria/prime-agent` (overview, installation, quick start, changelog, contributing) following existing Starlight conventions and preserving the package's verified-subset/support boundary.
4. Include Prime Agent in the docs sidebar and LLM description.
5. Catch up the public changelog.mdx pages so each currently released artifact is represented as a curated summary.
6. Standardize the ten publishable package READMEs onto a consistent, useful section order while preserving package-specific facts and commands.
7. Update the root `README.md` uninstall links and `CONTRIBUTING.md` stale package/version references.
8. Cover docs-related changes (`apps/docs/**` and `docs/**`) with a targeted docs-site build workflow so docs-only PRs, which `ci.yml`'s `paths-ignore` skips, still run a CI check.

## Non-Goals

- No changes to package source code, sync pipeline, generated projections, lockfiles, or existing CI workflows. A dedicated docs-site workflow (`.github/workflows/docs.yml`, see Decision) is added for docs-related changes; existing workflow files (`ci.yml` and its path filters) are left unchanged.
- No edits to any package `CHANGELOG.md`; the public changelog.mdx pages are curated summaries, not generated copies.
- No retrofitting of every legacy internal document; the standard applies to new and materially revised documents only.
- No programmatic enforcement of the documentation format (no new lint rules or format-validation CI checks). The targeted docs-site build workflow (see Decision) is a build smoke check for docs-related changes, not a format gate.
- No new package release claims or invented versions; changelog and README content reflect observed manifests.

## Decision

1. **Expand `docs/guides/doc-format.md`** into a complete internal documentation standard. It defines required sections for ADRs (Status, Context, Goals, Non-Goals, Decision, Consequences, Assumptions, Alternatives Considered, Date), plans (goal/scope/non-goals/dependencies/acceptance/verification/rollback/status), and notes/guides (purpose/audience/dated evidence/next step); requires `[verified]`/`[inferred]` tagging; separates internal rationale from public usage; and explicitly states that legacy docs are not retrofitted.

2. **Record the decision** in this ADR under `docs/adr/core/ADR-CORE-018-documentation-standard.md`, following the existing ADR numbering and format.

3. **Add a Prime Agent docs section** under `apps/docs/src/content/docs/prime-agent/`: `index.mdx`, `getting-started/installation.mdx`, `getting-started/quick-start.mdx`, `changelog.mdx`, and `contributing.mdx`, mirroring the structure of comparable packages (cursor, codex, claude-code). These pages state the package's `Native candidate` status, its verified skills + extension subset, and the deferred items (`rlm` dispatch, JSON/RPC headless mode), without claiming unsupported runtime enforcement.

4. **Update `apps/docs/astro.config.mjs`** to add a `@maestria/prime-agent` sidebar group and include Prime Agent in the `starlightLlmsTxt` description.

5. **Catch up the public changelog.mdx pages** so each currently released artifact is represented: CLI `0.9.0`, OpenCode `0.6.21`, Pi/OMP `0.6.8`/`0.4.3` on their combined page, Cursor `0.1.8`, Kimi Code `0.4.16`, Claude Code `0.2.1`, Codex `0.2.1`, Hermes `0.1.13`, and Core (using a consistent current/date heading, without inventing package release claims).

6. **Standardize the ten publishable READMEs** (`apps/maestria-cli`, `packages/opencode`, `packages/pi`, `packages/omp`, `packages/cursor`, `packages/kimi-code`, `packages/claude-code`, `packages/codex`, `packages/prime-agent`, `packages/hermes`) onto the mandatory section order: Motivation, Goals, Non-Goals, Status / Support Boundary, Installation or Usage, What It Provides, Limitations / Platform Notes, Development, Documentation and Changelog, License. Each README keeps its package-specific details and commands, links public docs and package changelogs where they exist, links `INSTALL.md` where the package ships one, and mentions canonical core directives for generated plugin packages. Versions are avoided in README prose except where needed for a support boundary.

7. **Update the root `README.md`** to add uninstall links for all published platform packages, and **update `CONTRIBUTING.md`** to fix stale package/version references and its docs/package contract/sidebar description, keeping the sidebar description accurate (manual-plus-autogenerated, not fully auto-generated).

8. **Add a targeted docs CI workflow** (`.github/workflows/docs.yml`) so docs-related changes get a build check. The workflow triggers on both `apps/docs/**` and `docs/**` - the root `ci.yml` `paths-ignore` skips both, so docs-only PRs would otherwise run no checks - and builds the docs site (`pnpm sync:docs` + `pnpm --filter @maestria/docs build`). The scope is deliberately bounded: the workflow is a build smoke check that catches broken links and build errors; it does not enforce this documentation format, does not run package tests, and the root `ci.yml` path filters are left unchanged. The site build also runs for `docs/**`-only changes even though root docs do not affect the site build, because GitHub Actions has no simple built-in per-path job conditional; the workflow comment records this trade-off.

## Consequences

### Positive

- Contributors get an explicit, discoverable documentation standard instead of inferring structure from examples.
- Consumers of every published package can find the same sections (motivation, support boundary, usage, limitations, development, license) regardless of platform.
- New packages have a defined docs contract (index/getting-started/changelog/contributing), so Prime Agent ships complete user-facing documentation.
- The docs site and public changelogs reflect current releases, reducing "which version is current" confusion.
- Root README and CONTRIBUTING no longer point at outdated versions or omit platforms.
- Docs-related changes (`apps/docs/**` and `docs/**`) now run a targeted build workflow instead of silently bypassing CI, while root `ci.yml` path filters are untouched.

### Negative

- The README standardization requires rewriting ten files, risking the loss of package-specific nuance if not done carefully (mitigated by preserving each package's truthful details and commands).
- Standardizing changelogs as curated summaries means the public pages can drift from the package `CHANGELOG.md` if not kept in sync during each release.
- The documentation standard adds a section checklist to new internal documents, increasing authoring overhead (consistent with the existing ADR overhead trade-off).
- The docs workflow builds the site even for `docs/**`-only changes that do not affect the site build; each such run costs a short build with no added coverage (accepted because a docs-only PR would otherwise run no checks at all).

## Assumptions

- The current package manifests reflect the released versions; the changelog pages use those observed versions rather than inventing release claims. `[verified]` against `package.json` `version` fields.
- The docs site uses `starlight-auto-sidebar` plus an explicit `sidebar` config; the sidebar and LLM description are maintained in `apps/docs/astro.config.mjs` and are manual-plus-autogenerated, not fully auto-generated. `[verified]` against the config file.
- Packages that ship an `INSTALL.md` (cursor, kimi-code, claude-code, codex, prime-agent) are linked from their READMEs; packages without one (opencode, pi, omp, hermes, cli) document installation inline. `[verified]` against the package directories.
- Generated plugin packages (opencode, kimi-code, omp, pi, cursor, claude-code, codex, prime-agent, hermes) are projected from canonical core directives; their READMEs mention this. `[verified]` against their `sync.config.ts`/generated output.

## Alternatives Considered

### Option A: Keep READMEs as-is and only fix what is broken

Rejected. The goal is cross-package coherence: consumers and agents should be able to find the same information in the same order in every published package. Leaving ten divergent READMEs perpetuates the discoverability gap that motivated this standard.

### Option B: Generate READMEs from package metadata via the sync pipeline

Rejected. READMEs are curated prose that carry support boundaries, platform notes, and limitations that do not live in `package.json`. Generating them would either strip that nuance or require embedding it in the pipeline config, which is a larger change with no clear benefit. The task explicitly keeps READMEs hand-authored and structurally coherent rather than identical.

### Option C: Auto-generate the changelog.mdx pages from package `CHANGELOG.md`

Rejected. The public changelog pages are curated, reader-facing summaries (e.g. combined Pi/OMP page, methodology changelog). Auto-generation would import changeset boilerplate and per-version noise that the public pages deliberately avoid. The task explicitly requires keeping them as curated summaries and forbids editing package `CHANGELOG.md`.

### Option D: Retrofit all legacy internal documents to the new standard

Rejected as out of scope. The cost of rewriting historical ADRs and notes outweighs the benefit; the standard applies to new and materially revised documents. Recorded in `doc-format.md` under Non-Goals.

## Related Decisions

- [ADR-CORE-000](ADR-CORE-000-adr-structure.md) - the ADR prefix/subdirectory layout this record follows.
- [ADR-CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md) - runtime support status and evidence referenced by package READMEs and the Prime Agent docs.
- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) - the sync pipeline that generates plugin projections; READMEs mention canonical core directives because of this.

## Date

2026-08-13

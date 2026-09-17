# Documentation Clarity Audit (2026-09-05)

**Status:** Completed one-time editorial audit. The findings and focused fixes were applied in the same change; the structural recommendations that remain are listed below.

## Outcome

[verified] Reviewed on 2026-09-05 against this checkout. The tracked inventory held 304 Markdown/MDX files, including generated projections; the public site lives in `apps/docs/`. The review covered root documents, contribution and agent instructions, internal guides, plans, notes, ADR structure, canonical agent documentation, platform READMEs and installation guides, and public site content. Applied changes: task-based entry links and a reordered package table in the root README, a new [engineering index](README.md), reordered installation guides, corrected public CLI comparison and quick-start descriptions, a template chooser in the [documentation conventions](guides/doc-format.md), condensed Prime Agent and Pi/OMP quick starts, and concrete public wording that preserves host-dependent routing and enforcement qualifications.

## Remaining recommendations

1. **Split the Hermes design document.** [hermes-maestria-plugin.md](hermes-maestria-plugin.md) is still a single record mixing current implementation, design philosophy, feature deep dives, and proposals. Extract a current contributor reference after checking each claim against source; keep the dated design history and link the two. Do not present the whole document as a setup guide.
2. **Resolve convention drift deliberately.** [ADR-CORE-018](adr/core/ADR-CORE-018-documentation-standard.md) records a mandatory README section order that differs from the current concise-landing-page convention. Add a superseding clarification rather than rewriting the accepted historical decision.
3. **Keep conditions near decisions.** Version restrictions, advisory-versus-enforced behavior, and destructive-removal boundaries stay next to the commands they govern; consolidate repeated rationale, not safety conditions. Choose document types by reader task (quick start, installation, reference, conceptual) and keep existing platform routes.

## Verification

[verified] `pnpm check` passed: builds, formatting, lint/type analysis, workspace tests, directive sync, and manifest/version checks. The documentation build produced 69 pages with internal site links valid, and the documentation suite passed 74 tests. Independent review found a missing working-directory instruction in the Prime Agent guide; it was fixed.

Link/build checks establish document integrity; they do not prove reader understanding or that every external platform claim is current.

## Next step

None - historical record. Current conventions live in the [documentation conventions](guides/doc-format.md), with decisions in the [ADRs](adr/).

# Documentation Format: Internal Conventions

## Purpose and audience

Use these conventions for new documents and substantial rewrites. Internal documentation preserves scope, rationale, and evidence; public documentation helps consumers install and use Maestria without repository context.

## Choose a template

- [Published package README](#published-package-readme): explain the package, installation, capabilities, and support boundaries.
- [ADR](#new-adrs): record a decision, its rationale, alternatives, and consequences.
- [Plan](#plans): define scoped work and how to verify and roll it back.
- [Note or guide](#notes-and-guides): record purpose, audience, dated evidence, and next step.

Apply the requirements below to new documents and substantive rewrites. Do not retrofit legacy documents solely to match a template. Changelogs keep their chronological format; JSDoc, docstrings, and inline comments are outside this guide. There is no format linter or schema gate. Put deliberately deferred work in **Future Considerations**, not **Non-Goals**.

These conventions make scope and rejected alternatives easier to review, and keep internal rationale from reading like a product promise. They add authoring overhead; the goal is recoverable reasoning, not uniform document length.

## Published package README

Published package READMEs are concise landing pages, not internal design records. Each README must cover:

| Information | What to include |
| --- | --- |
| Title and description | Package name and one-sentence purpose |
| Installation or usage | One canonical command or path, plus a short verification step when useful |
| What it provides | Shipped features, components, or artifacts |
| Support and platform notes | Material limits, provisional status, version boundaries, and whether controls are host-enforced or methodology-only |
| Documentation and release history | Public docs route and package changelog where available; otherwise state pre-release status |
| Development or contributing | Optional; link to repository guidance when useful |
| License | SPDX identifier |

Use package-specific headings and target roughly 40–80 lines. Avoid standalone Motivation, Goals, and Non-Goals sections, long architecture narratives, implementation details, and repeated role descriptions. Put detailed rationale in internal documents. Link `INSTALL.md` where a package ships one; describe generation and sync in the contributing guide, not the consumer README.

### README links

Published READMEs render outside the repository, so links to repository files must use canonical GitHub URLs: `https://github.com/agustinusnathaniel/maestria/blob/main/<path>`. Link user-facing docs at `https://maestria.sznm.dev/<route>/`. Verify each target. Relative links and bare filenames do not resolve as links in a published README; anchor-only links are fine. Internal docs may use relative links.

## New ADRs

Every new ADR must cover **Status, Context, Goals, Non-Goals, Decision, Consequences, Assumptions, Alternatives Considered, and Date**. Use `Proposed`, `Accepted`, or `Deprecated` for status; write the date as `YYYY-MM-DD`.

- Tag material assumptions `[verified]` or `[inferred]` so readers can distinguish evidence from best-effort conclusions.
- Record the alternatives deliberately rejected and why; preserve the evidence behind the decision.
- Add `Lessons Learned`, `Rollback`, `Verification`, or `Related Decisions` when they help explain or operate the decision.
- Do not rewrite historical ADRs just to match this template. Preserve their original context, decision, consequences, and date when revising them.

The `Context` heading is retained for compatibility with existing records. The original format drew on the [Agent Trace RFC](https://agent-trace.dev/) (Motivation → Goals → Non-Goals → Specification).

## Plans

Plans must define:

| Section      | What it records                                   |
| ------------ | ------------------------------------------------- |
| Goal         | A testable outcome                                |
| Scope        | Files, packages, and runtimes affected            |
| Non-Goals    | Deliberate exclusions                             |
| Dependencies | Prerequisites and external systems                |
| Acceptance   | Observable completion criteria                    |
| Verification | Checks tied to acceptance criteria                |
| Rollback     | How to revert the work                            |
| Status       | Draft, In review, In progress, Done, or Cancelled |

Plans are living documents: update their status as work progresses. A plan without a rollback step is not ready for implementation.

## Notes and guides

Notes and guides must state:

| Section        | What it records                                                                |
| -------------- | ------------------------------------------------------------------------------ |
| Purpose        | Why the document exists                                                        |
| Audience       | Who should read and act on it                                                  |
| Dated evidence | Facts and findings, their date and source, tagged `[verified]` or `[inferred]` |
| Next step      | Follow-up action or `None - informational`                                     |

Point-in-time claims need dates and sources so readers can judge whether they remain current.

## Evidence and detail

- Use `[verified]` for facts confirmed from code, documentation, a live run, or an immutable commit; use `[inferred]` for conclusions not directly confirmed.
- Name the mechanism or module instead of giving line numbers. Link the source of changing facts rather than copying its inventory.
- Do not maintain exhaustive lists of directory or registry contents. If a count helps, label it as a dated snapshot and point to its source.
- In public docs, describe the capability and link its owning page. Do not require consumers to understand internal paths or ADR numbers.
- When an internal rationale also defines a product boundary, explain it in both places using audience-appropriate language.

## Convention history

[ADR-CORE-018](../adr/core/ADR-CORE-018-documentation-standard.md) records the original fixed section order for published package READMEs. This 2026-09-25 clarification replaces that order and the default requirement for standalone Motivation, Goals, Non-Goals, and Development sections. Use concise, package-specific headings while keeping every required information item findable; Development or Contributing is optional when it helps the reader. The ADR keeps its original decision, evidence, and rationale as historical record.

## Next step

Choose the template that matches the reader's task. Check required content, evidence tags, and links before handoff.

## Future Considerations

A proposed retrofit of ADR-CORE-001 through ADR-CORE-004 and ADR-OC-000 through ADR-OC-002 remains separate work. If undertaken, extract implicit boundaries into Goals and Non-Goals while preserving the original decision, context, consequences, and date.

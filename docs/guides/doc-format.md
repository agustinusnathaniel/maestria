# Documentation Format: Internal Conventions

## Purpose

Define the required content for Maestria decision records, plans, notes, guides, and published package READMEs. This is the internal format convention, not an ADR.

## Audience

Contributors writing documentation and maintainers reviewing it. Public docs should help consumers use the product without requiring repository context; internal docs should preserve decisions, scope, rationale, and evidence.

## Choose a template

- [Published package README](#publishable-readme-template): explain the package, installation, features, and support boundaries.
- [ADR](#template-for-new-adrs): record a decision, its scope, alternatives, and consequences.
- [Plan](#plan-template): define work, dependencies, acceptance, verification, and rollback.
- [Note or guide](#notes-and-guides-template): state purpose, audience, dated evidence, and the next step.

Required sections are review requirements. For published READMEs, the required information may be covered concisely without a separate section for each item.

## Scope and exceptions

Apply these conventions to new documents and substantive rewrites. Do not retrofit legacy documents solely to match a template.

- Changelogs keep their chronological format.
- JSDoc, docstrings, and inline comments are outside this guide's scope.
- No format linter or schema gate is introduced. Reviewers check compliance; the docs-site deployment build described in [ADR-CORE-018](../adr/core/ADR-CORE-018-documentation-standard.md) is a separate build/link check, not a format gate.
- Put deliberately deferred work in **Future Considerations**, rather than treating it as permanently excluded in **Non-Goals**.

## Why these conventions exist

The earlier ADR format (Status → Context → Decision → Consequences → Date) did not make scope boundaries explicit. Decisions could expand during implementation, and readers had to infer exclusions from scattered tables or retrospective notes. Goals and Non-Goals give reviewers one place to check scope; Assumptions and Alternatives Considered preserve the evidence and rejected options.

Separating internal rationale from public usage also prevents design discussions from being mistaken for product promises. Keep a material support boundary in both places, phrased for each audience.

This adds authoring overhead and depends on reviewer discipline. The benefit is clearer scope and a recoverable decision history, not uniform document length. Legacy documents may retain older formats.

## Templates and shared rules

### Publishable README Template

Publishable package READMEs (packages published to npm/PyPI and the CLI app) are **concise landing pages**, not internal design documents. They tell a consumer what the package is, how to install it, what it provides, and what it does not promise. A published README must cover the following information:

| Information | Required | Content |
| --- | --- | --- |
| Title and description | Yes | Package name and a one-sentence description of what it is for |
| Installation or Usage | Yes | One canonical command/path, plus short verification or quick usage when useful |
| What It Provides | Yes | The features, components, or artifacts the package ships (short bullets) |
| Support / Platform Notes | Yes | Material limitations and truthful support boundaries (see below) |
| Documentation and release history | Yes | Link to the public docs route and the package changelog where one exists; state the pre-release status when it does not |
| Development / Contributing | No | Only if useful; link to repository guidance rather than duplicating it |
| License | Yes | SPDX license identifier |

Target roughly 40-80 lines; keep each README package-specific rather than copy-paste uniform.

Rules of thumb:

- **No verbose standalone sections.** Do not include full `Motivation`, `Goals`, or `Non-Goals` sections, long architecture narratives, implementation internals, or repeated role descriptions in a published README. Fold essential context into the opening description and the Support / Platform Notes section. Detailed rationale and design history belong in internal documents (ADRs, plans, and `docs/`).
- **"Installation or Usage" is the one allowed wording variant.** Authors may title that section `Installation`, `Usage`, or a combined `Installation & Usage` depending on the package.
- **Keep truthful support boundaries.** Include provisional or verified-subset status, version-pinning limitations, and host-enforced-vs-methodology-only distinctions where they apply.
- **Link `INSTALL.md` where the package ships one**. Keep how generated packages are produced from canonical directives out of the published README; generation and sync mechanics belong in the contributing guide.
- **Package-specific concise content is expected.** Each README keeps its own truthful details, commands, and platform notes; avoid version numbers in prose except where a support boundary requires them.

#### Link Policy for Published READMEs

Published package READMEs are consumed **outside the repository** (rendered by npm, PyPI, or another registry), where repository-relative links do not resolve. All links to repository files or public docs must therefore be absolute:

- **Repository files** (root `VISION.md`, `CONTRIBUTING.md`, `LICENSE`, package `INSTALL.md`/`CHANGELOG.md`, and files under `docs/`) must use canonical GitHub links: `https://github.com/agustinusnathaniel/maestria/blob/main/<path>`. Use `/blob/main/` (never PR branches or `/tree/`) because the README is published as of the default branch after merge.
- **User-facing docs** must use the public docs origin: `https://maestria.sznm.dev/<route>/`.
- Do not leave Markdown links that are relative (`./...`, `../...`, `/...`) or bare repository file names (`INSTALL.md`, `CHANGELOG.md`) in a published README when they are intended as links; verify every target exists in the repository or as a docs route. Anchor-only links (e.g. `#installation`) are fine if retained, but avoid adding unnecessary anchors.
- **Internal docs are different.** ADRs, plans, notes, guides, and this file are read inside the repository, so relative links remain acceptable there. Only published package READMEs require absolute links.

### Template for New ADRs

All new ADRs must follow the expanded format:

| Section | Required | Content |
| --- | --- | --- |
| Status | Yes | Proposed / Accepted / Deprecated (optionally with a date) |
| Context | Yes | Background, problem description, relevant prior decisions |
| Goals | Yes | Bulleted list of what this decision achieves (testable scope) |
| Non-Goals | Yes | Bulleted list of what this decision explicitly excludes |
| Decision | Yes | The change being proposed, with rationale |
| Consequences | Yes | Positive and negative effects of the decision |
| Assumptions | Yes | Material assumptions behind the decision, tagged `[verified]`/`[inferred]` |
| Alternatives Considered | Yes | Options weighed and rejected, with the reason each was rejected |
| Date | Yes | YYYY-MM-DD |
| Lessons Learned | No | Retrospective insights (added after implementation) |
| Rollback | No | How to revert the decision (strongly recommended for infrastructure) |
| Verification | No | Commands/checks that prove the decision is implemented (when applicable) |
| Related Decisions | No | Links to ADRs this decision builds on or interacts with |

Every new ADR must include **Status, Context, Goals, Non-Goals, Decision, Consequences, Assumptions, Alternatives Considered, and Date**. The `Assumptions` section distinguishes confirmed facts from best-effort guesses using `[verified]`/`[inferred]` tags. The `Alternatives Considered` section records options that were deliberately rejected and why, so the decision is auditable later.

### Plan Template

Plans (design/implementation plans) must include these sections:

| Section      | Required | Content                                                  |
| ------------ | -------- | -------------------------------------------------------- |
| Goal         | Yes      | What the plan achieves, in one testable statement        |
| Scope        | Yes      | What files/packages/runtimes the plan touches            |
| Non-Goals    | Yes      | What the plan deliberately does not do                   |
| Dependencies | Yes      | Prerequisites (other plans, ADRs, external systems)      |
| Acceptance   | Yes      | Observable criteria that prove the plan is complete      |
| Verification | Yes      | Commands/checks to run against the acceptance criteria   |
| Rollback     | Yes      | How to revert the plan's changes if something goes wrong |
| Status       | Yes      | Draft / In review / In progress / Done / Cancelled       |

Plans are living documents: `Status` moves as the work progresses, and `Acceptance`/`Verification` are what a reviewer checks against. A plan without an explicit rollback step is not ready for implementation.

### Notes and Guides Template

Notes and guides (ad-hoc records, conventions, process notes) must include:

| Section | Required | Content |
| --- | --- | --- |
| Purpose | Yes | Why this note/guide exists, in one or two sentences |
| Audience | Yes | Who is expected to read and act on it |
| Dated evidence | Yes | Facts and findings with a date and source; tag `[verified]`/`[inferred]` |
| Next step | Yes | What happens after this note/guide (or "none - informational") |

Notes and guides are about a point in time. Recording when evidence was gathered and where it came from keeps them useful as context ages.

> **Exemption:** This format guide may organize its template reference differently from other guides. It now includes the purpose, audience, dated evidence, and next step defined above.

### Evidence Tagging

Anywhere a fact, assumption, or finding is stated in internal documentation, mark its certainty:

- `[verified]` - confirmed from source (code, docs, a live run, an immutable commit).
- `[inferred]` - a best-effort conclusion from context that was not directly confirmed.

Tagging is required in ADRs (`Assumptions`), plans (`Acceptance`/`Verification`), and notes/guides (`Dated evidence`). It lets downstream readers - including agents - distinguish confirmed facts from guesses.

### Internal Rationale vs Public Usage

- **Internal documents** (ADRs, plans, notes, guides, this file) capture _why_ a decision was made and the evidence trail. They are read by contributors and maintainers.
- **Public documents** (publishable READMEs, the docs site) capture _how to use_ an artifact and what it provides. They are read by consumers who do not have repository context.

Rules of thumb:

- A published README is a concise landing page: a one-sentence description of what the package is _for_, install/usage, what it provides, and its support boundaries - not an architecture retrospective. Internal docs carry the rationale and design history.
- ADR rationale that is also a product boundary (e.g. "this package does not claim runtime enforcement") should appear in _both_ places, but phrased for each audience.
- Do not reference `packages/core/agent-directives/` paths or internal ADR numbers as the _only_ explanation in a public README; pair them with consumer-facing guidance.

## Dated evidence

- 2026-08-13: [ADR-CORE-018](../adr/core/ADR-CORE-018-documentation-standard.md) records the documentation standard and the decision to keep public READMEs concise and hand-authored. `[verified]`
- 2026-09-05: This guide's navigation and framing were revised; template requirements, support caveats, link rules, and legacy-document exemptions are retained. `[verified]`

The original format drew on the [Agent Trace RFC](https://agent-trace.dev/) (Motivation → Goals → Non-Goals → Specification). Maestria retains **Context** as the ADR background heading for compatibility and adds explicit scope sections.

## Next step

Use the relevant template when creating or substantively revising a document. Review its required content, evidence tags, and links before handoff.

## Future Considerations

The previously proposed retrofit of ADR-CORE-001 through ADR-CORE-004 and ADR-OC-000 through ADR-OC-002 remains separate work. If undertaken, extract implicit boundaries into Goals and Non-Goals while preserving the original decision, context, consequences, and date. It is not required by this guide.

Published README simplification is already recorded as completed in this guide; continue to review each package's own commands and support boundaries when it changes.

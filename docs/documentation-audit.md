# Documentation Clarity Audit

## Purpose

Identify and improve reading paths, wording, and information structure while preserving the context needed to understand Maestria correctly.

## Audience

Maintainers and documentation contributors. This is an editorial audit, not a complete verification of runtime behavior or external platform compatibility.

## Dated Evidence and Scope

[verified] Reviewed on 2026-09-05 against this checkout. The initial tracked inventory contained 304 Markdown/MDX files, including generated projections. The public site lives in `apps/docs/`; there is no `apps/website/` here.

The review covered root documents, contribution and agent instructions, hidden workflow/PR/changeset guidance, internal guides, plans, notes, ADR structure, canonical agent documentation, platform READMEs and installation guides, and public site content. Detailed editorial review focused on maintained guides and primary reading paths. ADRs were surveyed for structure and sampled in depth for relevant decisions; package changelogs were sampled as chronological reference. Generated projections were treated as outputs of canonical instructions, not independent prose to rewrite. This is a repository-wide audit with targeted edits, not a line-by-line rewrite of every historical or generated file.

## Major Findings

| Priority | Issue and evidence | Reader impact | Action |
| --- | --- | --- | --- |
| High | Root README placed a long repository tree before package selection; internal `docs/` lacked an entry point. | Users must understand repository internals before finding installation; contributors must infer where to start. | Added task-based entry links, moved the package table ahead of the tree, and added [an engineering index](README.md). |
| High | Installation guides mixed audiences: Codex validation appeared before installation, and Claude Code direct-install commands appeared under Uninstall. | Users encounter contributor work too early or miss the desired installation route. | Reordered the guides around user tasks while retaining validation and removal instructions. |
| High | Public CLI overview's “Without CLI” column contained CLI commands; Hermes quick start described commands differently from its reference. | Comparisons and examples teach conflicting behavior. | Replaced the misleading comparison and aligned quick-start descriptions with documented command contracts. |
| Medium | The documentation format guide delayed templates with repeated motivation, pain points, goals, and consequences. | Authors must read a design retrospective to find writing requirements. | Added a template chooser and condensed rationale while retaining requirements, caveats, and exceptions. |
| Medium | Prime Agent installation and Pi/OMP quick start repeated discovery, persistence, and dispatch explanations. | Repetition obscures the next action and raises the cost of updates. | Grouped related caveats and linked detailed reference from the quick start. |
| Medium | Public introductions used internal terminology or broad claims: “praxis,” universal dispatcher behavior, and unsupported generalizations about agent failures. | New users must decode vocabulary and may infer guarantees that vary by host. | Used concrete descriptions and preserved host-dependent routing and enforcement qualifications. |
| Medium | Large research/design files mix historical observations, current guidance, and proposed work. | Readers can mistake a proposal for a supported feature. | Added index guidance; recommend a separate current reference rather than rewriting history. |

These impact rankings are [inferred] editorial judgments, not usability-test results.

## Examples: Less Effort Without Less Meaning

| Location | Before | Improvement and rationale |
| --- | --- | --- |
| [Root README](../README.md) | “AI engineering praxis, encoded as plugins.” | “Structured AI engineering workflows for your coding agent.” Explains the product without requiring familiarity with “praxis.” |
| [Patterns](../PATTERNS.md#handoff-contract) | A single paragraph lists context, constraints, acceptance evidence, assumptions, blockers, proportionality, and artifact reuse. | Four short content bullets followed by the schema/proportionality caveat. This improves scanning rather than optimizing word count. |
| [Patterns](../PATTERNS.md#pipeline-rules) | “This seems obvious. It gets violated when someone tries to parallelize dependent work.” | “Parallelize only independent tasks.” The preceding sentence retains the prerequisite rule and examples. |
| [Documentation conventions](guides/doc-format.md) | Several sections explain why scope and rationale matter before presenting templates. | A linked template chooser comes first; one rationale section preserves scope-creep risks and the authoring trade-off. |
| [Prime Agent installation](../packages/prime-agent/INSTALL.md) | Build and extension-discovery constraints recur across installation and verification sections. | A focused explanation near setup keeps the prerequisite visible without repeating it throughout the guide. |
| [Public CLI commands](../apps/docs/src/content/docs/cli/commands.mdx) | A long error-handling paragraph combines host delegation, compatibility, scope, and version constraints. | Separate paragraphs/bullets make each condition findable while retaining the actual constraints. |

## Structural Recommendations

1. **Separate current Hermes reference from research history.** The 1,127-line [Hermes design document](hermes-maestria-plugin.md) includes design, research, plans, and proposed snippets. Extract a current contributor reference only after checking each claim against source. Keep the dated design history and link between the two. Do not present the entire historical document as a setup guide.
2. **Make historical status explicit.** Plans and session notes should prominently identify their status, evidence date, and current successor. Preserve rejected approaches and rationale; they explain decisions even when commands or platform APIs have aged.
3. **Resolve convention drift deliberately.** [ADR-CORE-018](adr/core/ADR-CORE-018-documentation-standard.md) records a mandatory README section order that differs from the current concise-landing-page convention. Add a superseding clarification when changing policy; do not silently rewrite an accepted historical decision. The current format guide's rough line target should remain subordinate to complete support boundaries and usable examples.
4. **Update canonical contribution reference separately.** The [directive README](../packages/core/agent-directives/README.md) lists seven specialists but omits `orchestrator.md`, and its new-specialist instructions describe older section names and registration assumptions. Verify the current sync/loader contract before revising this procedure and run the required sync gates.
5. **Keep useful duplication near decisions.** Version restrictions, advisory-versus-enforced behavior, destructive removal boundaries, and provisional support status belong next to relevant commands even when reference pages also explain them. Consolidate repeated rationale, not conditions needed to act safely.
6. **Use document types selectively.** Quick starts should lead to a first successful task; installation guides should handle setup and removal; references should describe commands and state; conceptual pages should explain workflow choices. Keep platform navigation and existing routes rather than forcing four new top-level categories.

## Principles Used

[Diátaxis](https://diataxis.fr/) distinguishes learning, task completion, reference, and explanation. Here that distinction informs ordering and links, not a wholesale folder migration. The [Google developer documentation style guide](https://developers.google.com/style/highlights) supports active voice, descriptive links, and placing conditions before instructions. Existing Maestria documentation conventions remain the local contract.

Completeness takes priority over a length target. Preserve examples, limits, exceptions, and rationale when they help readers act or interpret a decision. Generated prompts, legal/community policy, and release history need different review criteria from user onboarding prose.

## Verification

- [verified] `pnpm check` passed: package and documentation builds, formatting, lint/type analysis, workspace tests, directive sync, and manifest/version checks. The first sandboxed attempt could not open test IPC sockets; the permitted retry passed.
- [verified] Documentation build produced 69 pages with all internal site links valid. The documentation suite passed all 74 tests.
- [verified] Independent review found a missing working-directory instruction in the Prime Agent guide; the sync commands now explicitly start from the repository root.

Link/build checks establish document integrity; they do not prove that readers understand the material or that every external platform claim is current.

## Next Step

Use this audit as a follow-up list for the structural recommendations above. The focused wording and navigation fixes are applied in this change; larger historical splits and policy changes remain separate work.

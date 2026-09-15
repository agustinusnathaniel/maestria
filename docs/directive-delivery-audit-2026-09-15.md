# Directive delivery audit

## Scope and limits

Read-only sample of five OpenCode root sessions updated September 8-14, 2026, plus their delegated sessions. Examined user requests, handoffs, tool records, and completion reports. No sessions were replayed and no paid model evaluation was run. Historical system prompts and installed plugin versions were not established, so observed omissions cannot be attributed conclusively to the current directives.

The sampled orchestrators used Muse Spark, DeepSeek, and GPT-5.6 Sol. The [OpenAI article](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) supports clear triggers, conditional context, and explicit completion criteria; its Astra-specific observations are not proof of behavior on these models.

## Findings

| Session | Evidence | Assessment |
| --- | --- | --- |
| `ses_f60609108ffeiwlaUWqA92Rb2E`, Wrapping commands with AllPackageManagers | Final `msg_09fb883600019Gbx2C71olmdib`: docs UI changes delivered with build, HTML, and test evidence. No browser/capture call or visual-evidence decision found in the session tree. | Silent omission. Existing wording permits low-value skips, so omission alone does not prove noncompliance. A docs-site label should not hide rendered changes. |
| `ses_f5f887597ffe7kNGvoJeKBcJ09`, Production code reduction loops | Builder `msg_0a08afc650017aonXQimaYU5JQ` says no display; reviewer records no browser check; final `msg_0a09617c5001c1HOvw4Ztz2A7y` recommends screenshots later. | Disclosed gap, allowed by the old exception. Capture unavailability was not established by the inspected evidence. Missing desktop display does not establish missing headless capability. |
| `ses_f7b585e93ffecH20gekdWz2bAv`, Build Notetaker | `msg_085405c3a001ie1k2v3H6DU6f7` declares the goal complete. The subsequent plan audit `msg_085449e30001sNPNsRYIsXr9Gz` identifies required submission text and screenshot/recording as unfinished. Later turns do capture screenshots. | Completion reconciliation failed; visual tooling was not universally unavailable. Required artifacts became follow-ups until the user resumed them. |
| `ses_f5f899614ffe8Qzh1IZ06w5hwE`, Reduce production code in maestria CLI | `msg_0a0ba0825001FCEEU02a7iL4j1` reports no user-visible change and no changeset. Later audit `msg_0a0d87f99001OmAIfInYevEbyv` identifies terminal-dependent rendering changes; a patch changeset follows. | Output classification missed a supported terminal variant. The later audit-only request reasonably ended at its report; the earlier delivery was missing the release note. |
| `ses_f7f0b7811ffejG9tuHCGj7VspF`, Coss UI and Workers AI speech-to-text setup | UI and route changes shipped; an agent-browser skill load appears, without a corresponding capture call found. | Loading guidance is not verification evidence. No claim that a screenshot was explicitly required in this session. |

## Focused changes

- Clarify when visual delivery applies and carry evidence into implementation and review briefs. Separate capture from upload, preserve local artifacts when uploads fail, and explain applicable omissions.
- Keep explicit user/project evidence requirements as acceptance work. Reconcile the original request, accepted follow-ups, required checks, artifacts, documentation, and changesets before completion.
- Replace the builder's tests/typechecks shortcut with verification of the changed contract.
- Close a source-level ambiguity: meaningful direct implementation also needs independent review. No review bypass was established in this sample.
- Shorten duplicated orchestrator output, lifecycle, and reporting prose. Preserve shared authorization and bounded-repair rules.
- Remove the obsolete Hermes transform for the builder's old verification sentence; the replacement canonical wording already applies to that host.

These clarify the evidence and completion contracts in CORE-019 and CORE-023; they do not change runtime permissions or add workflow stages. The canonical README and package exports remain accurate. Prompt length is a plausible contributor, not an established cause; a broad rewrite is not justified by this sample.

## Verification boundary

The existing directive contract suite now checks the new evidence and completion requirements. Sync checks verify propagation; repository gates check integration. These are structural checks, not measurements of model adherence.

For a future bounded behavior comparison, run old and new directives on: a source-only docs correction (no capture), a docs UI change (capture or checked limitation), a headless UI session (attempt available capture), an unavailable upload (retain local artifact), an explicitly required screenshot that cannot be obtained (incomplete), and a CLI rendering change (terminal evidence and release-note decision). Compare artifacts, claims of completion, and unnecessary tool use.

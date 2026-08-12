# Iteration Limits

Use the universal bounded-autonomy contract in `rules.md`.

- Define a verifiable termination condition before looping and count attempts.
- Routine repair: two rounds, then one final extension (maximum three) only with observable progress.
- The initial build is not a repair round; each builder fix plus validation and any required re-review consumes one round. Transient dispatch failures are handled separately and do not consume a repair round.
- Repeated causes, restored diffs, no new evidence, safety ambiguity, or unresolved review floors stop the loop. Pivot once to diagnosis or architecture, then report: `Tried X, Y. Blocked by [cause]. Need [input].`
- If a specialist report is empty, inspect the artifact first; recover once with a changed brief only when evidence is insufficient. Never silently reset attempts.

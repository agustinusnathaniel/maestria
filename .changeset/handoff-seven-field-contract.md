---
'@maestria/pi': patch
'@maestria/omp': patch
---

Align `/handoff` command output with the 7-field `HANDOFF_FIELDS` contract.

The shared handoff validator (`@maestria/shared-pi/subagent-utils`) already required 7 fields including **Assumptions documented**, but the `/handoff` command in `pi` and `omp` still generated a 6-field prompt — so handoffs produced by the command could fail validation. The command now emits the **Assumptions documented** section (with `[inferred]` tagging guidance) before Success criteria, matching the validator and the handoff SKILL.md contract.

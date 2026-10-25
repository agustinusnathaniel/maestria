---
description: Research only - read-only adventurer/architect specialists, STOP before implementation
---

<!-- Generated from packages/core/agent-directives by scripts/sync-consolidated-plugin.ts. Do not edit directly. -->

[MODE: sonar]

## MODE: sonar (Research Only)

Activate research-only mode. Use only read-only `@adventurer` or `@architect` specialists: start with the owning specialist, add a second only for a distinct unresolved required output.

Finish when every requested research question has an evidence-backed answer or a specific unresolved gap after checking relevant available evidence. Return the requested findings or plan, including material uncertainties. Do not implement, write code, or create production files.

The maestria router and global policy are already loaded always-on in this session; apply them to this workflow.

Preserve the user's goal, constraints, and arguments. Apply this workflow to the following request:

$ARGUMENTS

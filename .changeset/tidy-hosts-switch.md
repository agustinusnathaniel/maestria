---
"@maestria/agent-plugins": patch
"maestria": patch
---

Consolidate host mappings in the shared plugin: explicit Claude native agents and commands, Codex metadata-only profiles with complete instructions composed at sync, Kimi native profiles with bootstrap system prompt, Devin utility plus mode skills, explicit ZCode agents and commands, and portable root agents with utility skills. Quote workflow command frontmatter so the sync preflight parses reliably.

Keep root skills utility-only, document full native workflow and policy mappings across host surfaces, and clarify utility-only marketplace installation. Preserve Codex model settings when complete prompts contain TOML-looking examples, and make sync dry-run processing errors fail preflight before later writes.

---
'@maestria/cli': minor
---

Add `maestria configure <platform>` for per-agent model selection on opencode, pi, and omp.

- Interactive: group-multiselect of the 7 specialists, then a per-agent model picker with the current model pre-selected and an *Inherit (session model)* option; model lists fetched live from the platform (`opencode models`, `pi --list-models`, `omp models --json`).
- Non-interactive: `--set <agent>=<model>[,...]` with empty values to reset, `--global`/`--project` config levels, and `--json`/`--quiet`/`--compact` output modes.
- Writes are surgical: opencode JSONC path edits preserve comments and the `variant` key; pi/omp frontmatter edits preserve the agent body. Models are validated against the platform's live model list before writing.
- Bundles jsonc-parser 3.3.1 via its ESM build (the UMD entry cannot be bundled); removing a non-existent model is a no-op.

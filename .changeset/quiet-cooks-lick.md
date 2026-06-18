---
"@maestria/opencode": patch
---

fix: replace hand-rolled YAML parser with spec-compliant library

The custom YAML frontmatter parser (~120 lines) didn't handle quoting,
nesting, or multiline values correctly. Permission patterns like
`"git status*": allow` and `"*": deny` were silently broken because the
parser treated quotes as literal characters instead of YAML syntax.

This is now replaced with the `yaml` library (eemeli/yaml) — a proper
spec-compliant parser that handles quoting, multiline values, and
nested structures natively. The `stripYamlQuotes` workaround, added to
patch the old parser, has been removed as it's no longer needed.

All 8 agent descriptions have also been converted to YAML folded block
scalars (`>`) for cleaner multiline text that reads well both in source
and when parsed.

Every agent's permission model was broken out of the box — deny-by-default
didn't deny, and allowlists didn't allow. That's fixed now.

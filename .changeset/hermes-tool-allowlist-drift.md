---
'@maestria/hermes': patch
---

Sonar can now read skills and past sessions, matching what delegated children
already had.

Sonar's tool allowlist was narrower than the child policy for no stated
reason, so a research session could not look up a skill or recall earlier work
while a delegated child in the same mode could. Both now allow the same
inspection tools:

- `skill_view` and `skills_list` - read installed skills
- `session_search` - recall earlier transcripts

`skill_manage` remains blocked everywhere: reading a skill is inspection,
authoring one is a change. No tool that writes files, runs a shell, executes
code, or delegates was added to any mode.

Separately, both allowlists named tools Hermes does not ship - eight copied
from other agent hosts (`read`, `glob`, `grep`, `list`, `ls`, `stat`,
`file_info`, `webfetch`) and four that never existed (`complete`,
`complete_structured`, `think`, `reason`). Those entries granted nothing; they
only made the policy read as far broader than it was. A test now resolves every
allowlist entry against Hermes' live toolset registry, so a renamed or removed
tool fails the suite instead of quietly narrowing access.

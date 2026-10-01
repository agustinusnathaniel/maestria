---
'@maestria/hermes': patch
---

Delegated children and direct blitz sessions regain three read-only tools.

The sonar and blitz tool allowlists named tools Hermes does not ship, copied
from other agent hosts (`read`, `glob`, `grep`, `list`, `ls`, `stat`,
`file_info`, `webfetch`) plus four that never existed (`complete`,
`complete_structured`, `think`, `reason`). Because an allowlist grants access
by exact name, those entries granted nothing - they just made the read-only
surface look far broader than it was.

Blitz and delegated children can now use:

- `skill_view` and `skills_list` - inspect installed skills
- `session_search` - recall earlier transcripts

Sonar is unchanged: `read_file`, `search_files`, `web_search`, and
`web_extract`, exactly as before. No tool that writes, runs a shell, executes
code, or delegates was added to any mode, and `todo_list` stays excluded
because it mutates task state.

A test now resolves every allowlist entry against Hermes' live toolset
registry, so a renamed or removed tool fails the suite instead of quietly
narrowing access.
---
'@maestria/hermes': patch
---

Realign the mode and child tool allowlists with the tools Hermes actually ships.

`SONAR_ALLOWED_TOOLS` and `BLITZ_DIRECT_ALLOWED_TOOLS` gated a DENY, so a
name Hermes does not ship is inert: it widens nothing and protects nothing.
Against Hermes v0.21.4, 8 of 12 sonar entries and 12 of 16 blitz-direct
entries matched no registered tool - names carried over from other agent
hosts (`read`, `glob`, `grep`, `list`, `ls`, `stat`, `file_info`, `webfetch`)
plus four Hermes has never shipped (`complete`, `complete_structured`,
`think`, `reason`). The source read as broad read-only coverage while the
effective policy was only file reads and web research.

- sonar keeps `read_file`, `search_files`, `web_search`, `web_extract`
- blitz-direct adds the read-only local affordances Hermes really has:
  `skill_view`, `skills_list`, `session_search`
- remove the dead `complete`/`complete_structured`/`think`/`reason` entries
  rather than replacing them; their purpose (extra reasoning budget) is
  served by the model's reasoning configuration, not a distinct tool

Membership stays hand-written and reviewed: Hermes exposes no read-only or
mutating metadata on tool registration, so it cannot be derived from the
host. Existence is now enforced instead - `tests/test_permissions.py`
resolves every allowlist entry against the live Hermes toolset registry, so
future drift fails a test instead of silently narrowing the policy.

Also replaces two tests that pinned the literal allowlist contents. They
restated the constant they were meant to protect, so a widened allowlist
could never fail them; they now assert the safety invariant (no mutating
tool is admitted) and leave existence to the new registry test.

Behavior: delegated children and direct blitz sessions gain three read-only
tools they previously could not use. No mutating capability is added
anywhere, and sonar's effective policy is unchanged.

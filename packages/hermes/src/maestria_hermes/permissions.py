"""Literal tool allowlists and native child roles for the Hermes plugin.

The pre_tool_call hook enforces these reviewed, hand-written allowlists at
the mode and delegated-child boundaries. New Hermes tools stay denied
until explicitly reviewed here.

Two separate concerns, deliberately not conflated
------------------------------------------------

*MEMBERSHIP* - which tools belong in the mode and child policy - is a
safety decision and stays hand-written and reviewed. Hermes exposes no
read-only/mutating metadata on tool registration
(``tools.registry.ToolRegistry.register`` takes no such flag), so
membership cannot be derived from the host; it is decided by a human.

*EXISTENCE* - whether each reviewed name is a real Hermes tool - is a
mechanical fact Hermes answers authoritatively. The allowlists below used
to carry names from other agent hosts (``read``, ``glob``, ``grep``,
``list``, ``ls``, ``stat``, ``file_info``, ``webfetch``) and names Hermes
has never shipped (``complete``, ``complete_structured``, ``think``,
``reason``). Against Hermes v0.21.4, 8 of 12 ``SONAR_ALLOWED_TOOLS``
entries and 12 of 16 ``BLITZ_DIRECT_ALLOWED_TOOLS`` entries matched no
registered tool: dead entries that widen nothing and protect nothing,
while making the policy look broader than it was.

``tests/test_permissions.py::test_allowlist_entries_are_real_hermes_tools``
resolves every entry against the live Hermes toolset registry, so drift
fails a test instead of quietly degrading the policy at runtime.
"""

from __future__ import annotations

# Native child roles are topology signals from Hermes, not Maestria
# specialist identities. Keep these immutable so no configuration can
# widen child safety policy.
NATIVE_CHILD_ROLES = frozenset({"leaf", "orchestrator"})

# Positive, reviewed allowlists for the mode and delegated-child boundaries.
# Every name must exist as a real Hermes tool (enforced by test where Hermes
# is importable). Foreign-host names were removed rather than translated: the
# allowlists gate a DENY, so an unknown name is inert, but carrying them
# implied a breadth of read-only access the plugin never actually had.
SONAR_ALLOWED_TOOLS = frozenset(
    {
        # File read/search: the reader half of Hermes' `file` toolset
        # (write_file and patch are the writer half and stay denied).
        "read_file",
        "search_files",
        # Web research: Hermes' `web` toolset.
        "web_search",
        "web_extract",
    }
)

# Direct (non-delegated) blitz work adds the read-only local affordances
# Hermes actually exposes: read-only skill inspection and transcript recall.
#
# Deliberately EXCLUDED:
#   todo_list     - its handler mutates task state (tools/todo_tool.py), so it
#                    is not read-only despite reading.
#   vision_analyze - read-only by nature, but it uploads image data to a
#                    provider; sonar/blitz are meant to stay local.
#   browser_*      - interactive and stateful; not read-only in any sense.
#   clarify        - never parallel-safe and requires a human reply.
#
# The previous list named `complete`, `complete_structured`, `think`, and
# `reason`. None has ever been a Hermes tool. Their apparent purpose - extra
# reasoning budget during fast work - is served by the model's own reasoning
# configuration, not by a distinct tool, so they were removed rather than
# replaced.
BLITZ_DIRECT_ALLOWED_TOOLS = frozenset(
    {
        *SONAR_ALLOWED_TOOLS,
        # Read-only skill inspection.
        "skill_view",
        "skills_list",
        # Read-only recall of prior transcripts.
        "session_search",
    }
)

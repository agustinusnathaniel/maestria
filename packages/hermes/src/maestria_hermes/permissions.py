"""Literal tool allowlists and native child roles for the Hermes plugin.

The pre_tool_call hook enforces these reviewed, hand-written allowlists at
the mode and delegated-child boundaries. New Hermes tools stay denied
until explicitly reviewed here.
"""

from __future__ import annotations

# Native child roles are topology signals from Hermes, not Maestria
# specialist identities. Keep these immutable so no configuration can
# widen child safety policy.
NATIVE_CHILD_ROLES = frozenset({"leaf", "orchestrator"})

# Positive, reviewed allowlists for the mode and delegated-child boundaries.
# New Hermes tools stay denied until explicitly reviewed here.
SONAR_ALLOWED_TOOLS = frozenset(
    {
        "read",
        "read_file",
        "glob",
        "grep",
        "search_files",
        "list",
        "ls",
        "stat",
        "file_info",
        "webfetch",
        "web_search",
        "web_extract",
    }
)

BLITZ_DIRECT_ALLOWED_TOOLS = frozenset(
    {
        *SONAR_ALLOWED_TOOLS,
        "complete",
        "complete_structured",
        "think",
        "reason",
    }
)

CHILD_SAFE_ALLOWED_TOOLS = frozenset(
    {
        *BLITZ_DIRECT_ALLOWED_TOOLS,
    }
)

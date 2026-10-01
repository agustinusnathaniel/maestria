"""Literal tool allowlists and native child roles for the Hermes plugin.

New Hermes tools stay denied until explicitly reviewed here. Membership is a
human decision - Hermes exposes no read-only metadata to derive it from -
while existence is not, so tests/test_permissions.py resolves every name
against the live toolset registry.

The line is whether a tool changes agent-authored content or the user's
workspace. Writing Hermes' own telemetry is still inspection.
"""

from __future__ import annotations

# Native child roles are topology signals from Hermes, not maestria
# specialist identities. Keep these immutable so no configuration can
# widen child safety policy.
NATIVE_CHILD_ROLES = frozenset({"leaf", "orchestrator"})

SONAR_ALLOWED_TOOLS = frozenset(
    {
        # The reader half of Hermes' `file` toolset; write_file and patch stay
        # denied.
        "read_file",
        "search_files",
        # All of Hermes' `web` toolset.
        "web_search",
        "web_extract",
        # Reading a skill does not author one. skill_manage does.
        "skill_view",
        "skills_list",
        "session_search",
    }
)

# Deliberately absent: todo_list mutates task state, vision_analyze uploads
# image data off-box, browser_* is stateful, and clarify blocks on a human.
BLITZ_DIRECT_ALLOWED_TOOLS = SONAR_ALLOWED_TOOLS
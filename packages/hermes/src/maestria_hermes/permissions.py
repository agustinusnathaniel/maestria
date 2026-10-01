"""Literal tool allowlists and native child roles for the Hermes plugin.

The pre_tool_call hook enforces these reviewed, hand-written allowlists at
the mode and delegated-child boundaries. New Hermes tools stay denied
until explicitly reviewed here.

Membership is a human safety decision and stays hand-written: Hermes exposes
no read-only/mutating metadata on tool registration, so it cannot be derived.
Existence is a fact Hermes owns, so ``tests/test_permissions.py`` resolves
every name here against the live toolset registry.

The line drawn is mutation of agent-authored content and the user's
workspace, not toolset boundaries. A tool that writes Hermes' own
telemetry - skill_view bumps usage counters, read_file marks a file read -
is still inspection. skill_manage is excluded because it authors skills.
"""

from __future__ import annotations

# Native child roles are topology signals from Hermes, not Maestria
# specialist identities. Keep these immutable so no configuration can
# widen child safety policy.
NATIVE_CHILD_ROLES = frozenset({"leaf", "orchestrator"})

SONAR_ALLOWED_TOOLS = frozenset(
    {
        # The reader half of Hermes' `file` toolset; write_file and patch stay
        # denied.
        "read_file",
        "search_files",
        # Hermes' `web` toolset.
        "web_search",
        "web_extract",
        # Reading a skill does not author one. skill_manage does, and stays
        # denied in every mode.
        "skill_view",
        "skills_list",
        "session_search",
    }
)

# Deliberately absent everywhere: todo_list mutates task state, vision_analyze
# uploads image data off-box, browser_* is stateful, and clarify blocks on a
# human reply.
BLITZ_DIRECT_ALLOWED_TOOLS = SONAR_ALLOWED_TOOLS

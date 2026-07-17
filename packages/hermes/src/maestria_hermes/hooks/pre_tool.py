"""pre_tool_call hook -- enforces per-specialist permission roles.

In sonar mode, all write tools are blocked regardless of specialist.
In fein/blitz mode, each specialist has its own permission role.

Role context is obtained from the session_id -> role mapping populated
by subagent_start (see session.py).  This works around the Hermes API
limitation that pre_tool_call hooks do not receive child_role.
"""

from __future__ import annotations

import logging

from maestria_hermes.modes import ModeManager
from maestria_hermes.permissions import TOOL_CATEGORIES, block_message, get_role
from maestria_hermes.session import get_role_for_session

logger = logging.getLogger(__name__)


def create_pre_tool_hook(mode_manager: ModeManager):
    """Create a pre_tool_call hook closure bound to the given mode manager.

    In sonar mode all write tools are blocked regardless of specialist.
    In fein/blitz mode the hook checks the caller's permission role,
    resolved from the session_id -> role mapping.
    """

    def pre_tool_hook(tool_name: str, **kwargs) -> None | dict:
        """Block disallowed tools based on mode and specialist role.

        Returns None to allow, or a block dict to deny.
        """
        mode = mode_manager.get_mode()

        # Sonar mode: block ALL write tools regardless of specialist
        if mode == "sonar":
            if tool_name in TOOL_CATEGORIES["write"]:
                logger.info("sonar mode blocked tool=%s", tool_name)
                return {
                    "action": "block",
                    "message": (
                        f"Tool '{tool_name}' is blocked in sonar mode. "
                        "Switch to fein or blitz mode to make changes "
                        "(/fein or /blitz)."
                    ),
                }
            return None  # Read tools allowed in sonar mode

        # Fein/Blitz mode: check permission role from session mapping
        session_id = kwargs.get("session_id", "")
        role = get_role_for_session(session_id) if session_id else ""

        if not role:
            # No role mapping -- session may not be a subagent (e.g. direct chat).
            # Allow the tool; the sonar mode gate above is the reliable fallback.
            return None

        perm_role = get_role(role)
        if not perm_role.is_tool_allowed(tool_name):
            logger.info("blocked tool=%s for role=%s (session=%s)", tool_name, role, session_id)
            return {
                "action": "block",
                "message": block_message(role, tool_name),
            }

        return None  # Allow

    return pre_tool_hook

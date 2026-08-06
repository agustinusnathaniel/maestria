"""pre_tool_call hook -- enforces per-specialist permission roles.

In sonar mode, all write tools are blocked regardless of specialist.
In fein/blitz mode, each specialist has its own permission role.

Role context is obtained from the session_id -> role mapping populated
by subagent_start (see session.py).  This works around the Hermes API
limitation that pre_tool_call hooks do not receive child_role.
"""

from __future__ import annotations

import logging

from maestria_hermes.landing_review import LandingReviewManager
from maestria_hermes.modes import ModeManager
from maestria_hermes.permissions import TOOL_CATEGORIES, block_message, get_role
from maestria_hermes.session import get_role_for_session

logger = logging.getLogger(__name__)

_ROOT_DISPATCH_TOOLS = {"delegate_task", "opencode_route"}


def create_pre_tool_hook(
    mode_manager: ModeManager,
    landing_manager: LandingReviewManager | None = None,
):
    """Create a pre_tool_call hook closure bound to the given mode manager.

    In sonar mode all write tools are blocked regardless of specialist.
    In fein/sonar, an unassigned root session is dispatcher-only. In blitz,
    direct tools are allowed but dispatch tools are blocked. Specialist
    sessions continue to use their role permissions for remaining tools.
    """

    def pre_tool_hook(tool_name: str, **kwargs) -> None | dict:
        """Block disallowed tools based on mode and specialist role.

        Returns None to allow, or a block dict to deny.
        """
        session_id = kwargs.get("session_id", "")
        session_id = kwargs.get("task_id") or session_id
        args = kwargs.get("args", {})
        mode = mode_manager.get_mode(session_id or None)
        role = get_role_for_session(session_id) if session_id else ""
        is_root_session = not role

        if mode in {"fein", "sonar"} and is_root_session:
            if tool_name not in _ROOT_DISPATCH_TOOLS:
                return {
                    "action": "block",
                    "message": (
                        f"Tool '{tool_name}' is blocked for the Maestria orchestrator. "
                        f"Use delegate_task or opencode_route in {mode} mode."
                    ),
                }

        if mode == "blitz" and tool_name in _ROOT_DISPATCH_TOOLS:
            return {
                "action": "block",
                "message": (
                    f"Tool '{tool_name}' is blocked in blitz mode. "
                    "Blitz runs directly without specialist dispatch."
                ),
            }

        if landing_manager is not None:
            landing_block = landing_manager.shipping_block(
                session_id,
                tool_name,
                args,
                kwargs.get("cwd") or kwargs.get("directory") or kwargs.get("worktree"),
            )
            if landing_block is not None:
                return landing_block

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

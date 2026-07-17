"""pre_tool_call hook -- enforces per-specialist permission roles.

In sonar mode, all write tools are blocked regardless of specialist.
In fein/blitz mode, each specialist has its own permission role.
"""

from __future__ import annotations

import logging
from maestria_hermes.modes import ModeManager
from maestria_hermes.permissions import get_role, block_message, _WRITE_TOOLS

logger = logging.getLogger(__name__)


def create_pre_tool_hook(mode_manager: ModeManager):
    """Create a pre_tool_call hook closure bound to the given mode manager.

    In sonar mode all write tools are blocked regardless of specialist.
    In fein/blitz mode the hook checks the caller's permission role.

    NOTE: Hermes does NOT pass ``child_role`` to ``pre_tool_call`` hooks
    (the kwarg does not exist in the hook dispatch chain).  Role-based
    subagent gating cannot be enforced until Hermes provides this context.
    When the role is absent we fall back to allowing the tool — the sonar
    mode write-block is the reliable primary gate.
    """

    def pre_tool_hook(tool_name: str, **kwargs) -> None | dict:
        """Block disallowed tools based on mode and specialist role.

        Returns None to allow, or a block dict to deny.
        """
        mode = mode_manager.get_mode()

        # Sonar mode: block ALL write tools regardless of specialist
        if mode == "sonar":
            if tool_name in _WRITE_TOOLS:
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

        # Fein/Blitz mode: check permission role
        # Hermes does not currently pass ``child_role`` to pre_tool_call
        # hooks, so subagent-level gating is unavailable.  When absent we
        # allow the tool; mode-based gating (sonar write-block above) is
        # the reliable primary enforcement mechanism.
        role = kwargs.get("child_role", "")
        if not role:
            return None  # Allow — role context unavailable

        perm_role = get_role(role)
        if not perm_role.is_tool_allowed(tool_name):
            logger.info("blocked tool=%s for role=%s", tool_name, role)
            return {
                "action": "block",
                "message": block_message(role, tool_name),
            }

        return None  # Allow

    return pre_tool_hook

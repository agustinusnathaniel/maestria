"""pre_tool_call hook -- enforces mode-based tool restrictions.

In sonar mode, blocks write/edit/delete tools to enforce read-only
research behavior.
"""

import logging
from maestria_hermes.modes import ModeManager

logger = logging.getLogger(__name__)

# Tools that modify state -- blocked in sonar mode
_WRITE_TOOLS = {
    "write",
    "write_file",
    "edit",
    "edit_file",
    "patch",
    "delete",
    "delete_file",
    "rename",
    "rename_file",
    "mkdir",
    "make_directory",
    "create",
}


def create_pre_tool_hook(mode_manager: ModeManager):
    """Create a pre_tool_call hook closure bound to the given mode manager."""

    def pre_tool_hook(tool_name: str, **kwargs) -> None:
        """Block write tools in sonar mode.

        Returns None to allow, or a block dict to deny.
        """
        if not mode_manager.is_read_only():
            return None  # Allow all tools except in sonar mode

        if tool_name in _WRITE_TOOLS:
            logger.info(
                "sonar mode blocked tool=%s",
                tool_name,
            )
            return {
                "action": "block",
                "message": (
                    f"Tool '{tool_name}' is blocked in sonar mode. "
                    "Switch to fein or blitz mode to make changes "
                    "(/fein or /blitz)."
                ),
            }

        return None  # Allow read-only tools

    return pre_tool_hook

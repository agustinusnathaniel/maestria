"""transform_tool_result hook -- appends methodology annotations to tool results.

Inspired by the Hermes security-guidance plugin which appends security
warnings to file-write results. This hook appends maestria methodology
notes (mode context, maker/checker reminders) to relevant tool results.
"""

import logging
from typing import Optional

from maestria_hermes.modes import ModeManager

logger = logging.getLogger(__name__)


def create_transform_tool_result_hook(mode_manager: ModeManager):
    """Create a transform_tool_result hook closure."""

    def transform_hook(**kwargs) -> Optional[str]:
        """Append methodology annotations to tool results.

        Returns None (no modification) or a string to replace the result.
        Currently an observer -- logs methodology-relevant events for
        future analysis and reporting.
        """
        tool_name = kwargs.get("tool_name", "")
        result = kwargs.get("result", "")

        # For write operations, log the change for audit trail
        if tool_name in {"write", "write_file", "edit", "edit_file", "patch", "create"}:
            mode = mode_manager.get_mode()
            logger.info(
                "methodology: write tool=%s mode=%s result_len=%d",
                tool_name, mode, len(str(result)),
            )

        # Return None to leave the result unchanged
        return None

    return transform_hook

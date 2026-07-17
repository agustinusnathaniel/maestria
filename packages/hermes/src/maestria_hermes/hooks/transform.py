"""transform_tool_result hook -- appends maestria methodology annotations.

For write operations in fein/blitz mode, appends a small methodology
note to the tool result so the LLM is aware of the mode context.

Inspired by the Hermes security-guidance plugin which appends security
warnings to file-write results.
"""

from __future__ import annotations

import logging
from typing import Optional

from maestria_hermes.modes import ModeManager

logger = logging.getLogger(__name__)

# Tools whose results get methodology annotations
_ANNOTATED_TOOLS = {
    "write", "write_file", "patch",
    "create", "delete", "delete_file",
    "rename", "rename_file", "move", "copy",
    "terminal", "bash", "shell",
}


def create_transform_tool_result_hook(mode_manager: ModeManager):
    """Create a transform_tool_result hook closure.

    For write/exec tools in fein/blitz mode, appends a methodology
    annotation to the tool result reminding the agent which mode is
    active.
    """

    def transform_hook(**kwargs) -> Optional[str]:
        """Append methodology annotations to tool results.

        Returns the original result unchanged for sonar/read tools.
        For write tools in fein/blitz, appends a mode annotation.
        """
        tool_name = kwargs.get("tool_name", "")
        result = kwargs.get("result", "")

        if not tool_name or not isinstance(result, str):
            return None

        mode = mode_manager.get_mode()

        # Only annotate write/exec tools in non-sonar modes
        if mode == "sonar":
            return None
        if tool_name not in _ANNOTATED_TOOLS:
            return None

        annotation = _build_annotation(mode, tool_name)
        if annotation and len(result) + len(annotation) < 50000:
            annotated = f"{result}\n{annotation}"
            logger.debug(
                "methodology: annotated tool=%s mode=%s len=%d",
                tool_name, mode, len(annotation),
            )
            return annotated

        return None  # Leave unchanged

    return transform_hook


def _build_annotation(mode: str, tool_name: str) -> str:
    """Build a methodology annotation string.

    Uses plain text (not markdown) so it doesn't interfere with
    structured tool results.
    """
    mode_labels = {
        "fein": "[Maestria: full methodology pipeline active]",
        "blitz": "[Maestria: fast execution mode, gates skipped]",
    }
    label = mode_labels.get(mode, "")
    if not label:
        return ""

    return f"\n{label}"

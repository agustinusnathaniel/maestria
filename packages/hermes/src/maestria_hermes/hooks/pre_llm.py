"""pre_llm_call hook -- injects mode context and project customization.

Mode context preserves the Hermes prompt cache (system prompt untouched).
Project-root customization (workflow then rules) is read fresh every turn
from the session working directory after the mode context. Trust comes from
native lifecycle state only (see session.py and permissions.py). The host
runs fail-open, so this hook never raises: broken files become a visible
error banner instead of silently absent config.
"""

from __future__ import annotations

import logging
import pathlib

from maestria_hermes import project_config
from maestria_hermes.modes import ModeManager

logger = logging.getLogger(__name__)

# Load mode context from synced SKILL.md files
_COMMANDS_DIR = pathlib.Path(__file__).parent.parent / "skills" / "commands"


def _load_mode_context(name: str) -> str:
    """Load mode context from synced command SKILL.md file.

    Falls back to a generic message if the file is missing.
    """
    path = _COMMANDS_DIR / name / "SKILL.md"
    if path.exists():
        content = path.read_text(encoding="utf-8")
        # Strip YAML frontmatter
        if content.startswith("---"):
            parts = content.split("---\n", 2)
            if len(parts) >= 3:
                content = parts[2]
        return content.strip()
    return (
        f"[MAESTRIA MODE: {name}]\n"
        f"No specific mode instructions defined."
    )


_MODE_CONTEXT = {
    name: _load_mode_context(name)
    for name in ["fein", "sonar", "blitz"]
}


def create_pre_llm_hook(mode_manager: ModeManager):
    """Create a pre_llm_call hook closure bound to the mode manager.

    Injects the current maestria mode directive plus fresh project-root
    customization into every user message. Trust is tracked exclusively
    by the trusted native lifecycle hooks; user text never grants
    capability. Never raises: project-load failures become a visible
    error banner (the host would swallow a raise and drop the mode
    context with it).
    """

    def pre_llm_hook(**kwargs) -> dict:
        """Inject mode context and project customization into the user message."""
        mode = mode_manager.get_mode()

        # -- Inject mode context -------------------------------------------

        if mode is None:
            mode_context = ""
        else:
            mode_context = _MODE_CONTEXT.get(
                mode,
                f"[MAESTRIA MODE: {mode}]\nNo specific mode instructions defined.",
            )

        # -- Inject project customization (fresh per-turn read) ------------

        try:
            project_context = project_config.build_project_context()
        except Exception as exc:
            # Total safety net: the host swallows hook exceptions
            # (fail-open skip), so contain everything here and stay visible.
            # Log only the failure type; messages may carry private paths.
            logger.warning(
                "maestria project customization failed unexpectedly: %s",
                type(exc).__name__,
            )
            project_context = project_config.format_project_error(
                "[maestria] Project customization could not be loaded"
            )

        context = "\n\n".join(
            part for part in (mode_context, project_context) if part
        )
        return {"context": context}

    return pre_llm_hook

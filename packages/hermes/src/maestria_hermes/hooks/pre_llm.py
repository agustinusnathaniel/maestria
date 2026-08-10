"""pre_llm_call hook -- injects mode context.

Mode context is injected into every user message preserving the Hermes
prompt cache (system prompt is not modified).

Trust and tool capability come from trusted native lifecycle state only
(see session.py and permissions.py).  User message text is never a role or
capability source.
"""

from __future__ import annotations

import logging
import pathlib

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

    Injects the current maestria mode directive into every user message.
    Trust is tracked exclusively by the trusted native lifecycle hooks;
    user text never grants capability.
    """

    def pre_llm_hook(**kwargs) -> dict:
        """Inject mode context into the user message."""
        mode = mode_manager.get_mode()

        # -- Inject mode context -------------------------------------------

        context = _MODE_CONTEXT.get(
            mode,
            f"[MAESTRIA MODE: {mode}]\nNo specific mode instructions defined.",
        )

        return {"context": context}

    return pre_llm_hook

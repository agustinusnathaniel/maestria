"""pre_llm_call hook -- injects mode context.

Mode context is injected into every user message preserving the Hermes
prompt cache (system prompt is not modified).

Specialist roles are registered from the trusted subagent lifecycle hook, not
from user-controlled prompt text.  The pre_tool_call hook consumes the
session_id -> role mapping for permission enforcement.
"""

from __future__ import annotations

import pathlib

from maestria_hermes.modes import ModeManager

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
    Specialist role registration is handled by the trusted subagent_start
    lifecycle hook. User messages are never trusted for authorization.
    """

    def pre_llm_hook(**kwargs) -> dict:
        """Inject mode context into the user message.

        Inject mode context for the current session.
        """
        session_id = kwargs.get("session_id", "")
        mode = mode_manager.get_mode(session_id or None)

        # -- Inject mode context -------------------------------------------

        if mode is None:
            return {}

        context = _MODE_CONTEXT.get(
            mode,
            f"[MAESTRIA MODE: {mode}]\nNo specific mode instructions defined.",
        )

        return {"context": context}

    return pre_llm_hook

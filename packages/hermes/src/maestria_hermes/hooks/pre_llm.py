"""pre_llm_call hook -- injects mode context and registers maestria specialist roles.

Mode context is injected into every user message preserving the Hermes
prompt cache (system prompt is not modified).

Maestria specialist roles (builder, reviewer, adventurer, etc.) are parsed
from the user message on the subagent's first turn and registered in the
session_id -> role mapping for permission enforcement.  The orchestrator
includes [MAESTRIA_ROLE: <role>] in the context parameter of delegate_task.
"""

from __future__ import annotations

import logging
import re

from maestria_hermes.modes import ModeManager
from maestria_hermes.session import set_role_for_session

logger = logging.getLogger(__name__)

# Matches [MAESTRIA_ROLE: builder] or [MAESTRIA_ROLE: reviewer] at the
# start of a message.  The role name is captured as group 1.
_ROLE_PATTERN = re.compile(r"^\s*\[MAESTRIA_ROLE:\s*(\w+)\s*\]", re.IGNORECASE)

# Valid maestria specialist roles
_VALID_ROLES = {
    "orchestrator", "adventurer", "architect", "builder",
    "diagnose", "planner", "reviewer", "writer",
}

_MODE_CONTEXT = {
    "fein": (
        "[MAESTRIA MODE: fein]\n"
        "Full methodology pipeline is active:\n"
        "1. Reconnaissance\n"
        "2. Design / planning\n"
        "3. Implementation\n"
        "4. Review\n"
        "All gates are enforced. Default: single-thread execution.\n"
        "Maker/checker split applies when delegation is used."
    ),
    "sonar": (
        "[MAESTRIA MODE: sonar]\n"
        "Research-only mode. You may read, search, and explore, but you "
        "MUST NOT edit, write, or create any files or make any changes. "
        "Gather information, analyze, and report findings."
    ),
    "blitz": (
        "[MAESTRIA MODE: blitz]\n"
        "Fast execution mode. Skip reconnaissance and design phases. "
        "Go directly to implementation. Review is optional unless "
        "explicitly requested."
    ),
}


def create_pre_llm_hook(mode_manager: ModeManager):
    """Create a pre_llm_call hook closure bound to the mode manager.

    Injects the current maestria mode directive into every user message.
    On the subagent's first turn, also parses [MAESTRIA_ROLE: <role>]
    from the user message and registers the specialist role for
    permission enforcement in pre_tool_call.
    """

    def pre_llm_hook(**kwargs) -> dict:
        """Inject mode context into the user message.

        Also registers maestria specialist roles on subagent first turn.
        """
        mode = mode_manager.get_mode()

        # -- Register maestria specialist role (subagent first turn) --------
        session_id = kwargs.get("session_id", "")
        user_message = kwargs.get("user_message", "")
        is_first_turn = kwargs.get("is_first_turn", False)

        if is_first_turn and session_id and user_message:
            m = _ROLE_PATTERN.search(user_message)
            if m:
                role = m.group(1).lower()
                if role in _VALID_ROLES:
                    set_role_for_session(session_id, role)
                    logger.info(
                        "maestria role registered: session=%s role=%s",
                        session_id, role,
                    )
                else:
                    logger.debug(
                        "maestria role '%s' not in valid set, ignored", role,
                    )

        # -- Inject mode context -------------------------------------------

        context = _MODE_CONTEXT.get(
            mode,
            f"[MAESTRIA MODE: {mode}]\nNo specific mode instructions defined.",
        )

        return {"context": context}

    return pre_llm_hook

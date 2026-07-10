"""LLM output middleware -- ensures final responses follow maestria formatting.

Registered as llm_execution middleware to wrap the final LLM response
before it reaches the user.
"""

import logging
from maestria_hermes.modes import ModeManager

logger = logging.getLogger(__name__)


def create_llm_output_middleware(mode_manager: ModeManager):
    """Create LLM execution middleware that adds methodology context.

    Wraps the LLM response to ensure mode and methodology are reflected
    in the final output when appropriate.
    """

    def middleware(next_call, **context):
        """Wrap LLM execution to annotate responses."""
        # Let the LLM call proceed normally
        result = next_call(**context)

        # Add methodology footer for mode awareness
        # Only if the response doesn't already have maestria markers
        if isinstance(result, str) and "[MAESTRIA" not in result:
            mode = mode_manager.get_mode()
            mode_note = {
                "fein": "Fein mode: full methodology pipeline applied.",
                "sonar": "Sonar mode: research only, no changes made.",
                "blitz": "Blitz mode: fast execution, gates skipped.",
            }.get(mode, "")

            if mode_note:
                result = f"{result}\n\n---\n_{mode_note}_"

        return result

    return middleware

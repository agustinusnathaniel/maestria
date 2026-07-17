"""LLM output middleware -- ensures final responses follow maestria formatting.

Registered as llm_execution middleware to wrap the final LLM response
before it reaches the user.

The mode footer is disabled by default to avoid noise. Enable via:
  MAESTRIA_MODE_FOOTER=1  (environment variable)
"""

from __future__ import annotations

import logging
import os
from typing import Any

from maestria_hermes.modes import ModeManager

logger = logging.getLogger(__name__)

# Mode footer is opt-in to avoid adding noise to every response
_MODE_FOOTER_ENABLED = os.environ.get("MAESTRIA_MODE_FOOTER", "0") == "1"


def create_llm_output_middleware(mode_manager: ModeManager):
    """Create LLM execution middleware that adds methodology context.

    Follows the Hermes middleware contract:
      - Receives **kwargs with next_call and request
      - Calls next_call(request) to continue the chain
      - Returns the LLM response (possibly modified)
    """

    def middleware(**kwargs: Any) -> Any:
        """Wrap LLM execution to annotate responses."""
        next_call = kwargs.get("next_call")
        request = kwargs.get("request") or {}

        # Let the LLM call proceed normally
        if callable(next_call):
            result = next_call(request)
        else:
            result = request

        # Add methodology footer for mode awareness (opt-in)
        if _MODE_FOOTER_ENABLED and isinstance(result, str) and "[MAESTRIA" not in result:
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

"""pre_llm_call hook -- injects mode context into every user message.

The returned context dict is appended to the user message before it
reaches the LLM, preserving the Hermes prompt cache (system prompt
is not modified).

The hook only injects mode context. Memory injection was removed in
v0.1-memory-agnostic because memory is a platform concern, not a plugin
concern — Hermes has 8 built-in memory providers and the user chooses
one independently. The plugin must not add a memory layer on top.
"""

from maestria_hermes.modes import ModeManager

_MODE_CONTEXT = {
    "fein": (
        "[MAESTRIA MODE: fein]\n"
        "Full methodology pipeline is active. All stages execute:\n"
        "1. Reconnaissance (adventurer)\n"
        "2. Design / planning (architect / planner)\n"
        "3. Implementation (builder)\n"
        "4. Review (reviewer)\n"
        "All gates are enforced. Maker/checker split applies."
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

    Returns a hook that injects the current maestria mode directive into
    the user message on every turn. No memory context is appended — memory
    is a platform concern managed by Hermes' built-in providers.
    """

    def pre_llm_hook(**kwargs) -> dict:
        """Inject mode context into the user message."""
        mode = mode_manager.get_mode()
        context = _MODE_CONTEXT.get(
            mode,
            f"[MAESTRIA MODE: {mode}]\nNo specific mode instructions defined.",
        )

        return {"context": context}

    return pre_llm_hook

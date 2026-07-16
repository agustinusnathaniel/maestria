"""Maestria methodology plugin for Hermes Agent.

Brings pipeline composition, maker/checker split, specialist delegation,
and mode-based workflows to the general-purpose Hermes AI agent.

Phases:
- Phase 1: Mode system, sonar guard, core hooks, basic skills
- Phase 2: Full specialist roster, permission roles, memory, session state
- Phase 3: MCP, middleware, parallel delegation, kanban integration
"""

import logging

from maestria_hermes._version import __version__
from maestria_hermes.modes import ModeManager
from maestria_hermes.memory import MemoryManager
from maestria_hermes.session import SessionManager, create_session_hooks
from maestria_hermes.hooks.pre_llm import create_pre_llm_hook
from maestria_hermes.hooks.pre_tool import create_pre_tool_hook
from maestria_hermes.hooks.transform import create_transform_tool_result_hook
from maestria_hermes.middleware.llm_output import create_llm_output_middleware
from maestria_hermes.tools.opencode import (
    opencode_route_tool_schema,
    opencode_route_handler,
)

logger = logging.getLogger(__name__)


def register(ctx):
    """Plugin entry point -- called by Hermes during plugin discovery.

    Registers hooks, middleware, tools, commands, and skills for the
    maestria methodology. Probes environment and logs guidance for
    optional backends (Mnemosyne, kanban, OpenCode).
    """
    # -- Probe environment and log guidance ----------------------------------

    _detect_backends(ctx)

    # Initialize singletons
    mode_manager = ModeManager()
    memory_manager = MemoryManager()
    session_manager = SessionManager()

    # -- Phase 1: Core hooks ------------------------------------------------

    ctx.register_hook("pre_llm_call", create_pre_llm_hook(mode_manager, memory_manager))
    ctx.register_hook("pre_tool_call", create_pre_tool_hook(mode_manager))

    # -- Phase 2: Full lifecycle hooks --------------------------------------

    on_start, on_end = create_session_hooks(session_manager)
    ctx.register_hook("on_session_start", on_start)
    ctx.register_hook("on_session_end", on_end)
    ctx.register_hook("subagent_start", _on_subagent_start)
    ctx.register_hook("subagent_stop", _on_subagent_stop)
    ctx.register_hook("transform_tool_result", create_transform_tool_result_hook(mode_manager))

    # -- Phase 3: Middleware ------------------------------------------------

    ctx.register_middleware(
        "llm_execution",
        create_llm_output_middleware(mode_manager),
    )

    # -- Phase 2: Tools -----------------------------------------------------

    ctx.register_tool(
        name="opencode_route",
        toolset="maestria",
        schema=opencode_route_tool_schema(),
        handler=opencode_route_handler,
        description="Delegate a complex coding task to OpenCode CLI",
        emoji="🔧",
    )

    # -- Phase 1: Slash commands --------------------------------------------

    ctx.register_command(
        "fein",
        _cmd_set_mode(mode_manager, "fein"),
        description="Full methodology pipeline with all gates",
    )
    ctx.register_command(
        "sonar",
        _cmd_set_mode(mode_manager, "sonar"),
        description="Research only -- read-only tools, no edits",
    )
    ctx.register_command(
        "blitz",
        _cmd_set_mode(mode_manager, "blitz"),
        description="Fast execution -- skip recon and review gates",
    )
    ctx.register_command(
        "mode",
        _cmd_status(mode_manager),
        description="Show current maestria mode and status",
    )
    ctx.register_command(
        "review",
        _cmd_set_mode(mode_manager, "fein"),
        description="Trigger review of the last output (sets fein mode)",
    )
    ctx.register_command(
        "plan",
        _cmd_set_mode(mode_manager, "fein"),
        description="Trigger a planning session (sets fein mode)",
    )

    # -- Phase 2: Skills ---------------------------------------------------

    import pathlib
    _skills_dir = pathlib.Path(__file__).parent / "skills"

    _skill_registrations = [
        ("orchestrator", _skills_dir / "orchestrator" / "SKILL.md"),
        ("builder",      _skills_dir / "builder" / "SKILL.md"),
        ("reviewer",     _skills_dir / "reviewer" / "SKILL.md"),
        ("global-rules", _skills_dir / "global-rules" / "SKILL.md"),
        ("adventurer",   _skills_dir / "adventurer" / "SKILL.md"),
        ("architect",    _skills_dir / "architect" / "SKILL.md"),
        ("diagnose",     _skills_dir / "diagnose" / "SKILL.md"),
        ("planner",      _skills_dir / "planner" / "SKILL.md"),
        ("writer",       _skills_dir / "writer" / "SKILL.md"),
    ]
    for name, path in _skill_registrations:
        if path.exists():
            try:
                ctx.register_skill(name, path)
            except OSError:
                pass  # Best-effort skill registration


def _detect_backends(ctx):
    """Probe environment for optional backends and log guidance.

    Never blocks, installs, or modifies config. Just informs.
    Uses the tool registry to check for tool availability at startup.
    """
    try:
        from tools.registry import registry
        all_tools = registry.get_all_tool_names()

        if "mnemosyne_remember" not in all_tools:
            logger.info(
                "Mnemosyne not detected. Memory will use JSONL fallback. "
                "See docs/hermes-maestria-plugin.md for optional setup."
            )
        else:
            logger.debug("Mnemosyne detected — memory can use semantic recall.")
    except Exception:
        pass  # Probe failed silently -- not critical

    try:
        from tools.registry import registry
        toolsets = registry.get_registered_toolset_names()

        if "kanban" not in toolsets:
            logger.info(
                "Kanban toolset not detected. Pipeline tracking uses in-memory state. "
                "Enable via `hermes config set kanban.enabled true`."
            )
        else:
            logger.debug("Kanban toolset detected — pipeline can use task board.")
    except Exception:
        pass


def _cmd_set_mode(mode_manager, mode):
    """Return a slash command handler that switches modes."""
    def handler(_raw_args: str) -> str:
        mode_manager.set_mode(mode)
        pipeline = {
            "fein": "adventurer / architect -> builder -> reviewer",
            "sonar": "adventurer / architect -> STOP (read-only)",
            "blitz": "builder (skip recon and review)",
        }
        return (
            f"Switched to **{mode}** mode.\n"
            f"Pipeline: {pipeline.get(mode, 'unknown')}"
        )

    return handler


def _cmd_status(mode_manager):
    """Return a slash command handler that shows current mode status."""
    def handler(_raw_args: str) -> str:
        mode = mode_manager.get_mode()
        return (
            f"**Maestria Status**\n\n"
            f"Mode: **{mode}**\n"
            f"Read-only: {'Yes' if mode_manager.is_read_only() else 'No'}"
        )
    return handler


def _on_subagent_start(**kwargs) -> None:
    """Log when a subagent is spawned for pipeline tracking.

    Kwargs (from delegate_tool.py):
        child_session_id: str — spawned agent's session id
        child_role: str — specialist role (builder, reviewer, etc.)
        child_goal: str — the task goal
        parent_session_id: str — orchestrator's session id
    """
    child_session_id = kwargs.get("child_session_id", "unknown")
    child_role = kwargs.get("child_role", "unknown")
    child_goal = kwargs.get("child_goal", "")

    if child_role and child_role != "unknown":
        logger.info(
            "maestria subagent started: role=%s session=%s",
            child_role, child_session_id,
        )
    if child_goal:
        logger.debug("maestria subagent goal: %s", child_goal[:200])


def _on_subagent_stop(**kwargs) -> None:
    """Log when a subagent completes for pipeline tracking.

    Kwargs (from delegate_tool.py):
        child_session_id: str — completed agent's session id
        child_role: str — specialist role
        child_summary: str — result summary
        child_status: str — completion status
        duration_ms: int — wall-clock duration in milliseconds
        parent_session_id: str — orchestrator's session id
    """
    child_session_id = kwargs.get("child_session_id", "unknown")
    child_role = kwargs.get("child_role", "unknown")
    child_status = kwargs.get("child_status", "unknown")
    duration_ms = kwargs.get("duration_ms", 0)

    logger.info(
        "maestria subagent stopped: role=%s session=%s status=%s duration=%.1fs",
        child_role, child_session_id, child_status, duration_ms / 1000.0,
    )

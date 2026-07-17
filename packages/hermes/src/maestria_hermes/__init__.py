"""@maestria/hermes — Maestria methodology adapter for Hermes Agent.

Registers mode system (fein/sonar/blitz), 9 specialist skill files,
permission roles, pipeline lifecycle hooks, and OpenCode CLI routing tool.
Entry point: register(ctx) — loaded via plugin.yaml discovery.

Design docs at docs/hermes-maestria-plugin.md.
"""

import logging
import shutil

from maestria_hermes.hooks.pre_llm import create_pre_llm_hook
from maestria_hermes.hooks.pre_tool import create_pre_tool_hook
from maestria_hermes.hooks.transform import create_transform_tool_result_hook
from maestria_hermes.middleware.llm_output import create_llm_output_middleware
from maestria_hermes.modes import ModeManager
from maestria_hermes.permissions import init_roles
from maestria_hermes.session import SessionManager, create_session_hooks
from maestria_hermes.tools.opencode import (
    opencode_route_handler,
    opencode_route_tool_schema,
)

logger = logging.getLogger(__name__)


def register(ctx):
    """Plugin entry point -- called by Hermes during plugin discovery.

    Registers hooks, middleware, tools, commands, and skills for the
    maestria methodology.
    """

    # Initialize singletons
    mode_manager = ModeManager()
    session_manager = SessionManager()
    init_roles()  # Load role permissions (from file or defaults)

    # ...

    ctx.register_hook("pre_llm_call", create_pre_llm_hook(mode_manager))
    ctx.register_hook("pre_tool_call", create_pre_tool_hook(mode_manager))

    # -- Phase 2: Full lifecycle hooks --------------------------------------
    # Backend detection runs on first session start so all plugins are loaded.

    on_start, on_end = create_session_hooks(session_manager)
    _detection_run = [False]

    def _on_session_start_wrapped(**kwargs):
        if not _detection_run[0]:
            _detect_backends(ctx)
            _detection_run[0] = True
        on_start(**kwargs)

    ctx.register_hook("on_session_start", _on_session_start_wrapped)
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
        check_fn=_opencode_available,
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
        description="Activate full methodology pipeline (fein mode) with review gate",
    )
    ctx.register_command(
        "plan",
        _cmd_set_mode(mode_manager, "fein"),
        description="Activate full methodology pipeline (fein mode) with planning phase",
    )

    # -- Phase 2: Skills ----------------------------------------------------

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


def _opencode_available() -> bool:
    """Check_fn for opencode_route: hide tool when OpenCode CLI is missing."""
    try:
        return shutil.which("opencode") is not None
    except Exception:
        return False


def _detect_backends(ctx):
    """Probe environment for the optional OpenCode CLI and log guidance.

    This is the only backend probe the plugin performs. Memory (Mnemosyne,
    holographic, etc.) and kanban are deliberately NOT probed:

    - **Memory is a platform concern.** Hermes has 8 built-in memory providers.
      The user chooses one independently. The plugin must not care which is
      configured — adding a probe or fallback would couple the plugin to a
      specific backend and duplicate platform functionality.

    - **Kanban is a platform feature.** Available via kanban_* tools when
      enabled in the user's config. The plugin doesn't need to know.

    OpenCode CLI is the exception: it's an external tool the plugin can optionally
    route to. The probe checks availability so the opencode_route tool is only
    visible when the CLI is actually installed.
    """
    # Check @maestria/opencode plugin (needed for opencode_route tool)
    try:
        if shutil.which("opencode"):
            # OpenCode CLI is installed; check for plugin
            from maestria_hermes.tools.opencode import _check_maestria_plugin
            plugin_err = _check_maestria_plugin()
            if plugin_err:
                logger.warning(
                    "OpenCode CLI found but %s missing. "
                    "The opencode_route tool will require install. "
                    "Run: pnpx maestria@latest install opencode",
                    "@maestria/opencode",
                )
            else:
                logger.debug(
                    "@maestria/opencode plugin found — "
                    "opencode_route tool is fully operational."
                )
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
        child_subagent_id: str — spawned agent's unique id
        child_role: str — specialist role (builder, reviewer, etc.)
        child_goal: str — the task goal
        parent_session_id: str — orchestrator's session id
        parent_turn_id: str — orchestrator's turn id
        parent_subagent_id: str — orchestrator's subagent id
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

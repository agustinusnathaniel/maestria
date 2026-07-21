"""@maestria/hermes — Maestria methodology adapter for Hermes Agent.

Registers mode system (fein/sonar/blitz), 9 specialist skill files,
permission roles, pipeline lifecycle hooks, and OpenCode CLI routing tool.
Entry point: register(ctx) — loaded via plugin.yaml discovery.

Design docs at docs/hermes-maestria-plugin.md.
"""

import logging
import pathlib
import re

from maestria_hermes.hooks.pre_gateway import create_pre_gateway_hook
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

# Matches `description: "..."` in YAML frontmatter
_FM_DESC_RE = re.compile(r'^description:\s*"(.+)"', re.MULTILINE)


def _load_cmd_description(skill_path: pathlib.Path, fallback: str) -> str:
    """Load command description from synced SKILL.md frontmatter."""
    if skill_path.exists():
        try:
            content = skill_path.read_text(encoding="utf-8")
            if content.startswith("---"):
                end = content.find("---\n", 3)
                if end != -1:
                    fm = content[3:end]
                    m = _FM_DESC_RE.search(fm)
                    if m:
                        return m.group(1)
        except OSError:
            pass
    return fallback


def register(ctx):
    """Plugin entry point -- called by Hermes during plugin discovery.

    Registers hooks, middleware, tools, commands, and skills for the
    maestria methodology.
    """

    # Initialize singletons
    mode_manager = ModeManager()
    session_manager = SessionManager()
    init_roles()  # Load role permissions (from file or defaults)

    # -- Phase 0: Pre-gateway command dispatch (runs before agent-busy check) --
    ctx.register_hook(
        "pre_gateway_dispatch",
        create_pre_gateway_hook(mode_manager),
    )

    # -- Phase 2: LLM lifecycle hooks --------------------------------------

    ctx.register_hook("pre_llm_call", create_pre_llm_hook(mode_manager))
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

    _skills_dir = pathlib.Path(__file__).parent / "skills"

    ctx.register_command(
        "fein",
        _cmd_set_mode(mode_manager, "fein"),
        description=_load_cmd_description(
            _skills_dir / "commands" / "fein" / "SKILL.md",
            "Full pipeline mode: reconnaissance, design, implementation, review",
        ),
    )
    ctx.register_command(
        "sonar",
        _cmd_set_mode(mode_manager, "sonar"),
        description=_load_cmd_description(
            _skills_dir / "commands" / "sonar" / "SKILL.md",
            "Research-only mode: reconnaissance and design only, no implementation",
        ),
    )
    ctx.register_command(
        "blitz",
        _cmd_set_mode(mode_manager, "blitz"),
        description=_load_cmd_description(
            _skills_dir / "commands" / "blitz" / "SKILL.md",
            "Fast implementation mode: skip gates, go directly to implementation",
        ),
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

        # Command workflow modes (fein/sonar/blitz)
        ("command-fein",   _skills_dir / "commands" / "fein" / "SKILL.md"),
        ("command-sonar",  _skills_dir / "commands" / "sonar" / "SKILL.md"),
        ("command-blitz",  _skills_dir / "commands" / "blitz" / "SKILL.md"),
    ]
    for name, path in _skill_registrations:
        if path.exists():
            try:
                ctx.register_skill(name, path)
            except OSError:
                pass  # Best-effort skill registration


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

    Role registration for permission enforcement is handled by the
    pre_llm_call hook, which parses [MAESTRIA_ROLE: <role>] from the
    delegate_task context on the subagent's first turn.  This hook
    exists solely for observability.

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

    Role cleanup is unnecessary — the pre_llm_call hook manages
    session->role registration per-turn.  This hook exists solely
    for observability.

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
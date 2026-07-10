"""Maestria methodology plugin for Hermes Agent.

Brings pipeline composition, maker/checker split, specialist delegation,
and mode-based workflows to the general-purpose Hermes AI agent.
"""

from maestria_hermes._version import __version__
from maestria_hermes.modes import ModeManager
from maestria_hermes.hooks.pre_llm import create_pre_llm_hook
from maestria_hermes.hooks.pre_tool import create_pre_tool_hook


def register(ctx):
    """Plugin entry point -- called by Hermes during plugin discovery.

    Registers hooks, slash commands, and skills for the maestria methodology.
    """
    # Initialize mode manager (singleton -- persists across hook invocations)
    mode_manager = ModeManager()

    # Register lifecycle hooks
    ctx.register_hook("pre_llm_call", create_pre_llm_hook(mode_manager))
    ctx.register_hook("pre_tool_call", create_pre_tool_hook(mode_manager))

    # Register slash commands
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

    import pathlib
    _skills_dir = pathlib.Path(__file__).parent / "skills"

    # Register plugin skills (namespaced as maestria-hermes:<name>)
    skill_files = [
        ("orchestrator", _skills_dir / "orchestrator" / "SKILL.md"),
        ("builder", _skills_dir / "builder" / "SKILL.md"),
        ("reviewer", _skills_dir / "reviewer" / "SKILL.md"),
        ("global-rules", _skills_dir / "global-rules" / "SKILL.md"),
    ]
    for name, path in skill_files:
        if path.exists():
            ctx.register_skill(name, path)


def _cmd_set_mode(mode_manager, mode):
    """Return a slash command handler that switches modes."""
    from functools import partial

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

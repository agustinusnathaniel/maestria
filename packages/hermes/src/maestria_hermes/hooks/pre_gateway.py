"""pre_gateway_dispatch hook -- intercepts maestria slash commands before agent-busy check.

Registered commands: /fein, /sonar, /blitz, /mode, /review, /plan
These are handled here so they dispatch even when the agent is busy
processing a turn (the normal plugin command dispatch at gateway/run.py:9007
runs AFTER the agent-busy gate and never fires during active turns).

The hook fires the response asynchronously via the gateway's adapter,
then returns {"action": "skip"} to prevent the message from reaching the LLM.
"""

from __future__ import annotations

import asyncio
import logging
import pathlib
import re
from typing import Any, Optional

from maestria_hermes.modes import ModeManager

logger = logging.getLogger(__name__)

# Commands this hook handles
_MAESTRIA_COMMANDS = {"fein", "sonar", "blitz", "mode", "review", "plan"}

_FM_DESC_RE = re.compile(r'^description:\s*"(.+)"', re.MULTILINE)
_COMMANDS_DIR = pathlib.Path(__file__).parent.parent / "skills" / "commands"


def _load_pipeline_desc(name: str, fallback: str) -> str:
    """Load pipeline description from synced command SKILL.md frontmatter."""
    path = _COMMANDS_DIR / name / "SKILL.md"
    if path.exists():
        try:
            content = path.read_text(encoding="utf-8")
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


_PIPELINE_DESC = {
    "fein": _load_pipeline_desc(
        "fein",
        "Full pipeline mode: reconnaissance, design, implementation, review",
    ),
    "sonar": _load_pipeline_desc(
        "sonar",
        "Research-only mode: reconnaissance and design only, no implementation",
    ),
    "blitz": _load_pipeline_desc(
        "blitz",
        "Fast implementation mode: skip gates, go directly to implementation",
    ),
}


def create_pre_gateway_hook(mode_manager: ModeManager):
    """Create a pre_gateway_dispatch hook closure bound to mode_manager.

    The hook must be synchronous (Hermes invoke_hook does not await
    coroutines).  We schedule the response send as a background task
    on the running event loop.
    """

    def _send_response(gateway, source, text: str) -> None:
        """Fire-and-forget send a response via the gateway adapter."""
        try:
            adapter = gateway.adapters.get(source.platform)
            if adapter is None:
                logger.warning("pre_gateway: no adapter for platform %s", source.platform)
                return
            loop = asyncio.get_event_loop()
            if loop.is_running():
                metadata = {}
                if hasattr(source, "thread_id") and source.thread_id:
                    metadata["thread_id"] = source.thread_id
                loop.create_task(adapter.send(source.chat_id, text, metadata=metadata))
            else:
                logger.warning("pre_gateway: no running event loop, can't send response")
        except Exception as e:
            logger.warning("pre_gateway: failed to send response: %s", e)

    def pre_gateway_hook(
        event: Any,
        gateway: Optional[Any] = None,
        **kwargs: Any,
    ) -> Optional[dict]:
        """Intercept maestria slash commands.

        Returns:
            {"action": "skip"} when the command is handled (message dropped).
            None to let normal dispatch proceed.
        """
        cmd = event.get_command()
        if not cmd or cmd not in _MAESTRIA_COMMANDS:
            return None

        if cmd == "mode":
            mode = mode_manager.get_mode()
            response = (
                f"**Maestria Status**\n\n"
                f"Mode: **{mode}**\n"
                f"Read-only: {'Yes' if mode_manager.is_read_only() else 'No'}"
            )

        elif cmd in ("fein", "sonar", "blitz"):
            mode_manager.set_mode(cmd)
            response = (
                f"Switched to **{cmd}** mode.\n"
                f"Pipeline: {_PIPELINE_DESC.get(cmd, 'unknown')}"
            )

        elif cmd in ("review", "plan"):
            mode_manager.set_mode("fein")
            response = (
                f"Switched to **fein** mode.\n"
                f"Pipeline: {_PIPELINE_DESC['fein']}"
            )

        else:
            return None  # Shouldn't reach here

        logger.info("pre_gateway: handled /%s (mode=%s)", cmd, mode_manager.get_mode())

        # Fire response asynchronously
        if gateway is not None:
            _send_response(gateway, event.source, response)

        return {"action": "skip", "reason": f"handled by maestria /{cmd}"}

    return pre_gateway_hook
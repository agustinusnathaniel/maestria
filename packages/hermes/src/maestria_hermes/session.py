"""Session lifecycle management for the maestria methodology.

Tracks pipeline execution state across sessions using on_session_start
and on_session_end hooks. Session metadata (start/end time, session_id)
is already tracked by Hermes' SessionDB — no separate file needed.

Also provides a session_id -> native child role mapping used by the
pre_tool_call hook. The mapping is populated by subagent_start and consumed
by pre_tool_call, working around Hermes not passing child_role to tool hooks.
"""

from __future__ import annotations

import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# -- Session → role mapping ------------------------------------------------
# Tracks which maestria specialist role is active for each Hermes session.

_session_role_map: Dict[str, str] = {}
_subagent_session_map: Dict[str, str] = {}


def get_role_for_session(session_id: str) -> str:
    """Return the maestria specialist role active in *session_id*, or empty."""
    return _session_role_map.get(session_id, "")


def set_role_for_session(
    session_id: str,
    role: str,
    subagent_id: Optional[str] = None,
) -> None:
    """Associate a session with a maestria specialist role."""
    if session_id and role:
        _session_role_map[session_id] = role
        if subagent_id:
            _subagent_session_map[subagent_id] = session_id


def clear_role_for_session(session_id: str) -> None:
    """Remove the role mapping for a completed session."""
    _session_role_map.pop(session_id, None)
    for subagent_id, mapped_session in list(_subagent_session_map.items()):
        if mapped_session == session_id:
            _subagent_session_map.pop(subagent_id, None)


def clear_role_for_subagent(subagent_id: str) -> None:
    """Remove a role using Hermes' native subagent identity."""
    session_id = _subagent_session_map.pop(subagent_id, None)
    if session_id:
        _session_role_map.pop(session_id, None)


# ---------------------------------------------------------------------------


class SessionManager:
    """Tracks session state for the methodology pipeline.

    Lightweight — SessionDB already persists session metadata.
    This manager exists for future integration points (kanban task
    claiming on session start, cleanup on session end).
    """

    def __init__(self):
        self._session_id: Optional[str] = None

    def on_session_start(self, **kwargs) -> None:
        """Called when a new Hermes session starts."""
        session_id = kwargs.get("session_id", "unknown")
        self._session_id = session_id
        logger.debug("maestria session started: %s", session_id)

    def on_session_end(self, **kwargs) -> None:
        """Called when a Hermes session ends."""
        session_id = kwargs.get("session_id", self._session_id)
        if session_id:
            clear_role_for_session(session_id)
        logger.debug("maestria session ended: %s", session_id)


def create_session_hooks(session_manager: SessionManager, mode_manager=None):
    """Create on_session_start and on_session_end hook closures."""

    def on_start(**kwargs):
        session_manager.on_session_start(**kwargs)
        if mode_manager is not None:
            mode_manager.set_session(kwargs.get("session_id"))

    def on_end(**kwargs):
        session_manager.on_session_end(**kwargs)
        if mode_manager is not None:
            mode_manager.clear_session(kwargs.get("session_id"))

    return on_start, on_end

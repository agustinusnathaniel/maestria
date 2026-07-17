"""Session lifecycle management for the maestria methodology.

Tracks pipeline execution state across sessions using on_session_start
and on_session_end hooks. Session metadata (start/end time, session_id)
is already tracked by Hermes' SessionDB — no separate file needed.

The hooks exist to forward pipeline-relevant context (current mode,
active specialist) for future kanban or goals integration.
"""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)


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
        logger.debug("maestria session ended: %s", session_id)


def create_session_hooks(session_manager: SessionManager):
    """Create on_session_start and on_session_end hook closures."""

    def on_start(**kwargs):
        session_manager.on_session_start(**kwargs)

    def on_end(**kwargs):
        session_manager.on_session_end(**kwargs)

    return on_start, on_end

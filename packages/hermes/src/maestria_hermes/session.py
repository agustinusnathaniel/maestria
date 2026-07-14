"""Session lifecycle management for the maestria methodology.

Tracks pipeline execution state across sessions using on_session_start
and on_session_end hooks.
"""

import json
import os
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


def _get_session_path() -> Path:
    """Return path to the session state file."""
    hermes_home = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
    return hermes_home / "maestria-session.json"


class SessionManager:
    """Tracks session state for the methodology pipeline."""

    def __init__(self):
        self._session_id: Optional[str] = None
        self._path = _get_session_path()

    def on_session_start(self, **kwargs) -> None:
        """Called when a new Hermes session starts."""
        session_id = kwargs.get("session_id", "unknown")
        self._session_id = session_id
        state = {
            "session_id": session_id,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "model": kwargs.get("model", ""),
            "platform": kwargs.get("platform", ""),
        }
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text(
                json.dumps(state, indent=2), encoding="utf-8"
            )
        except OSError as e:
            logger.debug("Failed to persist session state: %s", e)

    def on_session_end(self, **kwargs) -> None:
        """Called when a Hermes session ends."""
        session_id = kwargs.get("session_id", self._session_id)
        completed = kwargs.get("completed", True)
        try:
            state = {
                "session_id": session_id,
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "completed": completed,
            }
            self._path.write_text(
                json.dumps(state, indent=2), encoding="utf-8"
            )
        except OSError as e:
            logger.debug("Failed to save session end state: %s", e)


def create_session_hooks(session_manager: SessionManager):
    """Create on_session_start and on_session_end hook closures."""

    def on_start(**kwargs):
        session_manager.on_session_start(**kwargs)

    def on_end(**kwargs):
        session_manager.on_session_end(**kwargs)

    return on_start, on_end

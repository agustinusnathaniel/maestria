"""Mode state machine for the maestria methodology.

Supports three modes:
- fein:  Full pipeline with all gates
- sonar: Research only -- read-only tools, no edits
- blitz: Direct execution -- no Maestria child during execution; artifacts that land require
  independent review

No mode is active by default. Explicit slash-command selections persist per
session via a JSON state file (bundled fallback). A selection is never applied
to another session.
The plugin is memory-engine agnostic — no memory backend is required or
assumed for mode state to work correctly.
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Optional

VALID_MODES = {"fein", "sonar", "blitz"}
DEFAULT_MODE = None
_UNSET = object()


def _get_state_path() -> Path:
    """Return path to the mode state file."""
    hermes_home = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
    return hermes_home / "maestria-mode.json"


class ModeManager:
    """Mode state machine with file persistence.

    The instance is created once in register() and captured by each
    hook closure, so state is consistent across hook invocations within
    a session.

    Persists via JSON file (works everywhere, no deps). Memory backend
    integration is deliberately not pursued — see Principle #2 (memory-
    engine agnostic) in the design doc.
    """

    def __init__(self, session_id: Optional[str] = None):
        self._session_id: Optional[str] = None
        self._loaded_session_id = _UNSET
        self._mode: Optional[str] = None
        self.set_session(session_id)

    # -- public API -----------------------------------------------------------

    def get_mode(self, session_id: Optional[str] = None) -> Optional[str]:
        """Return the explicit mode for *session_id*, or the active session."""
        selected_session = session_id or self._session_id
        if selected_session != self._loaded_session_id:
            self._load(selected_session)
        return self._mode

    def set_session(self, session_id: Optional[str]) -> None:
        """Select the active conversation whose mode should be read/written."""
        self._session_id = session_id or None
        self._load(self._session_id)

    def clear_session(self, session_id: Optional[str] = None) -> None:
        """Stop using a completed session as the implicit command context."""
        if session_id is None or session_id == self._session_id:
            self.set_session(None)

    def inherit_session(self, parent_session_id: str, child_session_id: str) -> None:
        """Copy a parent's explicit mode to a trusted child conversation."""
        mode = self.get_mode(parent_session_id)
        if mode and child_session_id:
            self.set_mode(mode, child_session_id)

    def set_mode(self, mode: str, session_id: Optional[str] = None) -> None:
        """Set a new mode and persist to state file."""
        normalized = mode.strip().lower()
        if normalized not in VALID_MODES:
            raise ValueError(
                f"Invalid mode '{mode}'. Choose from: {', '.join(sorted(VALID_MODES))}"
            )
        selected_session = session_id or self._session_id
        self._loaded_session_id = selected_session
        self._mode = normalized
        if selected_session:
            self._save(selected_session)

    def is_read_only(self, session_id: Optional[str] = None) -> bool:
        """Return True if the current mode restricts write/edit tools."""
        return self.get_mode(session_id) == "sonar"

    # -- persistence ----------------------------------------------------------

    def _load(self, session_id: Optional[str]) -> None:
        """Load only the mode belonging to the selected session."""
        self._loaded_session_id = session_id
        self._mode = None
        if not session_id:
            return
        path = _get_state_path()
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                sessions = data.get("sessions", {})
                mode = sessions.get(session_id) if isinstance(sessions, dict) else None
                if mode in VALID_MODES:
                    self._mode = mode
                    return
            except (json.JSONDecodeError, OSError):
                pass

    def _save(self, session_id: str) -> None:
        """Persist current mode to the state file (atomic write)."""
        path = _get_state_path()
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            sessions = {}
            if path.exists():
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                    existing = data.get("sessions", {})
                    if isinstance(existing, dict):
                        sessions = {
                            key: value
                            for key, value in existing.items()
                            if value in VALID_MODES
                        }
                except (json.JSONDecodeError, OSError):
                    pass
            sessions[session_id] = self._mode
            # Atomic write: write to temp, then rename
            fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump({"sessions": sessions}, f, indent=2)
                os.replace(tmp, path)
            except Exception:
                os.unlink(tmp)
                raise
        except OSError:
            pass  # Best-effort persistence

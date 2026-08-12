"""Mode state machine for the maestria methodology.

Supports three modes:
- fein:  Full pipeline with all gates (default)
- sonar: Research only -- read-only tools, no edits
- blitz: Fast execution -- skip optional recon/design ceremony;
  required review and safety floors remain

Mode persists globally across Hermes sessions via a JSON state file (bundled fallback);
`/mode-clear` persists neutral routing. This global scope is a platform limitation,
not session isolation.
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
DEFAULT_MODE = "fein"


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

    def __init__(self):
        self._mode: Optional[str] = None
        self._loaded = False
        self._load()

    # -- public API -----------------------------------------------------------

    def get_mode(self) -> Optional[str]:
        """Return the current mode, or None after an explicit neutral reset."""
        if not self._loaded:
            self._load()
        return self._mode

    def set_mode(self, mode: str) -> None:
        """Set a new mode and persist to state file."""
        normalized = mode.strip().lower()
        if normalized not in VALID_MODES:
            raise ValueError(
                f"Invalid mode '{mode}'. Choose from: {', '.join(sorted(VALID_MODES))}"
            )
        self._mode = normalized
        self._loaded = True
        self._save()

    def clear_mode(self) -> None:
        """Clear the explicit mode and persist neutral routing."""
        self._mode = None
        self._loaded = True
        self._save()

    def is_read_only(self) -> bool:
        """Return True if the current mode restricts write/edit tools."""
        return self.get_mode() == "sonar"

    # -- persistence ----------------------------------------------------------

    def _load(self) -> None:
        """Load mode from the state file, falling back to default."""
        path = _get_state_path()
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                mode = data.get("mode", DEFAULT_MODE)
                if mode is None:
                    self._mode = None
                    self._loaded = True
                    return
                if mode in VALID_MODES:
                    self._mode = mode
                    self._loaded = True
                    return
            except (json.JSONDecodeError, OSError):
                pass
        self._mode = DEFAULT_MODE
        self._loaded = True

    def _save(self) -> None:
        """Persist current mode to the state file (atomic write)."""
        path = _get_state_path()
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            # Atomic write: write to temp, then rename
            fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump({"mode": self._mode}, f, indent=2)
                os.replace(tmp, path)
            except Exception:
                os.unlink(tmp)
                raise
        except OSError:
            pass  # Best-effort persistence

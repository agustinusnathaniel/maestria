"""Mode state machine for the maestria methodology.

Supports three modes:
- fein:  Full pipeline with all gates (default)
- sonar: Research only -- read-only tools, no edits
- blitz: Fast execution -- skip recon and review gates

Mode persists across sessions via a JSON state file.
"""

import json
import os
from pathlib import Path
from typing import Optional


VALID_MODES = {"fein", "sonar", "blitz"}
DEFAULT_MODE = "fein"


def _get_state_path() -> Path:
    """Return path to the mode state file."""
    hermes_home = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
    return hermes_home / "maestria-mode.json"


class ModeManager:
    """Singleton-ish mode manager with file persistence.

    The instance is created once in register() and captured by each
    hook closure, so state is consistent across hook invocations within
    a session.
    """

    def __init__(self):
        self._mode: Optional[str] = None
        self._load()

    # -- public API -----------------------------------------------------------

    def get_mode(self) -> str:
        """Return the current mode (loaded from file or default)."""
        if self._mode is None:
            self._load()
        return self._mode or DEFAULT_MODE

    def set_mode(self, mode: str) -> None:
        """Set a new mode and persist to state file."""
        normalized = mode.strip().lower()
        if normalized not in VALID_MODES:
            raise ValueError(
                f"Invalid mode '{mode}'. Choose from: {', '.join(sorted(VALID_MODES))}"
            )
        self._mode = normalized
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
                if mode in VALID_MODES:
                    self._mode = mode
                    return
            except (json.JSONDecodeError, OSError):
                pass
        self._mode = DEFAULT_MODE

    def _save(self) -> None:
        """Persist current mode to the state file."""
        path = _get_state_path()
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps({"mode": self._mode}, indent=2),
                encoding="utf-8",
            )
        except OSError:
            pass  # Best-effort persistence

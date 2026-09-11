"""Mode state machine for the maestria methodology.

Supports three modes:
- fein:  Full pipeline with all gates (default)
- sonar: Research only -- read-only tools, no edits
- blitz: Fast execution -- skip optional recon/design ceremony;
  required review and safety floors remain

Also owns the shared slash-command presentation: the command-name set, the
synced frontmatter description loader, and the mode status/switch text used
by both command registration and pre-gateway dispatch.

Mode persists globally across Hermes sessions via a JSON state file (bundled fallback);
`/mode-clear` persists neutral routing. This global scope is a platform limitation,
not session isolation.
The plugin is memory-engine agnostic - no memory backend is required or
assumed for mode state to work correctly.
"""
from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path
from typing import Optional

VALID_MODES = {"fein", "sonar", "blitz"}
DEFAULT_MODE = "fein"

# Every slash command the plugin registers and pre-gateway dispatch handles.
# Single source of truth: the plugin registration tests assert register()
# exposes exactly this set, so neither path can drift from the other.
MAESTRIA_COMMANDS = frozenset({"fein", "sonar", "blitz", "mode", "mode-clear", "review", "plan"})

# Fallback descriptions for the mode commands, used when the synced SKILL.md
# frontmatter is unavailable.  Keys are the mode-switch command names.
COMMAND_DESCRIPTION_FALLBACKS = {
    "fein": "Full pipeline mode: reconnaissance, design, implementation, review",
    "sonar": "Research-only mode: reconnaissance and design only, no implementation",
    "blitz": (
        "Fast implementation mode: skip optional ceremony for familiar low-risk work; "
        "required review and safety floors remain"
    ),
}

# Matches `description: "..."` in YAML frontmatter
_FM_DESC_RE = re.compile(r'^description:\s*"(.+)"', re.MULTILINE)


def load_command_description(skill_path: Path, fallback: str) -> str:
    """Load a command description from synced SKILL.md frontmatter."""
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


def render_mode_status(mode: Optional[str], read_only: bool) -> str:
    """Render the shared /mode status text.

    ``None`` renders as the neutral label, so the command handler and the
    pre-gateway dispatch show the same status after /mode-clear.
    """
    label = mode or "neutral"
    return (
        f"**Maestria Status**\n\n"
        f"Mode: **{label}**\n"
        f"Read-only: {'Yes' if read_only else 'No'}"
    )


def render_mode_switch(mode: str, pipeline: str) -> str:
    """Render the shared mode-switch response for a mode and pipeline text."""
    return f"Switched to **{mode}** mode.\nPipeline: {pipeline}"


def render_mode_clear() -> str:
    """Render the shared /mode-clear response."""
    return "Cleared Maestria mode. Neutral routing is active."


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
    integration is deliberately not pursued - see Principle #2 (memory-
    engine agnostic) in the design doc.
    """

    def __init__(self):
        self._mode: Optional[str] = None
        self._load()

    # -- public API -----------------------------------------------------------

    def get_mode(self) -> Optional[str]:
        """Return the current mode, or None after an explicit neutral reset."""
        return self._mode

    def set_mode(self, mode: str) -> None:
        """Set a new mode and persist to state file."""
        normalized = mode.strip().lower()
        if normalized not in VALID_MODES:
            raise ValueError(
                f"Invalid mode '{mode}'. Choose from: {', '.join(sorted(VALID_MODES))}"
            )
        self._mode = normalized
        self._save()

    def clear_mode(self) -> None:
        """Clear the explicit mode and persist neutral routing."""
        self._mode = None
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
                    return
                if mode in VALID_MODES:
                    self._mode = mode
                    return
            except (json.JSONDecodeError, OSError):
                pass
        self._mode = DEFAULT_MODE

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

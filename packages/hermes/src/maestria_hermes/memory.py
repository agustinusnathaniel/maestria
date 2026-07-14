"""Memory integration for the maestria methodology.

Stores decisions, user preferences, and project context across sessions.
Uses a simple append-only JSON log as the default backend, swappable for
holographic/mem0 providers later.
"""

import json
import os
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def _get_memory_path() -> Path:
    """Return path to the memory log file."""
    hermes_home = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
    return hermes_home / "maestria-memory.jsonl"


class MemoryManager:
    """Append-only memory log for storing methodology-relevant context.

    Each entry is a JSON line with timestamp, category, and content.
    """

    def __init__(self):
        self._path = _get_memory_path()

    def record(self, category: str, content: Dict[str, Any]) -> None:
        """Record a memory entry (decision, preference, fact, etc.)."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "category": category,
            **content,
        }
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            with open(self._path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except OSError:
            pass  # Best-effort

    def recall(self, category: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieve recent memory entries, optionally filtered by category."""
        if not self._path.exists():
            return []
        try:
            entries: List[Dict[str, Any]] = []
            with open(self._path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        if category is None or entry.get("category") == category:
                            entries.append(entry)
                    except json.JSONDecodeError:
                        continue
            return entries[-limit:]
        except OSError:
            return []

    def recall_context(self) -> str:
        """Return a concise context string for injection into pre_llm_call."""
        entries = self.recall(limit=10)
        if not entries:
            return ""
        parts: List[str] = ["[MAESTRIA MEMORY]"]
        for e in entries:
            cat = e.get("category", "note")
            summary = e.get("summary", e.get("content", str(e)))
            parts.append(f"- {cat}: {summary[:200]}")
        return "\n".join(parts)

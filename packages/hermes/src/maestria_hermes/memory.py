"""Memory integration for the maestria methodology.

Stores decisions, user preferences, and project context across sessions.
Uses append-only JSONL as the bundled fallback (zero deps, always works).

When Mnemosyne is available, the plugin should dispatch to it instead:
  ctx.dispatch_tool("mnemosyne_remember", {
      "content": "...", "type": "decision", "tags": ["maestria"]
  })

Detection + fallback is handled at register() time (see __init__.py).
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def _get_memory_path() -> Path:
    """Return path to the memory log file."""
    hermes_home = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
    return hermes_home / "maestria-memory.jsonl"


class MemoryManager:
    """Append-only memory log (JSONL), with Mnemosyne dispatch planned.

    Each entry is a JSON line with timestamp, category, and content.
    The bundled JSONL fallback works everywhere. When Mnemosyne is
    detected at register(), methods should dispatch to Mnemosyne tools
    for semantic recall, canonical facts, and sleep-cycle compaction.
    """

    def __init__(self):
        self._path = _get_memory_path()

    def record(self, category: str, content: Dict[str, Any]) -> None:
        """Record a memory entry (decision, preference, fact, etc.).

        Future: when Mnemosyne is available, dispatch to:
          ctx.dispatch_tool("mnemosyne_remember", {content, type=category, tags})
        """
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
        """Retrieve recent memory entries, optionally filtered by category.

        Future: when Mnemosyne is available, dispatch to:
          ctx.dispatch_tool("mnemosyne_recall", {query, tags, limit})
        """
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

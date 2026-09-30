"""Allowlist integrity against the live Hermes tool registry.

The mode and delegated-child allowlists gate a DENY, so a name that is not a
real Hermes tool is inert - it can never widen access. The failure mode is
the opposite of a security hole: the policy silently narrows to the few names
that happen to exist, while the source still reads as broad coverage. Against
Hermes v0.21.4, 8 of 12 SONAR entries and 12 of 16 BLITZ entries were names
Hermes never ships.

These tests resolve every allowlist entry against the real registry so that
kind of drift fails here instead of at runtime. They skip when Hermes is not
importable (the plugin is developed and published outside a Hermes checkout).
"""

import unittest

from maestria_hermes.permissions import (
    BLITZ_DIRECT_ALLOWED_TOOLS,
    SONAR_ALLOWED_TOOLS,
)


def _live_hermes_tool_names() -> frozenset[str] | None:
    """Return every tool name Hermes can expose, or None when unavailable.

    Uses the static ``toolsets.TOOLSETS`` table (expanded transitively through
    ``includes``) rather than ``tools.registry``: the registry is populated
    lazily as tool modules import, so it holds only a fraction of the real set
    in a fresh process. The table is the host's own declaration of what exists,
    and importing it costs ~10ms with no side effects.
    """
    try:
        import toolsets
    except Exception:
        return None

    def expand(key: str, seen: set[str]) -> set[str]:
        entry = getattr(toolsets, "TOOLSETS", {}).get(key)
        if not entry:
            return set()
        names: set[str] = set(entry.get("tools") or ())
        for included in entry.get("includes") or ():
            if included not in seen:
                seen.add(included)
                names |= expand(included, seen)
        return names

    names: set[str] = set()
    for key in getattr(toolsets, "TOOLSETS", {}):
        names |= expand(key, set())
    return frozenset(names) if names else None


class AllowlistExistsInHermesTests(unittest.TestCase):
    """Every reviewed allowlist name must be a tool Hermes actually ships."""

    def setUp(self):
        self.real_tools = _live_hermes_tool_names()
        if self.real_tools is None:
            self.skipTest("Hermes toolsets unavailable (outside a Hermes install)")

    def _assert_real(self, allowlist, label):
        unknown = sorted(name for name in allowlist if name not in self.real_tools)
        self.assertEqual(
            unknown, [],
            f"{label} names that Hermes does not ship (inert entries that make "
            f"the policy look broader than it is): {unknown}",
        )

    def test_sonar_allowlist_entries_are_real_hermes_tools(self):
        self._assert_real(SONAR_ALLOWED_TOOLS, "SONAR_ALLOWED_TOOLS")

    def test_blitz_direct_allowlist_entries_are_real_hermes_tools(self):
        self._assert_real(BLITZ_DIRECT_ALLOWED_TOOLS, "BLITZ_DIRECT_ALLOWED_TOOLS")

    def test_blitz_includes_sonar(self):
        """Blitz is a strict superset: narrowing a mode must stay coherent."""
        self.assertTrue(SONAR_ALLOWED_TOOLS <= BLITZ_DIRECT_ALLOWED_TOOLS)

    def test_no_allowlist_admits_a_known_mutating_tool(self):
        """Guard the safety direction of the lists themselves.

        The names below mutate the filesystem, run commands, or drive another
        agent. None may appear in any mode or child allowlist; if a future
        Hermes release renames one, this test names it.
        """
        mutating = {
            "write_file",
            "patch",
            "terminal",
            "process_manage",
            "execute_code",
            "delegate_task",
            "cronjob_manage",
            "computer_use",
            "skill_manage",
            "todo_list",
        }
        for label, allowlist in (
            ("SONAR_ALLOWED_TOOLS", SONAR_ALLOWED_TOOLS),
            ("BLITZ_DIRECT_ALLOWED_TOOLS", BLITZ_DIRECT_ALLOWED_TOOLS),
        ):
            leaked = sorted(allowlist & mutating)
            self.assertEqual(leaked, [], f"{label} admits mutating tools: {leaked}")


if __name__ == "__main__":
    unittest.main()

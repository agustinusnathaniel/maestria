"""Allowlist integrity against the live Hermes tool registry.

An allowlist entry Hermes does not ship is inert, so stale names narrow the
policy silently while the source still reads as broad coverage. Skips outside
a Hermes checkout, since the plugin is also built standalone.
"""

import unittest

from maestria_hermes.permissions import (
    BLITZ_DIRECT_ALLOWED_TOOLS,
    SONAR_ALLOWED_TOOLS,
)


def _live_hermes_tool_names() -> frozenset[str] | None:
    """Every tool name Hermes can expose, or None when unavailable.

    Reads the static ``TOOLSETS`` table, not ``tools.registry``: the registry
    fills in lazily as tool modules import, so a fresh process holds a
    fraction of the real set.
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
    def setUp(self):
        self.real_tools = _live_hermes_tool_names()
        if self.real_tools is None:
            self.skipTest("Hermes toolsets unavailable (outside a Hermes install)")

    def _assert_real(self, allowlist, label):
        unknown = sorted(name for name in allowlist if name not in self.real_tools)
        self.assertEqual(unknown, [], f"{label} names Hermes does not ship: {unknown}")

    def test_sonar_allowlist_entries_are_real_hermes_tools(self):
        self._assert_real(SONAR_ALLOWED_TOOLS, "SONAR_ALLOWED_TOOLS")

    def test_blitz_direct_allowlist_entries_are_real_hermes_tools(self):
        self._assert_real(BLITZ_DIRECT_ALLOWED_TOOLS, "BLITZ_DIRECT_ALLOWED_TOOLS")

    def test_blitz_includes_sonar(self):
        self.assertTrue(SONAR_ALLOWED_TOOLS <= BLITZ_DIRECT_ALLOWED_TOOLS)

    def test_no_allowlist_admits_a_known_mutating_tool(self):
        # The existence test cannot catch this direction: every name in
        # `mutating` is a real Hermes tool, so only an explicit assertion
        # keeps one out.
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

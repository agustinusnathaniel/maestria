"""Guard the canonical specialist roster against drift in Hermes registries."""

import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch

from maestria_hermes import register

SPECIALISTS_DIR = (
    pathlib.Path(__file__).resolve().parents[2]
    / "core"
    / "agent-directives"
    / "specialists"
)
KNOWN_NON_SPECIALIST_SKILLS = frozenset(
    {"global-rules", "command-fein", "command-sonar", "command-blitz"}
)


def canonical_roster():
    names = sorted(path.stem for path in SPECIALISTS_DIR.glob("*.md"))
    return names, [name for name in names if name != "orchestrator"]


class RecordingContext:
    """Minimal plugin context that records skill registrations."""

    def __init__(self):
        self.skills = []

    def register_hook(self, *_args, **_kwargs):
        pass

    def register_middleware(self, *_args, **_kwargs):
        pass

    def register_tool(self, *_args, **_kwargs):
        pass

    def register_command(self, *_args, **_kwargs):
        pass

    def register_skill(self, name, _path):
        self.skills.append(name)


class RosterGuardTests(unittest.TestCase):
    def test_skill_registrations_cover_the_canonical_roster(self):
        _, delegable = canonical_roster()
        ctx = RecordingContext()
        with tempfile.TemporaryDirectory() as home, patch.dict(
            os.environ, {"HERMES_HOME": home}
        ):
            register(ctx)
        self.assertEqual(
            set(ctx.skills),
            {"orchestrator", *delegable, *KNOWN_NON_SPECIALIST_SKILLS},
        )


if __name__ == "__main__":
    unittest.main()

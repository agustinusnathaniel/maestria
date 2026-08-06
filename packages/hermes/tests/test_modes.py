from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from maestria_hermes.modes import ModeManager


class ModeManagerTests(unittest.TestCase):
    def test_defaults_to_direct_execution(self):
        with tempfile.TemporaryDirectory() as home, patch.dict(
            os.environ, {"HERMES_HOME": home}, clear=False
        ):
            manager = ModeManager()

            self.assertIsNone(manager.get_mode())
            self.assertFalse(manager.is_read_only())

    def test_explicit_mode_selection_persists(self):
        with tempfile.TemporaryDirectory() as home, patch.dict(
            os.environ, {"HERMES_HOME": home}, clear=False
        ):
            manager = ModeManager("session-a")
            manager.set_mode("sonar")

            reloaded = ModeManager("session-a")
            self.assertEqual(reloaded.get_mode(), "sonar")
            state = json.loads((Path(home) / "maestria-mode.json").read_text())
            self.assertEqual(state["sessions"]["session-a"], "sonar")

    def test_explicit_mode_is_scoped_to_session_identity(self):
        with tempfile.TemporaryDirectory() as home, patch.dict(
            os.environ, {"HERMES_HOME": home}, clear=False
        ):
            first = ModeManager("session-a")
            first.set_mode("sonar")

            self.assertIsNone(ModeManager("session-b").get_mode())

    def test_blitz_guidance_is_direct_and_requires_independent_review_to_land(self):
        skill_path = (
            Path(__file__).resolve().parents[1]
            / "src"
            / "maestria_hermes"
            / "skills"
            / "commands"
            / "blitz"
            / "SKILL.md"
        )
        guidance = skill_path.read_text(encoding="utf-8")

        self.assertIn("zero-child", guidance)
        self.assertIn("independent reviewer before landing", guidance)
        self.assertNotRegex(guidance, r"via builder|builder directly|Task.*builder")

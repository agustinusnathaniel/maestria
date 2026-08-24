import json
import os
import tempfile
import unittest
from unittest.mock import patch

from maestria_hermes.hooks.pre_llm import create_pre_llm_hook
from maestria_hermes.modes import ModeManager


class ModeManagerTests(unittest.TestCase):
    def test_default_mode_is_fein(self):
        with tempfile.TemporaryDirectory() as home, patch.dict(os.environ, {"HERMES_HOME": home}):
            self.assertEqual(ModeManager().get_mode(), "fein")

    def test_set_persists_and_reload(self):
        with tempfile.TemporaryDirectory() as home, patch.dict(os.environ, {"HERMES_HOME": home}):
            manager = ModeManager()
            manager.set_mode("sonar")
            self.assertEqual(ModeManager().get_mode(), "sonar")
            self.assertEqual(json.loads((__import__("pathlib").Path(home) / "maestria-mode.json").read_text())["mode"], "sonar")

    def test_clear_persists_neutral_and_stops_prompt_injection(self):
        with tempfile.TemporaryDirectory() as home, patch.dict(os.environ, {"HERMES_HOME": home}):
            manager = ModeManager()
            manager.set_mode("sonar")
            manager.clear_mode()
            self.assertIsNone(manager.get_mode())
            self.assertIsNone(ModeManager().get_mode())
            self.assertEqual(json.loads((__import__("pathlib").Path(home) / "maestria-mode.json").read_text())["mode"], None)
            self.assertEqual(create_pre_llm_hook(manager)()["context"], "")


if __name__ == "__main__":
    unittest.main()

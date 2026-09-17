import json
import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch

from maestria_hermes.hooks.pre_llm import create_pre_llm_hook
from maestria_hermes.modes import (
    ModeManager,
    load_command_description,
    render_mode_status,
    render_mode_switch,
)


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


class SharedCommandTextTests(unittest.TestCase):
    """The shared render/description helpers keep their exact text."""

    def test_render_mode_status_preserves_exact_text(self):
        self.assertEqual(
            render_mode_status("sonar", True),
            "**Maestria Status**\n\nMode: **sonar**\nRead-only: Yes",
        )
        self.assertEqual(
            render_mode_status("neutral", False),
            "**Maestria Status**\n\nMode: **neutral**\nRead-only: No",
        )

    def test_render_mode_status_normalizes_none_to_neutral(self):
        self.assertEqual(
            render_mode_status(None, False),
            "**Maestria Status**\n\nMode: **neutral**\nRead-only: No",
        )

    def test_render_mode_switch_preserves_exact_text(self):
        init_pipeline = "adventurer / architect -> builder -> reviewer"
        self.assertEqual(
            render_mode_switch("fein", init_pipeline),
            f"Switched to **fein** mode.\nPipeline: {init_pipeline}",
        )
        frontmatter_pipeline = (
            "Full pipeline mode: reconnaissance, design, implementation, review"
        )
        self.assertEqual(
            render_mode_switch("fein", frontmatter_pipeline),
            f"Switched to **fein** mode.\nPipeline: {frontmatter_pipeline}",
        )

    def test_load_command_description_reads_frontmatter_then_falls_back(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "SKILL.md"
            path.write_text(
                '---\ndescription: "From frontmatter"\nname: sample\n---\n\nbody\n',
                encoding="utf-8",
            )
            self.assertEqual(load_command_description(path, "fallback"), "From frontmatter")
            missing = pathlib.Path(tmp) / "missing" / "SKILL.md"
            self.assertEqual(load_command_description(missing, "fallback"), "fallback")


if __name__ == "__main__":
    unittest.main()

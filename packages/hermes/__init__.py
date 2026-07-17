"""Bridging __init__.py for Hermes plugin loader (src/ layout).

Hermes plugin discovery calls importlib on the plugin directory root,
expecting __init__.py to be there. The actual package lives under
src/maestria_hermes/ — this shim adds the src directory to the Python
path and re-exports the register entry point.

See hermes_cli.plugins.PluginManager._load_directory_module.
"""
import sys
from pathlib import Path

_src = str(Path(__file__).resolve().parent / "src")
if _src not in sys.path:
    sys.path.insert(0, _src)

from maestria_hermes import register  # noqa: E402

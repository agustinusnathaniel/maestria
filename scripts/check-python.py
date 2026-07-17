#!/usr/bin/env python3
"""Project-level Python quality check for maestria monorepo.

Verifies all Python source files in packages/hermes/:
  1. Syntax validity (compileall)
  2. Module imports resolve correctly

Exits non-zero on any failure. Designed to run as a `vp run` task.
"""

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
HERMES_SRC = REPO_ROOT / "packages" / "hermes" / "src"
errors = []

# Phase 1: Syntax
print("::check-python phase=1/syntax")
r = subprocess.run(
    [sys.executable, "-m", "compileall", "-q", str(HERMES_SRC)],
    capture_output=True, text=True, timeout=30,
)
if r.returncode != 0:
    errors.append("Syntax errors")

# Phase 2: Import check
print("::check-python phase=2/imports")
import_code = (
    "import sys\n"
    f"sys.path.insert(0, {str(HERMES_SRC)!r})\n"
    "from maestria_hermes import register\n"
    "from maestria_hermes.permissions import init_roles, get_role, TOOL_CATEGORIES\n"
    "from maestria_hermes.modes import ModeManager\n"
    "from maestria_hermes.session import SessionManager, create_session_hooks\n"
    "from maestria_hermes.hooks.pre_llm import create_pre_llm_hook\n"
    "from maestria_hermes.hooks.pre_tool import create_pre_tool_hook\n"
    "from maestria_hermes.hooks.transform import create_transform_tool_result_hook\n"
    "from maestria_hermes.middleware.llm_output import create_llm_output_middleware\n"
    "from maestria_hermes.tools.opencode import opencode_route_tool_schema, opencode_route_handler\n"
    "init_roles()\n"
    'for rn in ["orchestrator","adventurer","architect","builder","diagnose","planner","reviewer","writer"]:\n'
    "    assert get_role(rn) is not None, rn\n"
    "print('OK: ' + str(len(TOOL_CATEGORIES)) + ' tool categories, 8 roles')\n"
)

r = subprocess.run(
    [sys.executable, "-c", import_code],
    capture_output=True, text=True, timeout=30,
)
if r.returncode != 0:
    errors.append("Import check failed")
    print(r.stderr[:2000] if r.stderr else r.stdout[:2000])
else:
    print(r.stdout.strip())

if errors:
    print("\nFAILED: " + "; ".join(errors))
    sys.exit(1)
else:
    print("\nPASS: Python check clean")
    sys.exit(0)

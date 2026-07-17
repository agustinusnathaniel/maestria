"""OpenCode CLI routing tool for Builder specialist.

Provides a tool that delegates complex coding tasks to OpenCode CLI.
Before delegating, it verifies @maestria/opencode is also available
so the OpenCode instance follows Maestria methodology.
"""

import json
import logging
import shutil
import subprocess
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

MAESTRIA_PLUGIN_PKG = "@maestria/opencode"


def _check_maestria_plugin() -> Optional[str]:
    """Check if @maestria/opencode is installed using the maestria CLI.

    Calls ``maestria check opencode --json --quiet`` which reads OpenCode's
    plugin config (``~/.config/opencode/opencode.jsonc``) to verify the plugin
    is registered. This is the single source of truth — the maestria CLI knows
    where each platform stores its plugin configuration.

    Returns an error message string if the plugin is missing, or None if found.
    """
    try:
        result = subprocess.run(
            ["maestria", "check", "opencode", "--json", "--quiet"],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            return None
        # Parse JSON to get the error message
        try:
            data = json.loads(result.stdout)
            msg = data.get("message", "")
        except (json.JSONDecodeError, KeyError):
            msg = ""
        return (
            msg
            or f"{MAESTRIA_PLUGIN_PKG} is not installed. "
            f"The delegated OpenCode session will NOT follow Maestria methodology. "
            f"Install it with: pnpx maestria@latest install opencode"
        )
    except FileNotFoundError:
        return (
            "maestria CLI is not on PATH. "
            f"Cannot verify {MAESTRIA_PLUGIN_PKG} status. "
            "Install it with: npm i -g maestria"
        )
    except subprocess.TimeoutExpired:
        return (
            f"Timeout checking {MAESTRIA_PLUGIN_PKG} status. "
            "Proceeding without verification."
        )


def opencode_route_tool_schema() -> Dict[str, Any]:
    """Return the JSON schema for the opencode_route tool."""
    return {
        "name": "opencode_route",
        "description": (
            "Delegate a complex coding task to OpenCode CLI. "
            "Requires @maestria/opencode plugin for methodology consistency. "
            "Use for multi-file changes, complex refactors, or tasks "
            "that benefit from OpenCode's dedicated coding sandbox. "
            "Simple single-file edits can use direct edit/write tools."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "goal": {
                    "type": "string",
                    "description": "The coding task to accomplish",
                },
                "workdir": {
                    "type": "string",
                    "description": "Working directory for the task (default: current)",
                },
                "context": {
                    "type": "string",
                    "description": "Additional context or constraints",
                },
                "skip_plugin_check": {
                    "type": "boolean",
                    "description": "Skip @maestria/opencode plugin check (default: false). "
                                   "Use only if you're sure the plugin is available.",
                },
            },
            "required": ["goal"],
        },
    }


def opencode_route_handler(args: Dict[str, Any], **kwargs) -> str:
    """Execute a coding task via OpenCode CLI.

    Before running, checks that:
    1. OpenCode CLI is on PATH
    2. @maestria/opencode plugin is installed (unless skip_plugin_check=True)

    Then runs a one-shot `opencode run` with the given goal.
    """
    goal = args.get("goal", "")
    workdir = args.get("workdir", ".")
    context = args.get("context", "")
    skip_plugin_check = args.get("skip_plugin_check", False)

    # Build the prompt
    prompt = goal
    if context:
        prompt = f"{context}\n\n{goal}"

    try:
        # Check OpenCode is available
        if not shutil.which("opencode"):
            return json.dumps({
                "status": "error",
                "message": (
                    "OpenCode CLI is not installed or not on PATH. "
                    "Install it with: npm i -g opencode-ai@latest"
                ),
            })

        # Check @maestria/opencode plugin
        if not skip_plugin_check:
            plugin_error = _check_maestria_plugin()
            if plugin_error:
                return json.dumps({
                    "status": "error",
                    "message": (
                        f"{plugin_error}\n\n"
                        "The delegated task was NOT started. "
                        "Install the plugin first, or set "
                        "skip_plugin_check=true if you're sure it's available."
                    ),
                })

        # Run opencode in one-shot mode
        logger.info("opencode_route: running in %s", workdir)
        proc = subprocess.run(
            ["opencode", "run", prompt],
            cwd=workdir,
            capture_output=True, text=True, timeout=300,  # 5 min timeout
        )

        output = proc.stdout or ""
        error = proc.stderr or ""

        return json.dumps({
            "status": "completed" if proc.returncode == 0 else "failed",
            "output": output[-2000:] if len(output) > 2000 else output,
            "error": error[-500:] if len(error) > 500 else error,
            "return_code": proc.returncode,
        })

    except subprocess.TimeoutExpired:
        return json.dumps({
            "status": "timeout",
            "message": "OpenCode task timed out after 5 minutes.",
        })
    except FileNotFoundError:
        return json.dumps({
            "status": "error",
            "message": "OpenCode CLI not found.",
        })
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Unexpected error: {e}",
        })
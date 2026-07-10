"""OpenCode CLI routing tool for Builder specialist.

Provides a tool that delegates complex coding tasks to OpenCode CLI
with @maestria/opencode loaded for structured methodology execution.
"""

import json
import logging
import shlex
import subprocess
from typing import Any, Dict

logger = logging.getLogger(__name__)


def opencode_route_tool_schema() -> Dict[str, Any]:
    """Return the JSON schema for the opencode_route tool."""
    return {
        "name": "opencode_route",
        "description": (
            "Delegate a complex coding task to OpenCode CLI. "
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
            },
            "required": ["goal"],
        },
    }


def opencode_route_handler(args: Dict[str, Any], **kwargs) -> str:
    """Execute a coding task via OpenCode CLI.

    Checks that OpenCode is available, then runs a one-shot
    `opencode run` with the given goal.
    """
    goal = args.get("goal", "")
    workdir = args.get("workdir", ".")
    context = args.get("context", "")

    # Build the prompt
    prompt = goal
    if context:
        prompt = f"{context}\n\n{goal}"

    try:
        # Check OpenCode is available
        result = subprocess.run(
            ["which", "opencode"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return json.dumps({
                "status": "error",
                "message": (
                    "OpenCode CLI is not installed or not on PATH. "
                    "Install it with: npm i -g opencode-ai@latest"
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

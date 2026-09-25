"""OpenCode CLI routing tool for Builder specialist."""

from __future__ import annotations

import json
import logging
import os
import signal
import subprocess
import threading
import time
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any, BinaryIO

logger = logging.getLogger(__name__)

MAX_STDOUT_CHARS = 2000
MAX_STDERR_CHARS = 500
SUBPROCESS_TIMEOUT_SECONDS = 300
TRUNCATION_MARKER = "...[truncated]"

SAFE_ENV_NAMES = frozenset(
    {
        "COMSPEC",
        "HOME",
        "LANG",
        "LC_ALL",
        "LC_CTYPE",
        "NO_COLOR",
        "OPENCODE_AUTO_SHARE",
        "OPENCODE_CLIENT",
        "OPENCODE_CONFIG",
        "OPENCODE_CONFIG_DIR",
        "OPENCODE_ENABLE_EXA",
        "OPENCODE_SERVER_USERNAME",
        "PATH",
        "PATHEXT",
        "SYSTEMROOT",
        "TERM",
        "TMP",
        "TEMP",
        "TMPDIR",
        "TZ",
        "USERPROFILE",
        "WINDIR",
        "XDG_CACHE_HOME",
        "XDG_CONFIG_HOME",
        "XDG_DATA_HOME",
    }
)
CREDENTIAL_ENV_NAMES = frozenset(
    {
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_AUTH_TOKEN",
        "DEEPSEEK_API_KEY",
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "GOOGLE_GENERATIVE_AI_API_KEY",
        "GROQ_API_KEY",
        "MISTRAL_API_KEY",
        "OPENAI_API_KEY",
        "OPENCODE_API_KEY",
        "OPENCODE_GO_API_KEY",
        "OPENROUTER_API_KEY",
        "XAI_API_KEY",
    }
)
APPROVED_ENV_NAMES = SAFE_ENV_NAMES | CREDENTIAL_ENV_NAMES

EnvironmentBuilder = Callable[..., Mapping[str, str]]
Redactor = Callable[..., str]


def opencode_route_tool_schema() -> dict[str, Any]:
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


def _load_hermes_support() -> tuple[EnvironmentBuilder, Redactor] | None:
    """Load Hermes' canonical environment and forced-redaction helpers."""
    try:
        from agent.redact import redact_sensitive_text
        from tools.environments.local import hermes_subprocess_env
    except Exception:
        return None
    if not callable(hermes_subprocess_env) or not callable(redact_sensitive_text):
        return None
    return hermes_subprocess_env, redact_sensitive_text


def _result(status: str, **fields: object) -> str:
    return json.dumps({"status": status, **fields})


def _usable_workdir(value: object) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        candidate = Path(value).expanduser().resolve(strict=True)
        if not candidate.is_dir() or not os.access(candidate, os.R_OK | os.X_OK):
            return None
    except (OSError, RuntimeError, ValueError):
        return None
    return str(candidate)


def _explicit_environment(source: Mapping[str, object]) -> dict[str, str]:
    casefolded = {str(key).casefold(): str(value) for key, value in source.items()}
    environment: dict[str, str] = {}
    for name in APPROVED_ENV_NAMES:
        value = casefolded.get(name.casefold())
        if value:
            environment[name] = value
    return environment


def _sanitize_text(
    value: str,
    redactor: Redactor,
    secret_values: set[str],
    limit: int,
) -> str:
    sanitized = redactor(value, force=True)
    if not isinstance(sanitized, str):
        raise RuntimeError("redactor returned an invalid value")
    for secret in sorted(secret_values, key=len, reverse=True):
        if secret:
            sanitized = sanitized.replace(secret, "[REDACTED]")
    if len(sanitized) > limit:
        marker = TRUNCATION_MARKER[:limit]
        return sanitized[: limit - len(marker)] + marker
    return sanitized


def _capture_bounded(
    stream: BinaryIO,
    key: str,
    char_limit: int,
    overflow: threading.Event,
    failed: threading.Event,
    captured: dict[str, bytes],
) -> None:
    byte_limit = (char_limit + 1) * 4
    chunks: list[bytes] = []
    size = 0
    try:
        while size <= byte_limit:
            chunk = stream.read(8192)
            if not chunk:
                break
            chunks.append(chunk)
            size += len(chunk)
    except BaseException:
        failed.set()
    captured[key] = b"".join(chunks)[:byte_limit]
    if size > byte_limit:
        overflow.set()


class ProcessCleanupError(RuntimeError):
    """The owned process group could not be verified gone."""


class ProcessCleanupUnavailable(RuntimeError):
    """The platform cannot provide owned process cleanup."""


def _requires_job_object() -> bool:
    return os.name == "nt"


def _cleanup_process_group(process: subprocess.Popen[bytes]) -> bool:
    """Terminate the owned process group (TERM, then KILL) and verify exit."""
    process_group_id = process.pid

    def _signal(process_signal: signal.Signals) -> bool:
        try:
            os.killpg(process_group_id, process_signal)
        except ProcessLookupError:
            return True
        except OSError:
            return False
        return True

    def _gone(timeout: float) -> bool:
        deadline = time.monotonic() + timeout
        while True:
            try:
                os.killpg(process_group_id, 0)
            except ProcessLookupError:
                return True
            except OSError:
                pass
            if time.monotonic() >= deadline:
                return False
            time.sleep(0.01)

    term_sent = _signal(signal.SIGTERM)
    try:
        process.wait(timeout=0.05)
    except subprocess.TimeoutExpired:
        pass
    if term_sent and _gone(0.25):
        return True

    kill_sent = _signal(signal.SIGKILL)
    try:
        process.wait(timeout=0.5)
    except subprocess.TimeoutExpired:
        try:
            process.kill()
            process.wait(timeout=0.5)
        except (OSError, subprocess.TimeoutExpired):
            return False
    return kill_sent and _gone(1.0)


def _close_process_streams(process: subprocess.Popen[bytes]) -> None:
    for stream in (process.stdout, process.stderr):
        if stream is None:
            continue
        try:
            stream.close()
        except OSError:
            pass


def _run_opencode(
    argv: list[str],
    *,
    cwd: str,
    env: dict[str, str],
    timeout: int,
    stdout_limit: int,
    stderr_limit: int,
) -> subprocess.CompletedProcess[str]:
    """Run OpenCode, own its process group, and verify cleanup before return."""
    if _requires_job_object():
        raise ProcessCleanupUnavailable

    process = subprocess.Popen(
        argv,
        cwd=cwd,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    overflow = threading.Event()
    failed = threading.Event()
    captured: dict[str, bytes] = {}
    stdout_thread = threading.Thread(
        target=_capture_bounded,
        args=(process.stdout, "stdout", stdout_limit, overflow, failed, captured),
        daemon=True,
    )
    stderr_thread = threading.Thread(
        target=_capture_bounded,
        args=(process.stderr, "stderr", stderr_limit, overflow, failed, captured),
        daemon=True,
    )
    timed_out = False
    cleanup_verified = False
    stdout_started = False
    stderr_started = False
    try:
        stdout_thread.start()
        stdout_started = True
        stderr_thread.start()
        stderr_started = True
        deadline = time.monotonic() + timeout
        while process.poll() is None:
            if overflow.is_set() or failed.is_set():
                break
            if time.monotonic() >= deadline:
                timed_out = True
                break
            overflow.wait(timeout=0.02)
    finally:
        cleanup_verified = _cleanup_process_group(process)
        if stdout_started:
            stdout_thread.join(timeout=0.5)
        if stderr_started:
            stderr_thread.join(timeout=0.5)
        _close_process_streams(process)
        if not cleanup_verified:
            raise ProcessCleanupError

    if timed_out:
        raise subprocess.TimeoutExpired(argv, timeout)
    if failed.is_set():
        raise RuntimeError("bounded output capture failed")

    return subprocess.CompletedProcess(
        argv,
        process.returncode if process.returncode is not None else process.wait(timeout=0.5),
        captured.get("stdout", b"").decode("utf-8", errors="replace"),
        captured.get("stderr", b"").decode("utf-8", errors="replace"),
    )


def opencode_route_handler(args: dict[str, Any], **_kwargs: object) -> str:
    """Execute a coding task through the credential-safe OpenCode boundary."""
    if not isinstance(args, dict):
        return _result("invalid_arguments", message="OpenCode route arguments are invalid.")
    goal = args.get("goal")
    context = args.get("context", "")
    if not isinstance(goal, str) or not goal.strip() or not isinstance(context, str):
        return _result("invalid_arguments", message="OpenCode route arguments are invalid.")

    workdir = _usable_workdir(args.get("workdir", "."))
    if workdir is None:
        return _result(
            "invalid_workdir",
            message="OpenCode workdir is unavailable.",
        )

    support = _load_hermes_support()
    if support is None:
        return _result(
            "sanitizer_unavailable",
            message="Hermes credential-safe subprocess support is unavailable.",
        )
    environment_builder, redactor = support
    try:
        source_environment = environment_builder(inherit_credentials=True)
        if not isinstance(source_environment, Mapping):
            return _result(
                "sanitizer_unavailable",
                message="Hermes credential-safe subprocess support is unavailable.",
            )
        environment = _explicit_environment(source_environment)
        sanitizer_probe = redactor("Hermes subprocess sanitizer preflight", force=True)
        if not isinstance(sanitizer_probe, str):
            raise RuntimeError("redactor returned an invalid value")
    except Exception:
        return _result(
            "sanitizer_unavailable",
            message="Hermes credential-safe subprocess support is unavailable.",
        )

    prompt = f"{context}\n\n{goal}" if context else goal
    argv = ["opencode", "run", prompt]
    secret_values = {
        value
        for name, value in environment.items()
        if name in CREDENTIAL_ENV_NAMES
    }
    secret_values.update(value for value in (prompt, goal, context) if value)

    try:
        process = _run_opencode(
            argv,
            cwd=workdir,
            env=environment,
            timeout=SUBPROCESS_TIMEOUT_SECONDS,
            stdout_limit=MAX_STDOUT_CHARS,
            stderr_limit=MAX_STDERR_CHARS,
        )
    except ProcessCleanupUnavailable:
        return _result(
            "cleanup_unavailable",
            message="Owned process cleanup is unavailable on this platform.",
        )
    except ProcessCleanupError:
        return _result(
            "cleanup_failed",
            message="OpenCode process cleanup could not be verified.",
        )
    except FileNotFoundError:
        return _result(
            "unavailable_executable",
            message="OpenCode CLI is unavailable.",
        )
    except subprocess.TimeoutExpired:
        return _result(
            "timeout",
            message="OpenCode task timed out after 5 minutes.",
        )
    except Exception:
        return _result(
            "internal_error",
            message="OpenCode routing failed safely.",
        )

    if process.returncode != 0:
        return _result(
            "failed",
            output="",
            error="OpenCode CLI exited with a non-zero status.",
            return_code=process.returncode,
        )
    try:
        output = _sanitize_text(
            process.stdout,
            redactor,
            secret_values,
            MAX_STDOUT_CHARS,
        )
        error = _sanitize_text(
            process.stderr,
            redactor,
            secret_values,
            MAX_STDERR_CHARS,
        )
    except Exception:
        return _result(
            "internal_error",
            message="OpenCode routing failed safely.",
        )
    return _result(
        "completed",
        output=output,
        error=error,
        return_code=process.returncode,
    )

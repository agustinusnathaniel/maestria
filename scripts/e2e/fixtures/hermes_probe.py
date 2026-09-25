"""Phase B evidence probe for the Hermes plugin (stdlib only).

Usage: hermes_probe.py <section>
Reads HERMES_HOME and PYTHONPATH from the environment (set by the node
evidence runner). Prints exactly one JSON object to stdout:
{"checks": [{"name": str, "pass": bool, "detail": str}]}.
Exits 0 unless the probe itself crashes (a crash is a failed section).
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys


def check(name, passed, detail=""):
    return {"detail": str(detail), "name": name, "pass": bool(passed)}


def emit(checks):
    sys.stdout.write(json.dumps({"checks": checks}, sort_keys=True) + "\n")


def section_failclosed():
    from maestria_hermes import session as S
    from maestria_hermes.hooks.pre_llm import create_pre_llm_hook
    from maestria_hermes.hooks.pre_tool import create_pre_tool_hook
    from maestria_hermes.modes import ModeManager

    out = []
    manager = ModeManager()
    hook = create_pre_tool_hook(manager)

    # Failure modes first: invalid mode, unknown session, malformed names.
    try:
        manager.set_mode("nope")
        out.append(check("invalid-mode-rejected", False, "no error raised"))
    except ValueError:
        out.append(check("invalid-mode-rejected", manager.get_mode() == "fein", manager.get_mode()))
    out.append(
        check(
            "unknown-session-denied",
            (hook(tool_name="read", session_id="no-such-session", task_id="zzz") or {}).get("action")
            == "block",
        )
    )
    try:
        blocked = hook(tool_name=None, session_id="s")
        out.append(check("malformed-name-blocked-without-raise", (blocked or {}).get("action") == "block"))
    except Exception as exc:  # noqa: BLE001 - the contract is never-raises
        out.append(check("malformed-name-blocked-without-raise", False, type(exc).__name__))

    # Sonar top-level: reads pass, writes block.
    manager.set_mode("sonar")
    S.mark_top_level("sonar-top")
    out.append(check("sonar-read-allowed", hook(tool_name="read", session_id="sonar-top") is None))
    out.append(
        check(
            "sonar-write-blocked",
            (hook(tool_name="write", session_id="sonar-top") or {}).get("action") == "block",
        )
    )

    # Blitz top-level: reasoning passes, shell blocks.
    manager.set_mode("blitz")
    S.mark_top_level("blitz-top")
    out.append(check("blitz-reasoning-allowed", hook(tool_name="complete", session_id="blitz-top") is None))
    out.append(
        check(
            "blitz-shell-blocked",
            (hook(tool_name="bash", session_id="blitz-top") or {}).get("action") == "block",
        )
    )

    # Delegated child: reads pass, writes/shell block in every mode.
    S.mark_trusted_child("child-1", "leaf")
    out.append(check("child-read-allowed", hook(tool_name="read", session_id="child-1") is None))
    out.append(
        check(
            "child-write-blocked",
            (hook(tool_name="write", session_id="child-1") or {}).get("action") == "block",
        )
    )

    # Neutral routing injects no mode context.
    manager.clear_mode()
    out.append(
        check("neutral-injects-no-context", create_pre_llm_hook(manager)()["context"] == "")
    )
    emit(out)


def section_gateway():
    from maestria_hermes import _cmd_clear_mode, _cmd_set_mode, _cmd_status
    from maestria_hermes.hooks.pre_gateway import create_pre_gateway_hook
    from maestria_hermes.modes import MODE_PIPELINES, ModeManager

    out = []
    manager = ModeManager()
    hook = create_pre_gateway_hook(manager)

    sent = []

    class FakeAdapter:
        async def send(self, chat_id, text, metadata=None):
            sent.append(text)

    class FakeGateway:
        def __init__(self):
            self.adapters = {"test": FakeAdapter()}

    class Source:
        platform = "test"
        chat_id = "chat-1"
        thread_id = "thread-1"

    class Event:
        def __init__(self, cmd):
            self._cmd = cmd
            self.source = Source()

        def get_command(self):
            return self._cmd

    async def run():
        gateway = FakeGateway()
        # Failure mode first: unknown commands pass through untouched.
        result = hook(Event("dance"), gateway)
        out.append(check("unknown-command-passes-through", result is None))
        for cmd in ("fein", "sonar", "blitz", "review", "plan", "mode", "mode-clear"):
            result = hook(Event(cmd), gateway)
            out.append(
                check(
                    f"gateway-handles-{cmd}",
                    result == {"action": "skip", "reason": f"handled by maestria /{cmd}"},
                    result,
                )
            )
        for _ in range(5):
            await asyncio.sleep(0.01)

    asyncio.run(run())

    # Single pipeline-text table: gateway responses must equal the direct
    # command-handler responses for every mode switch.
    expected = {
        "fein": _cmd_set_mode(manager, "fein")(""),
        "sonar": _cmd_set_mode(manager, "sonar")(""),
        "blitz": _cmd_set_mode(manager, "blitz")(""),
    }
    manager.set_mode("fein")
    expected_mode = _cmd_status(manager)("")
    expected_clear = _cmd_clear_mode(manager)("")
    by_command = {}
    texts = list(sent)
    for cmd, text in zip(("fein", "sonar", "blitz", "review", "plan", "mode", "mode-clear"), texts):
        by_command[cmd] = text
    for cmd in ("fein", "sonar", "blitz"):
        out.append(
            check(
                f"pipeline-text-parity-{cmd}",
                by_command.get(cmd) == expected[cmd] and MODE_PIPELINES[cmd] in (by_command.get(cmd) or ""),
                by_command.get(cmd),
            )
        )
    out.append(
        check(
            "pipeline-text-parity-review-plan",
            by_command.get("review") == expected["fein"] and by_command.get("plan") == expected["fein"],
        )
    )
    out.append(check("status-text-parity-mode", by_command.get("mode") == expected_mode, by_command.get("mode")))
    out.append(
        check("status-text-parity-mode-clear", by_command.get("mode-clear") == expected_clear)
    )
    emit(out)


def section_project():
    from maestria_hermes import project_config

    out = []
    context = project_config.build_project_context()
    workflow_marker = "Project customization from .maestria/workflow.md"
    rules_marker = "Project customization from .maestria/rules.md"
    # Failure posture first is covered by the broken project run; here the
    # composition order is the contract: workflow first, then rules.
    out.append(check("workflow-section-present", workflow_marker in context))
    out.append(check("rules-section-present", rules_marker in context))
    out.append(
        check(
            "workflow-before-rules",
            context.find(workflow_marker) != -1
            and context.find(workflow_marker) < context.find(rules_marker),
        )
    )
    out.append(check("subordinate-status-visible", "never waives safety" in context))
    emit(out)


def section_project_broken():
    from maestria_hermes import project_config

    out = []
    context = project_config.build_project_context()
    out.append(
        check(
            "broken-file-surfaces-banner",
            "[MAESTRIA PROJECT CONFIG ERROR]" in context and ".maestria/workflow.md" in context,
            context[:200],
        )
    )
    out.append(check("banner-advises-waiting", "wait for the file" in context))
    emit(out)


def section_trust():
    from maestria_hermes import session as S
    from maestria_hermes.hooks.pre_tool import create_pre_tool_hook
    from maestria_hermes.modes import ModeManager

    out = []
    cap = S._TRUST_REGISTRY_CAP
    manager = ModeManager()
    manager.set_mode("fein")
    hook = create_pre_tool_hook(manager)

    # Failure modes first: unscoped and malformed terminal events revoke
    # without raising, and ended sessions deny even with task binding.
    try:
        S.revoke_all_trust()
        S.end_trust(None)
        S.clear_trust(7)
        S.mark_top_level("")
        out.append(check("terminal-events-never-raise", True))
    except Exception as exc:  # noqa: BLE001 - the contract is never-raises
        out.append(check("terminal-events-never-raise", False, type(exc).__name__))

    S.mark_top_level("bound-session")
    S.end_trust("bound-session")
    out.append(
        check(
            "ended-denies-despite-task-binding",
            (
                hook(tool_name="read", session_id="bound-session", task_id="bound-session") or {}
            ).get("action")
            == "block",
        )
    )

    # Fill the registry with active trust: the next admission fails closed.
    for i in range(cap):
        S.mark_top_level(f"fill-{i}")
    admitted = S.mark_trusted_child("overflow-child", "leaf")
    out.append(check("admission-at-cap-fails-closed", admitted is False))
    out.append(check("refused-id-stays-unknown", S.get_trust_state("overflow-child") == S.UNKNOWN))
    out.append(
        check(
            "refused-id-denied",
            (hook(tool_name="read", session_id="overflow-child") or {}).get("action") == "block",
        )
    )

    # End everything so slots free oldest-first; the evicted id denies.
    for i in range(cap):
        S.end_trust(f"fill-{i}")
    out.append(check("registry-bounded", len(S._session_trust) <= cap, len(S._session_trust)))
    S.mark_trusted_child("fresh-child", "leaf")
    out.append(
        check(
            "oldest-tombstone-evicted-to-unknown",
            S.get_trust_state("fill-0") == S.UNKNOWN,
            S.get_trust_state("fill-0"),
        )
    )
    out.append(
        check(
            "evicted-id-denied",
            (hook(tool_name="read", session_id="fill-0") or {}).get("action") == "block",
        )
    )
    out.append(
        check(
            "fresh-child-trusted",
            S.get_trust_state("fresh-child") == S.TRUSTED_CHILD
            and hook(tool_name="read", session_id="fresh-child") is None,
        )
    )

    # Unscoped terminal event revokes the fresh child too.
    S.revoke_all_trust()
    out.append(
        check(
            "revoke-all-denies",
            (hook(tool_name="read", session_id="fresh-child") or {}).get("action") == "block",
        )
    )
    emit(out)


def section_subprocess():
    from maestria_hermes.tools.opencode import _requires_job_object, _run_opencode

    out = []
    tmp = os.environ.get("PHASE_B_TMP", os.path.expanduser("~"))
    if os.name == "nt":
        try:
            _run_opencode(["echo", "hi"], cwd=tmp, env={}, timeout=5, stdout_limit=64, stderr_limit=64)
            out.append(check("windows-fail-closed", False, "no error raised"))
        except Exception as exc:  # noqa: BLE001 - any refusal proves fail-closed
            out.append(check("windows-fail-closed", True, type(exc).__name__))
        emit(out)
        return

    out.append(check("posix-cleanup-available", _requires_job_object() is False))
    env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin")}
    completed = _run_opencode(
        ["echo", "hello phase-b"], cwd=tmp, env=env, timeout=20, stdout_limit=1024, stderr_limit=1024
    )
    out.append(
        check(
            "dry-run-succeeds",
            completed.returncode == 0 and completed.stdout.strip() == "hello phase-b",
            repr(completed.stdout.strip()),
        )
    )
    try:
        _run_opencode(["sleep", "30"], cwd=tmp, env=env, timeout=1, stdout_limit=64, stderr_limit=64)
        out.append(check("timeout-mapped", False, "no error raised"))
    except subprocess.TimeoutExpired:
        out.append(check("timeout-mapped", True))
    truncated = _run_opencode(
        ["python3", "-c", "print('x' * 5000)"],
        cwd=tmp,
        env=env,
        timeout=20,
        stdout_limit=100,
        stderr_limit=64,
    )
    # The capture bound is (char_limit + 1) * 4 bytes of UTF-8 headroom, so
    # a 5001-byte output must shrink to at most 404 bytes.
    size = len(truncated.stdout.encode("utf-8"))
    out.append(check("output-truncated", size <= 404, size))
    emit(out)


SECTIONS = {
    "failclosed": section_failclosed,
    "gateway": section_gateway,
    "project": section_project,
    "project-broken": section_project_broken,
    "trust": section_trust,
    "subprocess": section_subprocess,
}


def main(argv):
    if len(argv) != 2 or argv[1] not in SECTIONS:
        sys.stderr.write(f"usage: hermes_probe.py <{'|'.join(sorted(SECTIONS))}>\n")
        return 2
    SECTIONS[argv[1]]()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

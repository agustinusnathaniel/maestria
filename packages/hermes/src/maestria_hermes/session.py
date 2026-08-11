"""Session trust-state registry for the maestria Hermes plugin.

Replaces the legacy session_id -> Maestria specialist-role mapping with an
explicit trust-state machine.  A session's trust is established and torn
down ONLY by trusted native lifecycle events:

- ``on_session_start``  - fires once when a brand-new session is created
  (first turn only, NOT on continuation).  A recognized non-child platform
  marks the session TOP_LEVEL.  It must never overwrite an active child
  state.
- ``on_session_end``    - fires at the end of EVERY conversation turn
  (resumable, not terminal).  Trust is preserved so a resumed turn keeps
  working.
- ``on_session_finalize`` / old-session reset - terminal session boundary
  (``/new``/``/reset`` or session expiry).  Clears trust.
- ``subagent_start``    - a delegated child with a valid native topology
  role (``leaf``/``orchestrator``) becomes TRUSTED_CHILD; a malformed or
  unknown child lifecycle becomes INVALID_CHILD.  Both outrank any
  top-level marker for the same id.
- ``subagent_stop``     - terminal child boundary.  Clears child trust.

Terminal events are EVENT-SCOPED when the payload carries a usable native
session id: only that session's trust is ended.  ``on_session_reset`` is
scoped to the explicit ``old_session_id`` on the gateway path; on the CLI
path the payload carries only the NEW session id after rotation, so the
reset is scoped to the manager's authoritative old-session identity for
that agent instance (see SessionManager.on_session_reset).  A terminal
event that cannot be scoped to a specific session (the explicit id is
missing, malformed, or otherwise unusable) revokes EVERY session's active
trust instead of leaving anything trusted: the conservative direction is
always a deny.  All revoked sessions are marked ENDED and must be
re-established by a fresh trusted lifecycle event.

The trust registry is BOUNDED by a HARD cap: its size never exceeds
_TRUST_REGISTRY_CAP.  A new trust entry is admitted by evicting the
oldest ended/invalid tombstone entries first (FIFO) to make room; when
the registry is at capacity with only active trust left, the new
admission fails closed (the id stays UNKNOWN, which denies all tools)
rather than evicting active sessions.  Active/trusted entries are never
pruned, and the most recently ended ids keep their ENDED reuse
protection (an evicted id becomes UNKNOWN, which still denies all
tools).  A repeated end/invalid terminal transition on an existing
tombstone REFRESHES its FIFO position, re-arming its reuse protection,
so re-ending an id never leaves it as the next eviction victim.

Trust states:

- TOP_LEVEL      - positively identified direct/top-level session (native
  lifecycle binding or validated task_id == session_id).  Direct policy.
- TRUSTED_CHILD  - delegated child with a valid native topology role.
  Fixed role-neutral read/research/LLM-only policy.
- INVALID_CHILD  - child lifecycle present but unknown/malformed.  Denies
  all tools (fails closed).
- ENDED          - terminal cleanup ran for this id.  Denies all tools
  until a fresh trusted lifecycle event re-establishes trust.
- UNKNOWN        - no lifecycle evidence (no registry entry).  Denies all
  tools.

Native child roles are TOPOLOGY signals only (which node in the delegation
tree a child is); they are never mapped to Maestria specialist identities
and never grant specialist capability.
"""

from __future__ import annotations

import collections
import logging
import unicodedata
from typing import Dict, Optional

from maestria_hermes.permissions import NATIVE_CHILD_ROLES

logger = logging.getLogger(__name__)

# -- Trust states -----------------------------------------------------------

TOP_LEVEL = "top_level"
TRUSTED_CHILD = "trusted_child"
INVALID_CHILD = "invalid_child"
ENDED = "ended"
UNKNOWN = "unknown"

# -- Registry ---------------------------------------------------------------

# HARD upper bound on the number of session trust entries retained: the
# registry never grows past it.  A new admission first prunes the oldest
# ended/invalid tombstone entries deterministically (FIFO, in the order
# they became tombstones) to make room; if nothing is evictable the
# admission fails closed rather than evict active trust or grow the
# registry.  A bounded registry keeps memory flat for long-lived
# processes (a gateway that sees thousands of sessions come and go)
# while preserving reuse protection for the most recently ended ids.
_TRUST_REGISTRY_CAP = 1024

# States that may be pruned when the registry exceeds the cap.  TOP_LEVEL
# and TRUSTED_CHILD are ACTIVE trust and are never pruned.  ENDED and
# INVALID_CHILD are deny-tombstones: evicting one makes the id UNKNOWN on
# the next read, which still denies all tools, so pruning never grants
# trust - it only trades reuse protection for memory, oldest tombstones
# first.
_EVICTABLE_STATES = frozenset((ENDED, INVALID_CHILD))

# session_id -> trust state.  Only sessions with known state are keyed;
# every other id is UNKNOWN by construction.
_session_trust: Dict[str, str] = {}

# session_id -> native topology role ("leaf" / "orchestrator") for
# TRUSTED_CHILD sessions.  Stored for observability only; it never changes
# the child's tool policy (role-neutral).  Only ACTIVE trusted children are
# keyed - terminal cleanup pops the role, so this stays bounded by the
# active child count.
_child_topology: Dict[str, str] = {}

# FIFO of tombstone keys (ENDED / INVALID_CHILD) in the order they became
# tombstones, oldest first.  Drives deterministic eviction when the
# registry exceeds _TRUST_REGISTRY_CAP: the oldest ended/invalid entries
# are pruned first, so the most recently ended ids keep their ENDED reuse
# protection while memory stays bounded.  A repeated end/invalid terminal
# transition on an existing tombstone REFRESHES its position (moves it to
# the back), so a re-ended id re-arms its reuse protection instead of
# staying at a stale oldest position and becoming the next eviction
# victim.  A key that becomes active again is removed from the queue.
_tombstones: "collections.deque[str]" = collections.deque()

# Native platforms that positively identify a trusted top-level lifecycle
# context.  This is an EXPLICIT allowlist, verified from Hermes call sites
# and config - NOT a denylist: a platform value grants top-level trust only
# when it matches one of these exact strings.  Every other value - the
# delegate-child marker ("subagent"), the missing-value sentinels
# ("" / "unknown"), case variants, whitespace-padded strings, plugin-only
# names, and arbitrary attacker-controlled strings - fails closed and never
# grants direct trust.
#
# Verified sources (Hermes install tree, ~/.hermes/hermes-agent):
#   - "cli":   cli.py, hermes_cli/oneshot.py (quiet mode), cli_commands_mixin,
#              cli_agent_setup_mixin (kanban workers run as CLI sessions)
#   - "tui"/"desktop": tui_gateway/server.py _resolve_session_platform
#   - "gateway": gateway/run.py + gateway/slash_commands.py fallback tag when
#              a source platform is absent
#   - "cron":  cron/scheduler.py
#   - Messaging platforms: gateway/config.py ``Platform`` enum values, passed
#              as ``platform=source.platform.value`` from gateway/run.py
#   - Bundled gateway platform plugins: plugins/platforms/ in the Hermes
#              install tree, resolved through gateway.config.Platform._missing_
#              and the platform registry (gateway/platform_registry.py)
RECOGNIZED_TOP_LEVEL_PLATFORMS = frozenset(
    {
        # CLI / one-shot / quiet-mode / kanban-worker sessions
        "cli",
        # TUI and desktop-app sessions
        "tui",
        "desktop",
        # Gateway fallback tag when no source platform is present
        "gateway",
        # Cron-scheduled sessions
        "cron",
        # gateway/config.py Platform enum values
        "local",
        "telegram",
        "discord",
        "whatsapp",
        "whatsapp_cloud",
        "slack",
        "signal",
        "mattermost",
        "matrix",
        "homeassistant",
        "email",
        "sms",
        "dingtalk",
        "api_server",
        "webhook",
        "msgraph_webhook",
        "feishu",
        "wecom",
        "wecom_callback",
        "weixin",
        "bluebubbles",
        "qqbot",
        "yuanbao",
        "relay",
        # Bundled gateway platform plugins (plugins/platforms/)
        "google_chat",
        "irc",
        "line",
        "ntfy",
        "photon",
        "raft",
        "simplex",
        "teams",
    }
)

# The literal missing-value sentinel used by lifecycle kwargs defaults.
_UNKNOWN_SENTINEL = "unknown"

# Unicode categories that must never appear in a native identifier or tool
# name:
#
# - Cc (Other, control) - includes the C1 range U+0080-U+009F and NEL
#   (U+0085) that an ASCII-only ``ord < 32`` check misses.
# - Cf (Other, format)  - includes zero-width space U+200B, zero-width
#   non-joiner U+200C, zero-width joiner U+200D, and bidi/format marks
#   (U+200E ...).  These render invisibly and can smuggle or splice an
#   identifier or tool name.
# - Zl / Zp (line/paragraph separators) - U+2028 / U+2029.  Not stripped by
#   ``str.strip()`` when embedded, and they can break log-line integrity.
#
# ``Zs`` (spaces, incl. U+00A0) is deliberately NOT included here: a
# dedicated check rejects ANY Unicode whitespace (Zs and the ASCII
# whitespace that already falls in Cc) anywhere in a native identifier -
# leading, trailing, OR internal - so a value such as "session id" is
# rejected: a native id is a single compact token.
_UNSAFE_ID_CATEGORIES = frozenset(("Cc", "Cf", "Zl", "Zp"))


def contains_unicode_control(value: str) -> bool:
    """Return True when *value* contains a Unicode control or format char.

    Rejects the ``Cc`` (control - incl. the C1 range U+0080-U+009F),
    ``Cf`` (format - incl. zero-width space U+200B and other zero-width /
    bidi marks), and ``Zl``/``Zp`` (line/paragraph separator) categories.
    Such characters must never key the trust registry or pass an allowlist
    lookup: they render invisibly or splice values and can obfuscate a
    native identifier or tool name.
    """
    return any(unicodedata.category(ch) in _UNSAFE_ID_CATEGORIES for ch in value)


def _safe_repr(value: object) -> str:
    """Render a payload value for a diagnostic log without raising.

    Uses repr() for strings (the realistic payload shape from Hermes call
    sites) and the type name for everything else, so a malformed lifecycle
    payload can never break logging via a hostile object's __repr__.
    """
    if isinstance(value, str):
        return repr(value)
    return f"<{type(value).__name__}>"


def _session_key(session_id: object) -> str:
    """Normalize native session identifiers for the trust registry.

    Returns "" for values that cannot be trusted as a session identifier:
    non-strings, empty strings, strings with ANY whitespace (leading,
    trailing, or internal - ASCII and Unicode ``Zs`` alike), strings with
    Unicode control or format characters (``Cc``/``Cf``/``Zl``/``Zp`` -
    incl. the C1 range U+0080-U+009F and zero-width characters), and the
    literal "unknown" missing-value sentinel.  Callers treat "" as "no
    usable identifier" and fail closed.

    The native session ids passed by every Hermes call site (CLI, gateway,
    and subagent lifecycles) are compact identifiers such as
    "20260810_143025_a1b2c3" - non-empty ASCII strings with no whitespace
    of any kind and no control/format characters.  Anything else is
    malformed input and must never key the registry or grant trust.
    """
    if not isinstance(session_id, str):
        return ""
    if not session_id:
        return ""
    if contains_unicode_control(session_id):
        return ""
    if any(ch.isspace() for ch in session_id):
        return ""
    if session_id == _UNKNOWN_SENTINEL:
        return ""
    return session_id


def is_valid_lifecycle_id(value: object) -> bool:
    """Return True when *value* is a usable native session identifier.

    A usable identifier is a non-empty string with no whitespace anywhere
    (leading, trailing, or internal), no Unicode control/format/separator
    characters, and not the literal "unknown" sentinel.  Anything else
    must never be used to grant trust.
    """
    return bool(_session_key(value))


def is_recognized_top_level_platform(platform: object) -> bool:
    """Return True only for an EXACT recognized native top-level platform.

    Exact-match membership in RECOGNIZED_TOP_LEVEL_PLATFORMS.  Non-string
    values, the delegate-child marker ("subagent"), missing/unknown values
    ("" / "unknown"), case variants, whitespace-padded strings, and unknown
    plugin-only or arbitrary values all fail closed: they are never a
    recognized native top-level signal.
    """
    return isinstance(platform, str) and platform in RECOGNIZED_TOP_LEVEL_PLATFORMS


# -- Registry bookkeeping ---------------------------------------------------

def _set_trust_state(key: str, state: str) -> bool:
    """Set the trust state for a validated *key* and keep registry bounds.

    Maintains the FIFO tombstone queue: *key* is moved to the back when it
    transitions INTO an evictable state (ENDED / INVALID_CHILD) - including
    when it was already a tombstone, so a repeated end/invalid terminal
    transition refreshes its reuse protection - and removed when it leaves
    one (re-established active trust).  Prunes the registry after the write
    so the cap is enforced on every mutating transition.

    Returns True when the state was recorded.  Returns False (fail closed)
    for a NEW key when the registry is at hard capacity with nothing
    evictable left: the entry is not recorded and the id stays UNKNOWN,
    which denies all tools.  Active trust is never evicted to make room -
    only the oldest tombstones are pruned, so recent tombstone reuse
    protection is preserved.
    """
    if key not in _session_trust:
        # Hard bound: admitting a new key must never push the registry past
        # _TRUST_REGISTRY_CAP.  Evict the oldest tombstones first to make
        # room (recent ENDED reuse protection is preserved).  When the
        # registry is at capacity with active trust only, the admission
        # fails closed: the id stays UNKNOWN (denies all tools) rather than
        # evicting active trust.
        while len(_session_trust) >= _TRUST_REGISTRY_CAP:
            if not _evict_one_tombstone():
                logger.warning(
                    "maestria trust admission refused: registry at capacity "
                    "(session=%r); id stays UNKNOWN (fail closed)",
                    key,
                )
                return False
    was_tombstone = _session_trust.get(key) in _EVICTABLE_STATES
    _session_trust[key] = state
    is_tombstone = state in _EVICTABLE_STATES
    if is_tombstone:
        # Refresh FIFO recency: a tombstone transition - including a repeat
        # of an existing tombstone's end/invalid state - moves the key to
        # the back of the queue, re-arming its reuse protection.  Without
        # this, re-ending an old tombstone would leave it at a stale oldest
        # position and the next admission would evict it to UNKNOWN
        # immediately, defeating the recent-reuse guarantee.
        if was_tombstone:
            try:
                _tombstones.remove(key)
            except ValueError:
                pass
        _tombstones.append(key)
    elif was_tombstone:
        try:
            _tombstones.remove(key)
        except ValueError:
            pass
    _prune_tombstones()
    return True


def _refresh_tombstone_position(key: str) -> None:
    """Move *key* to the back of the FIFO tombstone queue.

    Re-arms reuse protection for a key that is (or just became) a
    tombstone: a repeated end/invalid terminal transition refreshes the
    key's recency instead of leaving it at a stale oldest position where
    it would be the next eviction victim.  The key appears at most once
    in the queue; a key not currently queued is simply appended.
    """
    try:
        _tombstones.remove(key)
    except ValueError:
        pass
    _tombstones.append(key)


def _evict_one_tombstone() -> bool:
    """Evict the oldest evictable tombstone, if any.

    Returns True when an entry was evicted (a registry slot freed).  Skips
    stale queue entries whose key no longer holds an evictable state.  An
    evicted id becomes UNKNOWN on the next read, which denies all tools -
    pruning never grants trust.
    """
    while _tombstones:
        key = _tombstones.popleft()
        if _session_trust.get(key) in _EVICTABLE_STATES:
            _session_trust.pop(key, None)
            _child_topology.pop(key, None)
            return True
    return False


def _prune_tombstones() -> None:
    """Evict oldest ended/invalid tombstones while the registry is over cap.

    Deterministic FIFO: the oldest tombstones (in the order they became
    ended/invalid) are removed first.  Active/trusted entries (TOP_LEVEL,
    TRUSTED_CHILD) are NEVER evicted.  An evicted id becomes UNKNOWN on
    the next read, which denies all tools - pruning never grants trust.

    The hard bound enforced at admission (see _set_trust_state) keeps the
    registry at or under the cap; this remains as a safety net for bulk
    transitions such as revoke_all_trust.
    """
    while len(_session_trust) > _TRUST_REGISTRY_CAP and _evict_one_tombstone():
        pass


# -- Trust-state API --------------------------------------------------------

def get_trust_state(session_id: object) -> str:
    """Return the trust state for *session_id* (or UNKNOWN).

    Missing/invalid identifiers and sessions with no lifecycle evidence
    return UNKNOWN.  Callers fail closed on anything that is not
    TOP_LEVEL or TRUSTED_CHILD.
    """
    return _session_trust.get(_session_key(session_id), UNKNOWN)


def get_child_topology_role(session_id: object) -> str:
    """Return the native topology role of a TRUSTED_CHILD session.

    Returns "" for sessions that are not trusted children.  The topology
    role is observability only and never changes the child's tool policy.
    """
    key = _session_key(session_id)
    if _session_trust.get(key) != TRUSTED_CHILD:
        return ""
    return _child_topology.get(key, "")


def is_trusted_top_level(session_id: object) -> bool:
    """Return True when *session_id* is a trusted top-level session."""
    return get_trust_state(session_id) == TOP_LEVEL


def is_trusted_child(session_id: object) -> bool:
    """Return True when *session_id* is a delegated child with valid
    native topology state."""
    return get_trust_state(session_id) == TRUSTED_CHILD


def is_invalid_child(session_id: object) -> bool:
    """Return True when *session_id* carries invalid child lifecycle state."""
    return get_trust_state(session_id) == INVALID_CHILD


def mark_top_level(session_id: object) -> None:
    """Record *session_id* as a trusted top-level session.

    No-op for unusable identifiers.  Active child state (TRUSTED_CHILD or
    INVALID_CHILD) always outranks a top-level claim and is never
    overwritten here; callers route child lifecycle through
    mark_trusted_child / mark_invalid_child instead.
    """
    key = _session_key(session_id)
    if not key:
        return
    if _session_trust.get(key) in (TRUSTED_CHILD, INVALID_CHILD):
        return
    _set_trust_state(key, TOP_LEVEL)
    _child_topology.pop(key, None)


def mark_trusted_child(session_id: object, role: object) -> bool:
    """Record a delegated child with a validated native topology role.

    Returns True when the child lifecycle is valid (usable session id and
    an EXACT native topology role - the lowercase "leaf"/"orchestrator"
    strings Hermes passes); False otherwise.  A child claim - valid or not
    - invalidates any prior top-level marker for the id: a child reuse of a
    former top-level session id must not retain direct access.  Case
    variants, whitespace, non-strings, and unknown roles are never
    normalized and fail closed (False, INVALID_CHILD).

    An unusable session id (missing/empty/non-string/"unknown") cannot be
    keyed; the tool hook normalizes the same value and fails closed as an
    unknown context, so nothing is recorded and False is returned.
    """
    key = _session_key(session_id)
    if not key:
        return False
    # Child state outranks top-level state for this id.  Native roles are
    # matched EXACTLY - Hermes only ever passes the lowercase strings
    # "leaf"/"orchestrator" (delegate_tool.py effective_role); case
    # variants, whitespace, and malformed role strings are never normalized
    # and never grant child trust.
    if isinstance(role, str) and role in NATIVE_CHILD_ROLES:
        if _set_trust_state(key, TRUSTED_CHILD):
            _child_topology[key] = role
            return True
        # Admission refused: the registry is at hard capacity with active
        # trust only, so nothing is recorded and the child stays UNKNOWN
        # (denies all tools).
        return False
    _set_trust_state(key, INVALID_CHILD)
    _child_topology.pop(key, None)
    return False


def mark_invalid_child(session_id: object) -> None:
    """Record invalid child lifecycle state for *session_id* (fails closed).

    An unusable session id cannot be keyed; the tool hook fails closed as
    an unknown context for the same normalized value.  Invalid-child state
    is an evictable tombstone: it is pruned oldest-first to make room for
    new admissions, and an evicted id becomes UNKNOWN (which still denies
    all tools).  A repeated invalid transition refreshes the id's FIFO
    position, re-arming its reuse protection.
    """
    key = _session_key(session_id)
    if not key:
        return
    _set_trust_state(key, INVALID_CHILD)
    _child_topology.pop(key, None)


def end_trust(session_id: object) -> None:
    """Clear all trust for *session_id* and mark it ENDED.

    Terminal trust boundary: a finalized/stopped session must not retain
    any trust.  A reused id must be re-established by a fresh trusted
    lifecycle event.

    ENDED is an evictable tombstone: it is pruned oldest-first to make
    room for new admissions, so the most recently ended ids keep their
    ENDED reuse protection (an evicted id becomes UNKNOWN, which still
    denies all tools).  A repeated end refreshes the id's FIFO position,
    re-arming its reuse protection.  Active/trusted entries are never
    pruned.
    """
    key = _session_key(session_id)
    if not key:
        return
    _set_trust_state(key, ENDED)
    _child_topology.pop(key, None)


def revoke_all_trust() -> None:
    """Terminal safety net: end EVERY keyed session's trust (fail closed).

    Used when a terminal lifecycle event cannot be scoped to a specific
    session id - the explicit id is missing, malformed, or otherwise
    unusable.  Rather than leave any session trusted after an unscoped
    terminal event, every session with registry state is marked ENDED
    (denies all tools) and its topology role is cleared; each must be
    re-established by a fresh trusted lifecycle event.

    Every revoked key gets a REFRESHED tombstone position: keys that were
    already ended/invalid are moved to the back of the FIFO like the
    freshly revoked ones, so a session revoked by a repeated unscoped
    terminal event re-arms its reuse protection instead of staying at a
    stale oldest position.  The registry is pruned to its cap afterwards:
    every revoked session is an evictable tombstone, and the oldest ended
    entries are dropped first.  All revoked sessions deny all tools whether
    they remain ENDED or are evicted to UNKNOWN.

    Never raises.  Ending trust is always the safe direction - a deny,
    never a grant.
    """
    for key in list(_session_trust):
        _session_trust[key] = ENDED
        _refresh_tombstone_position(key)
    _child_topology.clear()
    _prune_tombstones()


def clear_trust(session_id: object) -> None:
    """Remove every registry entry for *session_id* (test cleanup).

    Equivalent to UNKNOWN for the next read.  Terminal cleanup uses
    end_trust (which records ENDED); this helper exists for tests.
    """
    key = _session_key(session_id)
    if not key:
        return
    _session_trust.pop(key, None)
    _child_topology.pop(key, None)
    try:
        _tombstones.remove(key)
    except ValueError:
        pass


# ---------------------------------------------------------------------------


class SessionManager:
    """Lifecycle-driven trust tracking for the methodology pipeline.

    Lightweight - SessionDB already persists session metadata.  This
    manager records lifecycle trust state only; all methods are total
    (never raise) so a malformed lifecycle payload cannot break the agent
    loop or leave a session incorrectly trusted.

    Terminal events are event-scoped to the explicit native session id in
    the payload when that id is usable (``on_session_reset`` additionally
    scopes CLI-path resets - which carry only the NEW session id - to this
    manager's tracked old-session identity).  When a terminal event cannot
    be scoped (malformed/missing id), the manager revokes ALL active trust
    (see revoke_all_trust) - leaving any session trusted after an unscoped
    terminal event is unsafe.
    """

    def __init__(self):
        self._session_id: Optional[str] = None

    def on_session_start(self, **kwargs) -> None:
        """First-turn lifecycle event for a brand-new session.

        Fires ONCE when a session is created (not on continuation).  A
        recognized non-child platform marks the session top-level unless it
        already carries active child state - a child's own on_session_start
        (platform="subagent") must never overwrite its subagent_start
        registration.  Missing/empty/unknown session ids or platforms leave
        the session UNKNOWN (fails closed).

        Only a usable session id is tracked as the manager's identity: that
        tracked id is used as the default for the per-turn on_session_end
        diagnostic; terminal events never fall back to it - they are
        event-scoped to the payload id, and an unscoped terminal event
        revokes ALL trust (see on_session_finalize).
        """
        session_id = kwargs.get("session_id", "")
        platform = kwargs.get("platform", "")
        self._session_id = session_id if is_valid_lifecycle_id(session_id) else None
        if not is_valid_lifecycle_id(session_id):
            logger.debug("maestria session start ignored (no usable id)")
            return
        if get_trust_state(session_id) in (TRUSTED_CHILD, INVALID_CHILD):
            logger.debug(
                "maestria session start skipped for child session=%s", session_id
            )
            return
        if is_recognized_top_level_platform(platform):
            mark_top_level(session_id)
            logger.debug("maestria top-level session started: %s", session_id)
        else:
            logger.debug(
                "maestria session start left untrusted (platform=%r session=%s)",
                platform, session_id,
            )

    def on_session_end(self, **kwargs) -> None:
        """Per-turn lifecycle event (fires at the end of EVERY turn).

        NOT terminal teardown: a resumed turn must keep its trust, so this
        hook preserves top-level and child state.  Only terminal boundaries
        (on_session_finalize, session reset, subagent_stop) clear trust.
        """
        session_id = kwargs.get("session_id", self._session_id)
        logger.debug("maestria session turn ended (trust preserved): %s", session_id)

    def on_session_finalize(self, **kwargs) -> None:
        """Terminal session boundary (``/new``/``/reset`` or expiry).

        Clears ALL trust for the finalized session id so a former
        top-level or child session cannot retain access when its id is
        reused.

        Event-scoped when the explicit session id is a usable native
        identifier: only that session is ended.  Fails closed on a
        malformed payload: when the explicit session id is missing or not
        a usable identifier, the event cannot be safely scoped to a
        specific session, so EVERY session's active trust is revoked
        (revoke_all_trust) rather than leaving any session trusted.
        Ending trust is always the safe direction - a deny, never a grant.
        The handler never raises; it logs a safe diagnostic for the
        malformed event.
        """
        session_id = kwargs.get("session_id")
        if is_valid_lifecycle_id(session_id):
            end_trust(session_id)
            logger.debug("maestria session finalized: %s", session_id)
            return
        logger.warning(
            "maestria session finalize could not be scoped (session_id=%r); "
            "revoking all active trust (fail closed)",
            _safe_repr(session_id),
        )
        revoke_all_trust()

    def on_session_reset(self, **kwargs) -> None:
        """Terminal boundary for the OLD session after a reset.

        ``/new``/``/reset`` rotates the session id: on_session_finalize
        already finalized the old id, but this hook clears it too (defense
        in depth in case finalize was missed).  The NEW session id receives
        trust from its own on_session_start on the first turn.

        Event-scoped from the payload's authoritative old-session identity
        whenever one is available:

        - Gateway path (gateway/slash_commands.py): the payload names the
          old id explicitly as ``old_session_id``.  Only that session is
          ended.
        - CLI path (cli.py _notify_session_boundary): the payload carries
          only the NEW session id after rotation (``session_id`` /
          ``new_session_id``) - no old id.  The reset is scoped to the
          manager's tracked old-session identity for THIS agent instance
          (recorded by on_session_start), so an unrelated concurrent
          session in the same process is never revoked.

        Fails closed when no old session can be identified safely: a
        malformed payload with no usable id at all, or a CLI payload whose
        new id IS the manager's tracked identity (ambiguous - ending it
        would kill the NEW session), revokes EVERY session's active trust
        (revoke_all_trust) rather than leaving previously trusted state
        active.  The handler never raises; it logs a safe diagnostic for
        the unresolvable event.
        """
        old_session_id = kwargs.get("old_session_id")
        if is_valid_lifecycle_id(old_session_id):
            end_trust(old_session_id)
            logger.debug(
                "maestria session reset cleared old trust: %s", old_session_id
            )
            return

        # CLI path: only the NEW session id is present.  Scope the reset to
        # this manager's tracked identity - the old session for THIS agent
        # instance - so concurrent sessions in the same process are never
        # revoked by an unrelated reset.
        new_session_id = kwargs.get("new_session_id", kwargs.get("session_id", ""))
        if is_valid_lifecycle_id(new_session_id):
            tracked = self._session_id
            if is_valid_lifecycle_id(tracked) and tracked != new_session_id:
                end_trust(tracked)
                logger.debug(
                    "maestria session reset cleared manager-scoped old trust: "
                    "%s (new=%s)",
                    tracked, new_session_id,
                )
                return
            logger.warning(
                "maestria session reset could not identify the old session "
                "(new_session_id=%r tracked=%r); revoking all active trust "
                "(fail closed)",
                _safe_repr(new_session_id), _safe_repr(tracked),
            )
            revoke_all_trust()
            return

        logger.warning(
            "maestria session reset could not be scoped (old_session_id=%r); "
            "revoking all active trust (fail closed)",
            _safe_repr(old_session_id),
        )
        revoke_all_trust()


def create_session_hooks(session_manager: SessionManager):
    """Create lifecycle hook closures bound to *session_manager*.

    Returns (on_start, on_end, on_finalize, on_reset) closures for
    on_session_start, on_session_end, on_session_finalize, and
    on_session_reset.
    """

    def on_start(**kwargs):
        session_manager.on_session_start(**kwargs)

    def on_end(**kwargs):
        session_manager.on_session_end(**kwargs)

    def on_finalize(**kwargs):
        session_manager.on_session_finalize(**kwargs)

    def on_reset(**kwargs):
        session_manager.on_session_reset(**kwargs)

    return on_start, on_end, on_finalize, on_reset

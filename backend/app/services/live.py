"""On-demand live video: WebRTC signaling between a proctor and one candidate.

Media never touches this server. The candidate's browser streams straight to the proctor's browser; the API
only relays two messages per connection (an SDP offer from the candidate, an SDP answer from the proctor) using
non-trickle ICE (each side finishes gathering candidates before sending), so plain HTTP polling is enough.

Flow:
  1. proctor  POST   /api/attempts/{id}/live         -> session id + ICE servers
  2. candidate sees `live` in its frame/heartbeat pulse -> creates offer -> POST .../live/offer
  3. proctor  GET    /api/attempts/{id}/live         -> offer -> POST .../live/answer
  4. candidate GET   .../live/answer                  -> connected
  5. proctor  DELETE /api/attempts/{id}/live          (or stops polling for 30 s) -> candidate hangs up

A candidate whose connection drops re-sends an offer (version + 1) and the proctor re-answers.
State is in memory; the API runs as one instance.
"""

from __future__ import annotations

import logging
import secrets
import threading
import time
from dataclasses import dataclass, field

import httpx

from ..core.config import settings

log = logging.getLogger("guardai.live")

PROCTOR_TIMEOUT_S = 30.0  # session ends if the proctor's viewer stops polling
MAX_SESSION_S = 2 * 60 * 60
STUN = [{"urls": ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"]}]
CF_TURN_URL = "https://rtc.live.cloudflare.com/v1/turn/keys/{key}/credentials/generate-ice-servers"


@dataclass
class LiveSession:
    id: str
    attempt_id: str
    proctor_id: str
    ice_servers: list[dict]
    created: float = field(default_factory=time.monotonic)
    proctor_seen: float = field(default_factory=time.monotonic)
    offer: str | None = None
    answer: str | None = None
    version: int = 0  # bumps each time the candidate sends a fresh offer

    def expired(self, now: float) -> bool:
        return now - self.proctor_seen > PROCTOR_TIMEOUT_S or now - self.created > MAX_SESSION_S


_sessions: dict[str, LiveSession] = {}
_lock = threading.Lock()
_turn_cache: tuple[float, list[dict]] | None = None


def _live(attempt_id: str) -> LiveSession | None:
    s = _sessions.get(attempt_id)
    if s and s.expired(time.monotonic()):
        _sessions.pop(attempt_id, None)
        return None
    return s


async def ice_servers() -> list[dict]:
    """STUN always; TURN (for networks that block direct connections) when configured.

    Cloudflare Realtime TURN issues short-lived credentials from a key id + API token; a static TURN server
    (TURN_URLS / TURN_USERNAME / TURN_CREDENTIAL) works too.
    """
    global _turn_cache
    if settings.turn_urls:
        return [*STUN, {"urls": settings.turn_urls, "username": settings.turn_username, "credential": settings.turn_credential}]
    if not (settings.cloudflare_turn_key_id and settings.cloudflare_turn_api_token):
        return STUN
    now = time.monotonic()
    if _turn_cache and now - _turn_cache[0] < 3600:
        return _turn_cache[1]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                CF_TURN_URL.format(key=settings.cloudflare_turn_key_id),
                headers={"Authorization": f"Bearer {settings.cloudflare_turn_api_token}"},
                json={"ttl": 4 * 3600},
            )
        res.raise_for_status()
        servers = res.json().get("iceServers") or []
        servers = servers if isinstance(servers, list) else [servers]
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("Could not get TURN credentials (%s); falling back to STUN only", exc)
        return STUN
    _turn_cache = (now, servers)
    return servers


async def start(attempt_id: str, proctor_id: str) -> LiveSession:
    """Begin (or restart) watching a candidate. One viewer per attempt; a new request replaces the old one."""
    servers = await ice_servers()
    with _lock:
        session = LiveSession(id=secrets.token_urlsafe(9), attempt_id=attempt_id, proctor_id=proctor_id, ice_servers=servers)
        _sessions[attempt_id] = session
    return session


def proctor_poll(attempt_id: str, session_id: str) -> LiveSession | None:
    with _lock:
        s = _live(attempt_id)
        if not s or s.id != session_id:
            return None
        s.proctor_seen = time.monotonic()
        return s


def set_offer(attempt_id: str, session_id: str, sdp: str) -> LiveSession | None:
    with _lock:
        s = _live(attempt_id)
        if not s or s.id != session_id:
            return None
        s.offer, s.answer, s.version = sdp, None, s.version + 1
        return s


def set_answer(attempt_id: str, session_id: str, version: int, sdp: str) -> LiveSession | None:
    with _lock:
        s = _live(attempt_id)
        if not s or s.id != session_id or s.version != version:
            return None
        s.answer = sdp
        s.proctor_seen = time.monotonic()
        return s


def get(attempt_id: str, session_id: str) -> LiveSession | None:
    with _lock:
        s = _live(attempt_id)
        return s if s and s.id == session_id else None


def stop(attempt_id: str, session_id: str | None = None) -> None:
    with _lock:
        s = _sessions.get(attempt_id)
        if s and (session_id is None or s.id == session_id):
            _sessions.pop(attempt_id, None)


def request_for(attempt_id: str) -> dict | None:
    """What the candidate's pulse carries: an active watch request, or None (hang up)."""
    with _lock:
        s = _live(attempt_id)
        return {"session_id": s.id, "ice_servers": s.ice_servers} if s else None


def watching(attempt_id: str) -> bool:
    with _lock:
        return _live(attempt_id) is not None

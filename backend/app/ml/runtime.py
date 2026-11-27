"""Process-wide AI runtime: model pool, bounded concurrency, per-attempt trackers and live cache.

State lives in memory, so run ONE backend instance (Railway default). Losing it on restart is harmless:
trackers rebuild within seconds and the live grid refills on the next frame.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import os
import queue
import threading
import time
from dataclasses import dataclass, field

from ..core.config import settings
from .detector import MATCH_THRESHOLD, FrameAnalysis, FrameAnalyzer, decode_image, encode_jpeg, match_score
from .tracker import AnomalyTracker, Calibration, Event

log = logging.getLogger("guardai.ml")

TRACKER_TTL_S = 15 * 60
MIN_FRAME_GAP_S = 0.45
IDENTITY_EVERY = 4
UTIL_WINDOW_S = 10.0
# Object detection (YOLOX, ~125 ms/frame on one CPU thread) is the expensive part. Run it on every frame
# while the server has headroom and thin it out as utilisation rises; frames with a suspicious cue always
# get it. (utilisation ceiling, run every Nth frame)
OBJECT_SCHEDULE = ((0.5, 1), (0.8, 2), (2.0, 3))


@dataclass
class LiveEntry:
    thumb: str | None = None  # data URL for the proctor's live grid
    frame: bytes | None = None  # last full-size JPEG, used as evidence for browser events
    analysis: dict = field(default_factory=dict)
    at: float = 0.0


class MLUnavailable(RuntimeError):
    pass


class MLRuntime:
    def __init__(self) -> None:
        self.ready = False
        self.error: str | None = None
        self._pool: queue.Queue[FrameAnalyzer] = queue.Queue()
        self._sem = asyncio.Semaphore(settings.ml_concurrency)
        self._waiting = 0
        self._latency = 0.0
        self.trackers: dict[str, tuple[AnomalyTracker, float]] = {}
        self.live: dict[str, LiveEntry] = {}
        self._last_frame_at: dict[str, float] = {}
        self._frame_no: dict[str, int] = {}
        self._busy: list[tuple[float, float]] = []  # (finished_at, seconds) for utilisation
        self._lock = threading.Lock()

    # ---------------------------------------------------------------------------- lifecycle
    def load(self) -> None:
        if not settings.ml_enabled:
            self.error = "ML_ENABLED=false"
            return
        try:
            threads = max(1, (os.cpu_count() or 1) // settings.ml_concurrency)
            started = time.perf_counter()
            for _ in range(settings.ml_concurrency):
                self._pool.put(FrameAnalyzer(settings.model_dir, threads=threads))
            self.ready = True
            log.info(
                "AI models loaded (%d worker(s), %d thread(s) each) in %.1fs",
                settings.ml_concurrency,
                threads,
                time.perf_counter() - started,
            )
        except Exception as exc:  # missing weights / unsupported platform: API keeps working without AI
            self.error = f"{type(exc).__name__}: {exc}"
            log.error("AI models failed to load — proctoring analysis disabled: %s", self.error)

    async def load_async(self) -> None:
        await asyncio.to_thread(self.load)

    # ---------------------------------------------------------------------------- inference
    def next_frame_ms(self) -> int:
        """Ask clients to slow down when frames queue up (simple back-pressure)."""
        load = self._waiting / settings.ml_concurrency
        lat = max(1.0, self._latency * 1000 / 250)  # >250 ms average inference -> stretch interval
        return int(min(6000, settings.frame_interval_ms * max(1.0, 1 + load) * max(1.0, lat / 2)))

    def accept_frame(self, attempt_id: str) -> bool:
        now = time.monotonic()
        last = self._last_frame_at.get(attempt_id, 0.0)
        if now - last < MIN_FRAME_GAP_S:
            return False
        self._last_frame_at[attempt_id] = now
        return True

    def _run(self, data: bytes, detect_objects: bool, want_embedding: bool):
        img = decode_image(data)
        if img is None:
            raise ValueError("Could not decode the image")
        analyzer = self._pool.get()
        try:
            started = time.perf_counter()
            analysis = analyzer.analyze(img, detect_objects=detect_objects, want_embedding=want_embedding)
            elapsed = time.perf_counter() - started
        finally:
            self._pool.put(analyzer)
        self._latency = elapsed if self._latency == 0 else 0.8 * self._latency + 0.2 * elapsed
        with self._lock:
            self._busy.append((time.monotonic(), elapsed))
        return img, analysis

    def utilisation(self) -> float:
        """Share of worker time spent on inference over the last few seconds (0..1+)."""
        cutoff = time.monotonic() - UTIL_WINDOW_S
        with self._lock:
            self._busy = [b for b in self._busy if b[0] >= cutoff]
            busy = sum(b[1] for b in self._busy)
        return busy / (UTIL_WINDOW_S * settings.ml_concurrency)

    async def analyze(self, data: bytes, detect_objects: bool = True, want_embedding: bool = False):
        if not self.ready:
            raise MLUnavailable(self.error or "AI models are still loading")
        self._waiting += 1
        try:
            await self._sem.acquire()
        finally:
            self._waiting -= 1
        try:
            return await asyncio.to_thread(self._run, data, detect_objects, want_embedding)
        finally:
            self._sem.release()

    # ---------------------------------------------------------------------------- per attempt
    def plan(self, attempt_id: str) -> tuple[bool, bool]:
        """(run object detector?, compute identity embedding?) for this attempt's next frame.

        Objects: every frame while there is headroom (see OBJECT_SCHEDULE), and always after a suspicious
        frame (eyes/head down, face missing or doubled, an object half-seen). Identity: every 4th frame and
        whenever a face reappears (a seat swap). The first frame does both.
        """
        n = self._frame_no.get(attempt_id, 0)
        self._frame_no[attempt_id] = n + 1
        entry = self.trackers.get(attempt_id)
        tracker = entry[0] if entry else None
        util = self.utilisation()
        every = next(k for ceiling, k in OBJECT_SCHEDULE if util < ceiling) if util < OBJECT_SCHEDULE[-1][0] else 4
        objects = n % every == 0 or (tracker is not None and tracker.suspicious())
        reappeared = tracker is not None and tracker.last is not None and tracker.last.faces == 0
        return objects, n % IDENTITY_EVERY == 0 or reappeared

    def tracker_for(self, attempt_id: str, calibration: dict | None) -> AnomalyTracker:
        with self._lock:
            entry = self.trackers.get(attempt_id)
            if entry is None:
                keys = ("yaw", "pitch", "gaze_x", "gaze_y")
                cal = Calibration(**{k: float(v) for k, v in (calibration or {}).items() if k in keys})
                entry = (AnomalyTracker(cal), time.monotonic())
            self.trackers[attempt_id] = (entry[0], time.monotonic())
            return entry[0]

    def process(
        self,
        attempt_id: str,
        calibration: dict | None,
        img,
        analysis: FrameAnalysis,
        audio_level: float,
        detect_objects: bool,
        reference: list[float] | None = None,
        voice: float | None = None,
        final: bool = False,
    ) -> list[Event]:
        tracker = self.tracker_for(attempt_id, calibration)
        identity = match_score(reference, analysis.embedding) if analysis.embedding else None
        now = time.monotonic()
        events = tracker.update(
            analysis, now, audio_level=audio_level, check_objects=detect_objects, identity_score=identity, voice=voice
        )
        if final:
            events += tracker.flush(now)
        previous = self.live.get(attempt_id)
        public = analysis.to_public()
        public["looking_away"] = tracker.looking_away(analysis)
        if identity is not None:
            public["identity"] = {"score": identity, "match": identity >= MATCH_THRESHOLD}
        elif previous and "identity" in previous.analysis:
            public["identity"] = previous.analysis["identity"]
        if not detect_objects and previous:
            public["objects"] = previous.analysis.get("objects", [])
            public["persons"] = previous.analysis.get("persons", 0)
        thumb = encode_jpeg(img, width=320, quality=60)
        self.live[attempt_id] = LiveEntry(
            thumb="data:image/jpeg;base64," + base64.b64encode(thumb).decode(),
            frame=encode_jpeg(img, quality=80),
            analysis=public,
            at=time.time(),
        )
        return events

    def forget(self, attempt_id: str) -> None:
        self.trackers.pop(attempt_id, None)
        self.live.pop(attempt_id, None)
        self._last_frame_at.pop(attempt_id, None)
        self._frame_no.pop(attempt_id, None)

    def sweep(self) -> None:
        cutoff = time.monotonic() - TRACKER_TTL_S
        for key, (_, seen) in list(self.trackers.items()):
            if seen < cutoff:
                self.forget(key)

    def status(self) -> dict:
        return {
            "ready": self.ready,
            "error": self.error,
            "workers": settings.ml_concurrency,
            "queued": self._waiting,
            "avg_inference_ms": round(self._latency * 1000, 1),
            "utilisation": round(self.utilisation(), 2),
            "active_streams": len(self.trackers),
            "next_frame_ms": self.next_frame_ms(),
        }


runtime = MLRuntime()

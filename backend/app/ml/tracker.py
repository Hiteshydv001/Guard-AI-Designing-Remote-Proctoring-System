"""Turns a stream of per-frame analyses (~1 per second) into proctoring violations.

  * head turned away from the calibrated pose for >= 2 s, and frequent head movements
  * eyes (pupils) looking left / right / down relative to the student's own calibrated gaze for >= 2 s,
    ignoring blinks, and frequent eye movements
  * no face or a covered camera; a second face or person in a single frame (someone walking past)
  * phones (one clear sighting is enough), books, extra devices
  * speech at the microphone (talking when the mouth moves too, someone nearby otherwise) and loud noise
  * the face not matching the registered photo

`flush()` reports half-confirmed sightings when the attempt ends, so a phone used just before submitting
is still recorded.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

from .detector import MATCH_THRESHOLD, FrameAnalysis


@dataclass
class Event:
    type: str
    severity: str
    message: str
    meta: dict = field(default_factory=dict)


RULES = {
    "yaw_limit": 20.0,
    "pitch_up": 15.0,
    "pitch_down": 20.0,
    "gaze_x_limit": 0.40,  # horizontal eye deviation from the calibrated baseline
    "gaze_down_limit": 0.30,  # downward eye deviation (phone or notes on the desk)
    "blink_max": 0.35,  # eye direction is unreliable while blinking
    "no_face_s": 3.0,
    "multi_face_s": 0.0,  # one frame is enough: people walking past are only briefly visible
    "looking_away_s": 2.0,
    "gaze_away_s": 2.0,
    "head_moves": 4,
    "head_move_window_s": 30.0,
    "eye_moves": 5,
    "eye_move_window_s": 30.0,
    "object_frames": 2,  # consecutive checked frames for a low-confidence sighting
    "object_sure": {"cell phone": 0.50, "book": 0.60, "laptop": 0.65},  # one frame is enough above these
    "voice_ratio": 0.30,  # share of the last interval that sounded like speech
    "voice_frames": 2,
    "noise_level": 0.15,
    "noise_frames": 2,
    "loud_level": 0.06,  # older clients that only send a loudness level
    "talk_s": 2.5,
    "jaw_std": 0.04,
    "jaw_open": 0.15,
    "dark_level": 22.0,
    "cooldown_s": 10.0,
    "identity_strikes": 2,  # consecutive failed identity checks before flagging
}
# Typical downward gaze while reading a screen below the webcam (measured on real captures: +0.3..+0.6),
# used when an attempt was calibrated before gaze baselines existed.
DEFAULT_GAZE_Y = 0.45

OBJECT_RULES = {
    "cell phone": ("phone_detected", "high", "Mobile phone detected in camera view"),
    "book": ("book_detected", "medium", "Book or notes detected in camera view"),
    "laptop": ("extra_device", "medium", "Additional laptop detected in camera view"),
}


@dataclass
class Calibration:
    yaw: float = 0.0
    pitch: float = 0.0
    gaze_x: float = 0.0
    gaze_y: float = DEFAULT_GAZE_Y


class AnomalyTracker:
    def __init__(self, calibration: Calibration | None = None):
        self.cal = calibration or Calibration()
        self.last: FrameAnalysis | None = None
        self._since: dict[str, float | None] = {}
        self._fired: dict[str, bool] = {}
        self._last_emit: dict[str, float] = {}
        self._object_streak: dict[str, int] = {}
        self._away_prev = False
        self._away_onsets: deque[float] = deque()
        self._eye_prev = False
        self._eye_onsets: deque[float] = deque()
        self._jaw: deque[float] = deque(maxlen=4)
        self._identity_strikes = 0
        self._voice_streak = 0
        self._noise_streak = 0

    # -- helpers --------------------------------------------------------------------------------
    def _sustained(self, key: str, active: bool, seconds: float, now: float) -> bool:
        """True exactly once per episode, when `active` has held for `seconds`."""
        if not active:
            self._since[key] = None
            self._fired[key] = False
            return False
        if self._since.get(key) is None:
            self._since[key] = now
        started = self._since[key]
        if not self._fired.get(key) and started is not None and now - started >= seconds:
            self._fired[key] = True
            return True
        return False

    def _emit(self, events: list[Event], now: float, ev: Event) -> None:
        if now - self._last_emit.get(ev.type, -1e9) < RULES["cooldown_s"]:
            return
        self._last_emit[ev.type] = now
        events.append(ev)

    @staticmethod
    def _onsets(onsets: deque[float], active: bool, prev: bool, now: float, window: float) -> int:
        if active and not prev:
            onsets.append(now)
        while onsets and now - onsets[0] > window:
            onsets.popleft()
        return len(onsets)

    # -- per-frame signals ----------------------------------------------------------------------
    def looking_away(self, a: FrameAnalysis) -> bool:
        if a.faces < 1 or a.yaw is None or a.pitch is None:
            return False
        dy, dp = a.yaw - self.cal.yaw, a.pitch - self.cal.pitch
        return abs(dy) > RULES["yaw_limit"] or dp > RULES["pitch_up"] or dp < -RULES["pitch_down"]

    def eyes_off(self, a: FrameAnalysis) -> str | None:
        """'left' / 'right' / 'down' when the pupils point away from the screen, relative to calibration."""
        if a.faces != 1 or a.yaw is None or a.blink > RULES["blink_max"]:
            return None
        dx, dy = a.gaze - self.cal.gaze_x, a.gaze_y - self.cal.gaze_y
        if dy > RULES["gaze_down_limit"]:
            return "down"
        if abs(dx) > RULES["gaze_x_limit"]:
            return "right" if dx > 0 else "left"
        return None

    def suspicious(self) -> bool:
        """Cues on the previous frame that make an object check worth running on this one."""
        a = self.last
        if a is None:
            return True
        head_down = a.pitch is not None and a.pitch - self.cal.pitch < -12
        return (
            a.faces != 1 or head_down or self.looking_away(a) or self.eyes_off(a) is not None or any(self._object_streak.values())
        )

    # -- main entry -----------------------------------------------------------------------------
    def update(
        self,
        a: FrameAnalysis,
        now: float,
        audio_level: float = 0.0,
        check_objects: bool = True,
        identity_score: float | None = None,
        voice: float | None = None,
    ) -> list[Event]:
        events: list[Event] = []
        prev, self.last = self.last, a

        if identity_score is not None:
            self._identity_strikes = self._identity_strikes + 1 if identity_score < MATCH_THRESHOLD else 0
            if self._identity_strikes == RULES["identity_strikes"]:
                self._emit(
                    events,
                    now,
                    Event(
                        "identity_mismatch",
                        "high",
                        "The person in the camera does not match the registered student photo",
                        {"match": identity_score},
                    ),
                )

        # People in view. Person boxes only exist on frames where the object model ran.
        persons = a.persons if check_objects else (prev.persons if prev else 0)
        others = max(a.faces, persons)
        if self._sustained("no_face", a.faces == 0 and persons == 0, RULES["no_face_s"], now):
            dark = a.brightness < RULES["dark_level"]
            self._emit(
                events,
                now,
                Event("camera_blocked", "high", "Camera appears to be covered or too dark")
                if dark
                else Event("no_face", "high", "No face visible in the camera"),
            )
        if self._sustained("multi", others > 1, RULES["multi_face_s"], now):
            label = f"{a.faces} faces" if a.faces > 1 else f"{persons} people"
            self._emit(
                events,
                now,
                Event("multiple_faces", "high", f"Another person in view ({label})", {"faces": a.faces, "persons": persons}),
            )

        # Head.
        away = self.looking_away(a)
        if self._sustained("away", away, RULES["looking_away_s"], now):
            self._emit(
                events,
                now,
                Event(
                    "looking_away",
                    "medium",
                    "Head turned away from the screen",
                    {"yaw": round((a.yaw or 0) - self.cal.yaw), "pitch": round((a.pitch or 0) - self.cal.pitch)},
                ),
            )
        if self._onsets(self._away_onsets, away, self._away_prev, now, RULES["head_move_window_s"]) >= RULES["head_moves"]:
            self._away_onsets.clear()
            self._emit(events, now, Event("frequent_head_movement", "medium", "Frequent head movements (4+ in 30 s)"))
        self._away_prev = away

        # Eyes (pupils), only when the head itself is facing the screen.
        eyes = None if away else self.eyes_off(a)
        if self._sustained("gaze", eyes is not None, RULES["gaze_away_s"], now):
            where = "down, away from the screen" if eyes == "down" else f"to the {eyes} of the screen"
            self._emit(
                events,
                now,
                Event(
                    "gaze_away",
                    "medium" if eyes == "down" else "low",
                    f"Eyes looking {where}",
                    {"direction": eyes, "gaze_x": round(a.gaze, 2), "gaze_y": round(a.gaze_y, 2)},
                ),
            )
        eye_off = eyes is not None
        if self._onsets(self._eye_onsets, eye_off, self._eye_prev, now, RULES["eye_move_window_s"]) >= RULES["eye_moves"]:
            self._eye_onsets.clear()
            self._emit(events, now, Event("frequent_eye_movement", "low", "Eyes repeatedly moving away from the screen"))
        self._eye_prev = eye_off

        # Objects.
        if check_objects:
            seen = set(a.labels())
            for label, (etype, sev, msg) in OBJECT_RULES.items():
                streak = self._object_streak.get(label, 0) + 1 if label in seen else 0
                self._object_streak[label] = streak
                score = max((o.score for o in a.objects if o.label == label), default=0.0)
                sure = score >= RULES["object_sure"].get(label, 1.0)
                if streak == RULES["object_frames"] or (sure and streak == 1):
                    self._emit(events, now, Event(etype, sev, msg, {"object": label, "confidence": round(score, 2)}))

        # Sound.
        if a.faces == 1:
            self._jaw.append(a.jaw_open)
        mouth_moving = (len(self._jaw) >= 3 and _std(self._jaw) > RULES["jaw_std"]) or (
            a.faces == 1 and a.jaw_open > RULES["jaw_open"]
        )
        if voice is None:  # older clients: loudness only
            if self._sustained("loud", audio_level > RULES["loud_level"], RULES["talk_s"], now):
                self._emit(events, now, self._speech_event(mouth_moving, audio_level, None))
            return events

        speech = voice >= RULES["voice_ratio"]
        self._voice_streak = self._voice_streak + 1 if speech else 0
        if self._voice_streak == RULES["voice_frames"]:
            self._emit(events, now, self._speech_event(mouth_moving, audio_level, voice))
        noisy = not speech and audio_level > RULES["noise_level"]
        self._noise_streak = self._noise_streak + 1 if noisy else 0
        if self._noise_streak == RULES["noise_frames"]:
            self._emit(
                events, now, Event("background_noise", "low", "Loud noise near the microphone", {"level": round(audio_level, 3)})
            )
        return events

    @staticmethod
    def _speech_event(mouth_moving: bool, level: float, voice: float | None) -> Event:
        meta = {"level": round(level, 3), **({"voice": round(voice, 2)} if voice is not None else {})}
        if mouth_moving:
            return Event("talking", "high", "Candidate appears to be talking", meta)
        return Event("background_voice", "medium", "Someone is speaking nearby", meta)

    def flush(self, now: float) -> list[Event]:
        """Report sightings seen but not yet confirmed, because the attempt is ending."""
        events: list[Event] = []
        a = self.last
        for label, (etype, sev, msg) in OBJECT_RULES.items():
            if self._object_streak.get(label, 0) >= 1:
                score = max((o.score for o in a.objects if o.label == label), default=0.0) if a else 0.0
                self._emit(
                    events,
                    now,
                    Event(etype, sev, f"{msg} just before submitting", {"object": label, "confidence": round(score, 2)}),
                )
                self._object_streak[label] = 0
        if self._voice_streak >= 1:
            self._emit(events, now, Event("background_voice", "medium", "Speech detected just before submitting"))
            self._voice_streak = 0
        return events


def _std(values) -> float:
    vals = list(values)
    mean = sum(vals) / len(vals)
    return (sum((v - mean) ** 2 for v in vals) / len(vals)) ** 0.5

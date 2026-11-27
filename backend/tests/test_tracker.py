"""Anomaly rules on synthetic frame sequences (timing logic, no models needed). Frames arrive ~1 s apart."""

from app.ml.detector import DetectedObject, FrameAnalysis
from app.ml.tracker import AnomalyTracker, Calibration


def frame(**kw) -> FrameAnalysis:
    base = dict(width=640, height=480, faces=1, yaw=0.0, pitch=0.0, brightness=120.0, gaze=0.0, gaze_y=0.45)
    base.update(kw)
    return FrameAnalysis(**base)


def run(tracker, frames, step=1.0, **kw):
    events, t = [], 0.0
    for f in frames:
        events += tracker.update(f, t, **kw)
        t += step
    return [e.type for e in events]


PHONE_SURE = DetectedObject("cell phone", 0.62, (0, 0, 10, 10))
PHONE_FAINT = DetectedObject("cell phone", 0.40, (0, 0, 10, 10))


def test_steady_candidate_raises_nothing():
    assert run(AnomalyTracker(), [frame() for _ in range(60)], voice=0.0, audio_level=0.01) == []


def test_no_face_and_camera_blocked():
    assert run(AnomalyTracker(), [frame(faces=0)] * 4) == ["no_face"]
    assert run(AnomalyTracker(), [frame(faces=0, brightness=5)] * 4) == ["camera_blocked"]


def test_person_passing_by_is_caught_in_one_frame():
    assert run(AnomalyTracker(), [frame(), frame(faces=2), frame()]) == ["multiple_faces"]
    assert run(AnomalyTracker(), [frame(), frame(persons=2), frame()]) == ["multiple_faces"]  # back turned, no face
    # person boxes from an earlier frame aren't re-counted when the object model skipped this one
    t = AnomalyTracker()
    assert run(t, [frame(persons=1)], check_objects=True) == []


def test_looking_away_is_relative_to_calibration_and_takes_2s():
    assert run(AnomalyTracker(), [frame(yaw=32.0)] * 2) == []
    assert run(AnomalyTracker(), [frame(yaw=32.0)] * 3) == ["looking_away"]
    assert run(AnomalyTracker(Calibration(yaw=30.0)), [frame(yaw=32.0)] * 4) == []  # their neutral pose


def test_frequent_head_movement():
    seq = []
    for _ in range(4):
        seq += [frame(yaw=40.0), frame()]
    assert "frequent_head_movement" in run(AnomalyTracker(), seq)


def test_pupils_down_or_sideways_relative_to_baseline():
    assert run(AnomalyTracker(), [frame(gaze_y=0.85)] * 3) == ["gaze_away"]  # eyes down at a phone/notes
    assert run(AnomalyTracker(), [frame(gaze=0.55)] * 3) == ["gaze_away"]
    # this student's eyes naturally sit lower: same reading is normal for them
    assert run(AnomalyTracker(Calibration(gaze_y=0.7)), [frame(gaze_y=0.85)] * 4) == []
    # blinking pushes "down" readings up; ignored
    assert run(AnomalyTracker(), [frame(gaze_y=0.9, blink=0.6)] * 4) == []


def test_frequent_eye_movement():
    seq = []
    for _ in range(5):
        seq += [frame(gaze=0.6), frame()]
    assert run(AnomalyTracker(), seq) == ["frequent_eye_movement"]


def test_clear_phone_is_flagged_on_first_sighting():
    assert run(AnomalyTracker(), [frame(objects=[PHONE_SURE])]) == ["phone_detected"]


def test_faint_phone_needs_two_frames():
    assert run(AnomalyTracker(), [frame(objects=[PHONE_FAINT]), frame(), frame(objects=[PHONE_FAINT])]) == []
    assert run(AnomalyTracker(), [frame(objects=[PHONE_FAINT]), frame(objects=[PHONE_FAINT])]) == ["phone_detected"]


def test_flush_reports_half_seen_phone_on_submit():
    t = AnomalyTracker()
    assert run(t, [frame(objects=[PHONE_FAINT])]) == []
    events = t.flush(1.0)
    assert [e.type for e in events] == ["phone_detected"] and "before submitting" in events[0].message
    assert t.flush(2.0) == []


def test_speech_talking_vs_someone_nearby_vs_noise():
    moving = [frame(jaw_open=v) for v in (0.0, 0.3, 0.0, 0.35)]
    assert run(AnomalyTracker(), moving, voice=0.6, audio_level=0.1) == ["talking"]
    assert run(AnomalyTracker(), [frame()] * 3, voice=0.6, audio_level=0.1) == ["background_voice"]
    assert run(AnomalyTracker(), [frame()] * 3, voice=0.0, audio_level=0.4) == ["background_noise"]
    assert run(AnomalyTracker(), [frame()] * 6, voice=0.1, audio_level=0.05) == []  # quiet room


def test_legacy_clients_without_voice_ratio():
    assert run(AnomalyTracker(), [frame()] * 4, audio_level=0.2) == ["background_voice"]


def test_identity_mismatch_needs_two_strikes():
    t = AnomalyTracker()
    assert [e.type for e in t.update(frame(), 0, identity_score=0.2)] == []
    assert [e.type for e in t.update(frame(), 4, identity_score=0.7)] == []  # streak reset
    assert [e.type for e in t.update(frame(), 8, identity_score=0.1)] == []
    assert [e.type for e in t.update(frame(), 12, identity_score=0.15)] == ["identity_mismatch"]


def test_suspicious_cues_request_an_object_check():
    t = AnomalyTracker()
    t.update(frame(), 0)
    assert not t.suspicious()
    t.update(frame(gaze_y=0.9), 1)
    assert t.suspicious()


def test_cooldown_prevents_spam():
    seq = [frame(faces=0)] * 4 + [frame()] + [frame(faces=0)] * 4
    assert run(AnomalyTracker(), seq) == ["no_face"]  # second episode within the 10 s cooldown

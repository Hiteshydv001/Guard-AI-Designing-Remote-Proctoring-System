"""Per-frame vision analysis.

Three small CPU models (~25 MB total, all permissively licensed):
  * YuNet (OpenCV, MIT)                       — face detection / counting, robust to distance and backlight.
  * MediaPipe Face Landmarker (Apache-2.0)    — head pose, eye gaze and mouth opening on the main face crop.
  * SFace (OpenCV, Apache-2.0)                — 128-d face embeddings for identity verification.
  * YOLOX-Tiny (ONNX, 5M params, Apache-2.0)  — people, phones, books, laptops.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from pathlib import Path

import cv2
import numpy as np

COCO_WATCH = {0: "person", 63: "laptop", 67: "cell phone", 73: "book"}
CLASS_THRESHOLDS = {"person": 0.5, "cell phone": 0.35, "book": 0.45, "laptop": 0.5}
MAX_SIDE = 640
# Cosine similarity above which two SFace embeddings are the same person. OpenCV's LFW-validated value is
# 0.363; real webcam tests (same person 0.49-0.85, different person 0.18-0.36) put a safer cut at 0.40.
MATCH_THRESHOLD = 0.40


@dataclass
class DetectedObject:
    label: str
    score: float
    box: tuple[int, int, int, int]  # x1, y1, x2, y2 in frame pixels


@dataclass
class FrameAnalysis:
    width: int
    height: int
    faces: int = 0
    persons: int = 0
    yaw: float | None = None
    pitch: float | None = None
    gaze: float = 0.0  # horizontal eye gaze, -1 (left) .. 1 (right)
    gaze_y: float = 0.0  # vertical eye gaze, -1 (up) .. 1 (down)
    blink: float = 0.0  # 0 open .. 1 closed (gaze is unreliable while blinking)
    jaw_open: float = 0.0
    brightness: float = 0.0
    objects: list[DetectedObject] = field(default_factory=list)
    face_box: tuple[int, int, int, int] | None = None
    embedding: list[float] | None = None  # main face, only when identity is checked on this frame

    def labels(self) -> list[str]:
        return sorted({o.label for o in self.objects if o.label != "person"})

    def to_public(self) -> dict:
        d = asdict(self)
        d.pop("embedding", None)
        d["objects"] = [{"label": o.label, "score": round(o.score, 2), "box": o.box} for o in self.objects]
        d["yaw"] = None if self.yaw is None else round(self.yaw, 1)
        d["pitch"] = None if self.pitch is None else round(self.pitch, 1)
        d["gaze"] = round(self.gaze, 2)
        d["gaze_y"] = round(self.gaze_y, 2)
        d["blink"] = round(self.blink, 2)
        d["jaw_open"] = round(self.jaw_open, 3)
        d["brightness"] = round(self.brightness, 1)
        return d


def decode_image(data: bytes) -> np.ndarray | None:
    """JPEG/PNG bytes -> BGR image, downscaled so the longest side is <= 640 px."""
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None
    h, w = img.shape[:2]
    scale = MAX_SIDE / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def encode_jpeg(img: np.ndarray, width: int | None = None, quality: int = 70) -> bytes:
    if width and img.shape[1] > width:
        h = int(img.shape[0] * width / img.shape[1])
        img = cv2.resize(img, (width, h), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes() if ok else b""


class YoloxDetector:
    """YOLOX ONNX inference with the official grid decoding + class-aware NMS."""

    def __init__(self, model_path: Path, threads: int = 1):
        import onnxruntime as ort

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = threads
        opts.inter_op_num_threads = 1
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(str(model_path), sess_options=opts, providers=["CPUExecutionProvider"])
        inp = self.session.get_inputs()[0]
        self.input_name = inp.name
        self.size = int(inp.shape[2]) if isinstance(inp.shape[2], int) else 416
        self._grids, self._strides = self._make_grids(self.size)

    @staticmethod
    def _make_grids(size: int):
        grids, strides = [], []
        for stride in (8, 16, 32):
            n = size // stride
            xv, yv = np.meshgrid(np.arange(n), np.arange(n))
            grid = np.stack((xv, yv), 2).reshape(-1, 2)
            grids.append(grid)
            strides.append(np.full((grid.shape[0], 1), stride))
        return np.concatenate(grids, 0).astype(np.float32), np.concatenate(strides, 0).astype(np.float32)

    def __call__(self, bgr: np.ndarray) -> list[DetectedObject]:
        h, w = bgr.shape[:2]
        r = min(self.size / h, self.size / w)
        padded = np.full((self.size, self.size, 3), 114, dtype=np.uint8)
        resized = cv2.resize(bgr, (int(w * r), int(h * r)), interpolation=cv2.INTER_LINEAR)
        padded[: resized.shape[0], : resized.shape[1]] = resized
        blob = np.ascontiguousarray(padded.transpose(2, 0, 1)[None], dtype=np.float32)

        out = self.session.run(None, {self.input_name: blob})[0][0]  # (N, 85)
        xy = (out[:, :2] + self._grids) * self._strides
        wh = np.exp(out[:, 2:4]) * self._strides
        scores = out[:, 4:5] * out[:, 5:]

        results: list[DetectedObject] = []
        for cls_id, label in COCO_WATCH.items():
            cls_scores = scores[:, cls_id]
            keep = cls_scores >= CLASS_THRESHOLDS[label]
            if not keep.any():
                continue
            c_xy, c_wh, c_s = xy[keep], wh[keep], cls_scores[keep]
            boxes = np.concatenate([c_xy - c_wh / 2, c_wh], axis=1) / r  # x, y, w, h in original pixels
            idx = cv2.dnn.NMSBoxes(boxes.tolist(), c_s.tolist(), CLASS_THRESHOLDS[label], 0.45)
            for i in np.array(idx).flatten():
                x, y, bw, bh = boxes[i]
                results.append(
                    DetectedObject(
                        label=label,
                        score=float(c_s[i]),
                        box=(max(0, int(x)), max(0, int(y)), min(w, int(x + bw)), min(h, int(y + bh))),
                    )
                )
        return results


def _import_mediapipe():
    """Import MediaPipe without pulling in matplotlib.

    `mediapipe.tasks.python.vision` imports its drawing helpers eagerly, which import matplotlib at module
    level but only use it inside a 3-D plotting function we never call. Installing matplotlib would cost
    ~40 MB of RAM on a small Railway instance, so register an empty placeholder when it is absent.
    """
    import sys
    import types

    try:
        import matplotlib  # noqa: F401
    except ImportError:
        stub = types.ModuleType("matplotlib")
        stub.pyplot = types.ModuleType("matplotlib.pyplot")  # type: ignore[attr-defined]
        sys.modules.setdefault("matplotlib", stub)
        sys.modules.setdefault("matplotlib.pyplot", stub.pyplot)  # type: ignore[attr-defined]
    import mediapipe

    return mediapipe


def _head_angles(m: np.ndarray) -> tuple[float, float]:
    """Yaw / pitch in degrees from MediaPipe's 4x4 facial transformation matrix."""
    pitch = math.degrees(math.atan2(m[2, 1], m[2, 2]))
    yaw = math.degrees(math.asin(max(-1.0, min(1.0, -m[2, 0]))))
    return yaw, pitch


class FaceAnalyzer:
    """YuNet finds and counts faces (robust to distance and backlight); MediaPipe Face Landmarker
    then runs on a crop of the main face for head pose, eye gaze and mouth movement."""

    # A tight crop keeps bright backgrounds (lamps, windows) from confusing the landmarker's own face
    # finder; a wider crop is tried once if the tight one finds nothing (e.g. strongly turned heads).
    CROP_MARGINS = (0.35, 0.6)
    CROP_SIZE = 256

    def __init__(self, landmarker_path: Path, yunet_path: Path, sface_path: Path):
        mp = _import_mediapipe()
        from mediapipe.tasks.python import BaseOptions, vision

        self._mp_image = mp.Image
        self._fmt = mp.ImageFormat.SRGB
        self.detector = cv2.FaceDetectorYN.create(str(yunet_path), "", (320, 320), 0.6, 0.3, 20)
        self.recognizer = cv2.FaceRecognizerSF.create(str(sface_path), "")
        self.landmarker = vision.FaceLandmarker.create_from_options(
            vision.FaceLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=str(landmarker_path)),
                running_mode=vision.RunningMode.IMAGE,
                num_faces=1,
                min_face_detection_confidence=0.3,
                min_face_presence_confidence=0.3,
                output_face_blendshapes=True,
                output_facial_transformation_matrixes=True,
            )
        )

    def detect(self, bgr: np.ndarray) -> list[np.ndarray]:
        """Raw YuNet rows (x, y, w, h, 5 landmarks, score), largest face first."""
        h, w = bgr.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(bgr)
        if faces is None:
            return []
        return sorted(faces, key=lambda f: -float(f[2] * f[3]))

    def embed(self, bgr: np.ndarray, face_row: np.ndarray) -> list[float]:
        aligned = self.recognizer.alignCrop(bgr, face_row)
        vec = self.recognizer.feature(aligned).flatten().astype(np.float32)
        vec /= np.linalg.norm(vec) + 1e-9
        return [round(float(x), 6) for x in vec]

    def _crop(self, bgr: np.ndarray, row: np.ndarray, margin: float) -> np.ndarray:
        h, w = bgr.shape[:2]
        x, y, bw, bh = (float(v) for v in row[:4])
        side = max(bw, bh) * (1 + 2 * margin)
        cx, cy = x + bw / 2, y + bh / 2
        x1, y1 = int(max(0, cx - side / 2)), int(max(0, cy - side / 2))
        x2, y2 = int(min(w, cx + side / 2)), int(min(h, cy + side / 2))
        crop = bgr[y1:y2, x1:x2]
        return cv2.resize(crop, (self.CROP_SIZE, self.CROP_SIZE), interpolation=cv2.INTER_LINEAR)

    def __call__(self, bgr: np.ndarray, out: FrameAnalysis, want_embedding: bool = False) -> None:
        faces = self.detect(bgr)
        out.faces = len(faces)
        if not faces:
            return
        main = faces[0]
        x, y, bw, bh = (int(v) for v in main[:4])
        out.face_box = (x, y, x + bw, y + bh)
        if want_embedding:
            out.embedding = self.embed(bgr, main)

        res = None
        for margin in self.CROP_MARGINS:
            crop = np.ascontiguousarray(cv2.cvtColor(self._crop(bgr, main, margin), cv2.COLOR_BGR2RGB))
            res = self.landmarker.detect(self._mp_image(image_format=self._fmt, data=crop))
            if res.face_landmarks:
                break
        if not res or not res.face_landmarks:
            return
        if res.facial_transformation_matrixes:
            out.yaw, out.pitch = _head_angles(np.asarray(res.facial_transformation_matrixes[0]))
        if res.face_blendshapes:
            bs = {c.category_name: c.score for c in res.face_blendshapes[0]}
            out.gaze = (
                bs.get("eyeLookOutRight", 0)
                + bs.get("eyeLookInLeft", 0)
                - bs.get("eyeLookOutLeft", 0)
                - bs.get("eyeLookInRight", 0)
            ) / 2
            out.gaze_y = (
                bs.get("eyeLookDownLeft", 0)
                + bs.get("eyeLookDownRight", 0)
                - bs.get("eyeLookUpLeft", 0)
                - bs.get("eyeLookUpRight", 0)
            ) / 2
            out.blink = (bs.get("eyeBlinkLeft", 0) + bs.get("eyeBlinkRight", 0)) / 2
            out.jaw_open = bs.get("jawOpen", 0.0)


class FrameAnalyzer:
    def __init__(self, model_dir: Path, threads: int = 1):
        self.objects = YoloxDetector(model_dir / "yolox_tiny.onnx", threads=threads)
        self.faces = FaceAnalyzer(
            model_dir / "face_landmarker.task",
            model_dir / "face_detection_yunet_2023mar.onnx",
            model_dir / "face_recognition_sface_2021dec.onnx",
        )

    def analyze(self, bgr: np.ndarray, detect_objects: bool = True, want_embedding: bool = False) -> FrameAnalysis:
        h, w = bgr.shape[:2]
        out = FrameAnalysis(width=w, height=h)
        out.brightness = float(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).mean())
        self.faces(bgr, out, want_embedding=want_embedding)
        if detect_objects:
            out.objects = self.objects(bgr)
            out.persons = sum(1 for o in out.objects if o.label == "person")
        return out


def match_score(a: list[float] | None, b: list[float] | None) -> float | None:
    """Cosine similarity of two L2-normalised SFace embeddings."""
    if not a or not b or len(a) != len(b):
        return None
    return round(float(np.dot(np.asarray(a, np.float32), np.asarray(b, np.float32))), 3)

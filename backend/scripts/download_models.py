"""Download the AI proctoring models into backend/models/ (run once locally; Docker does it at build time).

python scripts/download_models.py
"""

from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path

MODELS = {
    # Apache-2.0 — https://github.com/Megvii-BaseDetection/YOLOX
    "yolox_tiny.onnx": "https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.onnx",
    # MIT — https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
    "face_detection_yunet_2023mar.onnx": "https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx",
    # Apache-2.0 — https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface
    "face_recognition_sface_2021dec.onnx": "https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec.onnx",
    # Apache-2.0 — https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker
    "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
}


def main() -> int:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "models"
    target.mkdir(parents=True, exist_ok=True)
    for name, url in MODELS.items():
        path = target / name
        if path.exists() and path.stat().st_size > 0:
            print(f"ok   {name} already present")
            continue
        print(f"get  {name}")
        tmp = path.with_suffix(path.suffix + ".part")
        urllib.request.urlretrieve(url, tmp)
        tmp.replace(path)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()[:16]
        print(f"ok   {name} ({path.stat().st_size / 1e6:.1f} MB, sha256 {digest}...)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

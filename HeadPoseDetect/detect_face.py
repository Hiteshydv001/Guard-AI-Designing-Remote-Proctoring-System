import mediapipe as mp
import cv2

mp_face_detection = mp.solutions.face_detection.FaceDetection()

def detect_face(frame):
    results = mp_face_detection.process(frame)
    return bool(results.detections)

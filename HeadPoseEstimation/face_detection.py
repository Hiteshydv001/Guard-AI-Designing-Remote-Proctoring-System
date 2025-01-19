"""
face_detection.py
-----------------
This module contains a class for detecting faces in an image frame using the YOLO model.
Classes:
    Face_Detector: A class used to detect faces in an image frame using the YOLO model.
    Attributes
Methods:
    detect(frame): Detects faces in the given image frame.
"""


import cv2
from ultralytics import YOLO
import os

class Face_Detector:
    def __init__(self):
        module_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(module_dir, "yolov11n-face.pt") 
        self.model = YOLO(model_path)

    def detect(self, frame):
        """
        Detects faces in the given image frame.
        """
        results = self.model(frame)

        boxes = results[0].boxes
        for box in boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)

        return len(boxes)
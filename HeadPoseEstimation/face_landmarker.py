"""
This module provides a class for detecting facial landmarks using MediaPipe.
Classes:
    Face_Landmarker: A class for detecting facial landmarks in an image frame.
Methods:
    __init__(self):
        Initializes the Face_Landmarker with the necessary options and model.
    get_landmarks(self, frame):
        Detects facial landmarks in the given image frame.
"""


import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import cv2
import os

class Face_Landmarker:
    def __init__(self):
        module_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(module_dir, "face_landmarker.task") 

        self.base_option = python.BaseOptions(model_asset_path=model_path) 
        print(self.base_option)
        self.options = vision.FaceLandmarkerOptions(
            base_options = self.base_option,
            output_face_blendshapes = True,
            output_facial_transformation_matrixes = True,
            num_faces = 1
        )

        self.detector = vision.FaceLandmarker.create_from_options(self.options)

    def get_landmarks(self, frame):
        """
        Detects facial landmarks in the given image frame.
        """
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb_frame
        )

        try:
            result = self.detector.detect(mp_image)
        except Exception as e:
            print("Error: ", e)
            return None
        
        if not result.face_landmarks:
            return None
        
        landmarks = result.face_landmarks[0]
        if not landmarks: return None
        face_lms = []
        for idx, lm in enumerate(landmarks):
            if idx in [1, 9, 57, 130, 287, 359]:
                face_lms.append(landmarks[idx])
        
        return face_lms

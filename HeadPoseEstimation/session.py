"""
This module implements a remote proctoring system using head pose estimation and anomaly detection. This is created like a framework to ease out the integration.
Classes:
    Session: Manages the proctoring session, including face detection, head pose estimation, and anomaly detection.
Functions:
    Session.__init__: Initializes the session with necessary components.
    Session.process_frame: For processing frame: detecting faces, estimating head pose, and checking for anomalies.
    Session.calibrate: Calibrates the system by setting the ideal head pose based on user input.
    Session.save_logs: To save the logs to a file
Usage:
    To use this module, create an instance of the Session class, call the calibrate method to set the ideal head pose, and then call the process method for every frame. At last call save_logs method to save the collected anomalies.
"""


from .face_detection import Face_Detector
from .face_landmarker import Face_Landmarker
from .head_pose_estimation import Pose_Estimation
from .anomaly_detection import Anomaly_Detection, LOG_STORAGE_DIR

import cv2
from ultralytics import YOLO
import json
from datetime import datetime
import time

class Session:
    """
    Manages the proctoring session, including face detection, head pose estimation, and anomaly detection.
    """
    def __init__(self):
        self.face_detector = Face_Detector()
        self.face_landmarker = Face_Landmarker()
        self.pose_estimator = Pose_Estimation()
        self.anomaly_detector = Anomaly_Detection()     # you can customize anomaly detection parameters as per preference, just hover it
    
        self.ideal_pitch = 0
        self.ideal_yaw = 0

    def process_frame(self, frame):
        """
        For processing frame: detecting faces, estimating head pose, and checking for anomalies.
        """
        
        count_faces = self.face_detector.detect(frame)
            
        self.anomaly_detector.handle_multiple_faces(count_faces, frame)

        if count_faces == 1:
            landmarks = self.face_landmarker.get_landmarks(frame)
            if landmarks is None: return

            pitch, yaw, roll = self.pose_estimator.get_head_pose(landmarks, frame.shape)
            pitch, yaw = pitch - self.ideal_pitch, yaw - self.ideal_yaw

            cv2.putText(frame, f"Pitch: {int(pitch)}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(frame, f"Yaw: {int(yaw)}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(frame, f"Roll: {int(roll)}", (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

            self.anomaly_detector.check_sus(pitch, yaw, frame)


    def calibrate(self, frame):
        """
        Calibrates the Pitch and Yaw by setting the ideal head pose based on user input.
        """
        
        count_faces = self.face_detector.detect(frame)
        if count_faces == 0:
            print("No face detected, please try again!")
            self.calibrate()
            return
        if count_faces > 1:
            print("Multiple face detected, please try again!")
            self.calibrate()
            return
        
        landmarks = self.face_landmarker.get_landmarks(frame)
        self.ideal_pitch, self.ideal_yaw, _ = self.pose_estimator.get_head_pose(landmarks, frame.shape)
    
    def save_logs(self):
        """
        To save the logs to a file
        """
        with open(f"{LOG_STORAGE_DIR}/logs.json", 'w') as f:
            json.dump(self.anomaly_detector.logs, f)
        self.anomaly_detector.logs = None
    
    def reset_session(self):
        self.anomaly_detector = Anomaly_Detection()
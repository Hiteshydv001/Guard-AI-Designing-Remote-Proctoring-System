# press 'q' to stop protoring

"""
This module implements a remote proctoring system using head pose estimation and anomaly detection.
Classes:
    Session: Manages the proctoring session, including face detection, head pose estimation, and anomaly detection.
Functions:
    Session.__init__: Initializes the session with necessary components.
    Session.start: Starts the proctoring session, capturing frames from the webcam, detecting faces, estimating head pose, and checking for anomalies.
    Session.calibrate: Calibrates the system by setting the ideal head pose based on user input.
Usage:
    To use this module, create an instance of the Session class, call the calibrate method to set the ideal head pose, and then call the start method to begin the proctoring session.
"""


from face_detection import Face_Detector
from face_landmarker import Face_Landmarker
from head_pose_estimation import Pose_Estimation
from anomaly_detection import Anomaly_Detection
from anomaly_detection import LOG_STORAGE_DIR

import cv2
from ultralytics import YOLO
import json
from datetime import datetime
import time

class Session:
    def __init__(self):
        self.face_detector = Face_Detector()
        self.face_landmarker = Face_Landmarker()
        self.pose_estimator = Pose_Estimation()
        self.anomaly_detector = Anomaly_Detection()     # you can customize anomaly detection parameters as per preference
        self.cam = cv2.VideoCapture(0)

        self.ideal_pitch = 0
        self.ideal_yaw = 0

    def start(self):
        """
        Starts the proctoring session, capturing frames from the webcam, detecting faces, estimating head pose, and checking for anomalies.
        """

        while True:
            _, frame = self.cam.read()
            count_faces = self.face_detector.detect(frame)
            
            self.anomaly_detector.handle_multiple_faces(count_faces, frame)

            if count_faces == 1:
                landmarks = self.face_landmarker.get_landmarks(frame)
                if landmarks is None: continue

                pitch, yaw, roll = self.pose_estimator.get_head_pose(landmarks, frame.shape)
                pitch, yaw = pitch - self.ideal_pitch, yaw - self.ideal_yaw

                cv2.putText(frame, f"Pitch: {int(pitch)}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                cv2.putText(frame, f"Yaw: {int(yaw)}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                cv2.putText(frame, f"Roll: {int(roll)}", (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

                self.anomaly_detector.check_sus(pitch, yaw, frame)

            cv2.imshow("Protoring Frame", frame)
            # time.sleep(0.1)     # a delay is added so that the system gets time to free up the memory acquired by the process
            if cv2.waitKey(1) & 0xFF == ord('q'): break

        self.cam.release()
        cv2.destroyAllWindows()

        with open(f"{LOG_STORAGE_DIR}/logs.json", 'w') as f:
            json.dump(self.anomaly_detector.logs, f)

    def calibrate(self):
        """
        Calibrates the Pitch and Yaw by setting the ideal head pose based on user input.
        """
        
        while True:
            _, frame = self.cam.read()
            txt1 = "Please sit in a position, you are comfortable in and position your head"
            txt2 = "in a ideal state which you will be possing through out this protoring."
            txt3 = "Look at the center of the screen. Press 'k' when you are ready!"

            cv2.putText(frame, txt1, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (133, 199, 125), 1)
            cv2.putText(frame, txt2, (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (133, 199, 125), 1)
            cv2.putText(frame, txt3, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (133, 199, 125), 1)
            
            cv2.imshow("Protoring Frame", frame)
            if cv2.waitKey(1) & 0xFF == ord('k'): break
        
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

if __name__ == "__main__":
    session1 = Session()
    session1.calibrate()
    session1.start()
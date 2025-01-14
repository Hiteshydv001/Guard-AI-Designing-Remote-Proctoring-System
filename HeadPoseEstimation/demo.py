"""
This file is for demo purpose, to test the development version of this feature. Do not run this directly. If you want to try it, do following changes first:

replace (in session.py):
from .face_detection import Face_Detector
from .face_landmarker import Face_Landmarker
from .head_pose_estimation import Pose_Estimation
from .anomaly_detection import Anomaly_Detection, LOG_STORAGE_DIR

with:
from face_detection import Face_Detector
from face_landmarker import Face_Landmarker
from head_pose_estimation import Pose_Estimation
from anomaly_detection import Anomaly_Detection, LOG_STORAGE_DIR

and later on revert this to use them as modules outside of this directory (otherwise will face relative path issue in imports)
"""

from session import Session
import cv2

# create a session object
session1 = Session()
cam = cv2.VideoCapture(0)

# capturing the frame needed for calibration
while True:
    _, frame = cam.read()
    txt1 = "Please sit in a position, you are comfortable in and position your head"
    txt2 = "in a ideal state which you will be possing through out this protoring."
    txt3 = "Look at the center of the screen. Press 'k' when you are ready!"

    cv2.putText(frame, txt1, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (133, 199, 125), 1)
    cv2.putText(frame, txt2, (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (133, 199, 125), 1)
    cv2.putText(frame, txt3, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (133, 199, 125), 1)

    cv2.imshow("Protoring Frame", frame)
    if cv2.waitKey(1) & 0xFF == ord('k'): break

# send the frame to calibrate the system
session1.calibrate(frame)

# proctering
while True:
    _, frame = cam.read()

    session1.process_frame(frame)

    cv2.imshow("Protoring Frame", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'): break

cam.release()
cv2.destroyAllWindows()
session1.save_logs()
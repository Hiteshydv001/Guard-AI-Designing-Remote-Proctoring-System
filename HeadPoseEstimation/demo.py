"""
This file is for demo purpose, to test the development version of this feature.
"""

from session import Session
import cv2


session1 = Session()
session1.calibrate()

cam = cv2.VideoCapture(0)
while True:
        _, frame = cam.read()
        
        session1.process_frame(frame)

        cv2.imshow("Protoring Frame", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'): break

cam.release()
cv2.destroyAllWindows()
session1.save_logs()
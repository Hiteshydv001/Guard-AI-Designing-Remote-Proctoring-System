"""
face_detection.py
-----------------
This module contains a class for detecting faces in an image frame using the YOLO model.
Classes:
    Face_Detector: A class used to detect faces in an image frame using the YOLO model.
    Attributes:
        model: The YOLO model used for face detection.
    Methods:
        detect(frame): Detects faces in the given image frame and returns their bounding boxes.
"""

import cv2
import os
import logging
from ultralytics import YOLO


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

class Face_Detector:
    def __init__(self):
        """
        Initializes the Face_Detector class by loading the YOLO model for face detection.
        """
   
        module_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(module_dir, "yolov11n-face.pt")
     
        if not os.path.exists(model_path):
            logging.error(f"Model file not found: {model_path}")
            raise FileNotFoundError(f"Model file not found: {model_path}")
        
        try:
            self.model = YOLO(model_path)
            logging.info("Model loaded successfully.")
        except Exception as e:
            logging.error(f"Failed to load the model: {e}")
            raise

    def detect(self, frame):
        """
        Detects faces in the given image frame.
        
        :param frame: The input image frame to process.
        :return: A list of tuples containing the bounding box coordinates of detected faces.
        """
    
        if frame is None or frame.size == 0:
            logging.error("Empty or invalid image frame provided.")
            raise ValueError("Empty or invalid image frame provided.")

        logging.info("Starting face detection.")

        try:
         
            results = self.model(frame)
            boxes = results[0].boxes 

           
            if len(boxes) == 0:
                logging.info("No faces detected.")
            
           
            detected_faces = []
            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
                detected_faces.append((x1, y1, x2, y2))

           
            logging.info(f"Detected {len(boxes)} face(s).")
            return detected_faces

        except Exception as e:
            logging.error(f"An error occurred during face detection: {e}")
            raise


if __name__ == "__main__":
 
    face_detector = Face_Detector()

 
    frame = cv2.imread("test_image.jpg")
    
    if frame is None:
        logging.error("Failed to load image.")
    else:
       
        detected_faces = face_detector.detect(frame)

       
        if detected_faces:
            for i, (x1, y1, x2, y2) in enumerate(detected_faces):
                logging.info(f"Face {i + 1}: ({x1}, {y1}), ({x2}, {y2})")
        
      
        cv2.imshow("Detected Faces", frame)
        cv2.waitKey(0)
        cv2.destroyAllWindows()

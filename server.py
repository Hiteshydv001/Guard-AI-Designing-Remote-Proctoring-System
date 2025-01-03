import os
from flask import Flask, render_template, jsonify
import cv2
import mediapipe as mp
import numpy as np
import base64
from io import BytesIO

app = Flask(__name__)

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.5, min_tracking_confidence=0.5)

UPPER_LIP = [13, 14]
LOWER_LIP = [17, 18]

def get_lip_distance(landmarks, upper_lip_idx, lower_lip_idx, frame_w, frame_h):
    upper_lip_points = np.array([(landmarks[i].x * frame_w, landmarks[i].y * frame_h) for i in upper_lip_idx])
    lower_lip_points = np.array([(landmarks[i].x * frame_w, landmarks[i].y * frame_h) for i in lower_lip_idx])
    return np.linalg.norm(np.mean(upper_lip_points, axis=0) - np.mean(lower_lip_points, axis=0))

THRESHOLD = 2.0

def adjust_brightness(image, brightness_factor=1.3):
    bright_image = cv2.convertScaleAbs(image, alpha=brightness_factor, beta=0)
    return bright_image

def detect_lips():
    cap = cv2.VideoCapture(0)
    previous_distance = 0
    status = "Not Speaking"
    
    if not cap.isOpened():
        raise Exception("Could not open video device")

    ret, frame = cap.read()
    if not ret:
        cap.release()
        raise Exception("Failed to capture image")

    frame = cv2.flip(frame, 1) 
    h, w, _ = frame.shape
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = face_mesh.process(rgb_frame)

    if result.multi_face_landmarks:
        for landmarks in result.multi_face_landmarks:
            distance = get_lip_distance(landmarks.landmark, UPPER_LIP, LOWER_LIP, w, h)
            if abs(distance - previous_distance) > THRESHOLD:
                status = "Speaking"
            previous_distance = distance

            for idx in UPPER_LIP + LOWER_LIP:
                x = int(landmarks.landmark[idx].x * w)
                y = int(landmarks.landmark[idx].y * h)
                cv2.circle(frame, (x, y), 2, (0, 255, 0), -1)

    cv2.putText(frame, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)


    bright_frame = adjust_brightness(frame, brightness_factor=30)

    _, img_encoded = cv2.imencode('.png', bright_frame)  
    img_bytes = img_encoded.tobytes()  
    img_str = base64.b64encode(img_bytes).decode("utf-8")  

    cap.release()
    return img_str


@app.route('/detect_lips', methods=['GET'])
def detect_lips_route():
    try:
        
        img_str = detect_lips()
        
        return jsonify({"image": img_str})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/')
def index():
    return render_template('pic.html')

if __name__ == '__main__':
    app.run(debug=True)

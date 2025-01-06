from flask import Flask, Response
import cv2
import mediapipe as mp
import numpy as np
from GazeTracking.gaze_tracking import GazeTracking

app = Flask(__name__)

# Initialize MediaPipe Face Detection
mp_face_detection = mp.solutions.face_detection
mp_drawing = mp.solutions.drawing_utils
face_detection = mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5)

# Initialize MediaPipe Face Mesh for lip detection
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# Define upper and lower lip landmarks for distance calculation
UPPER_LIP = [13, 14]
LOWER_LIP = [17, 18]

# Define a threshold for detecting speaking
THRESHOLD = 2.0
previous_distance = 0

# Initialize GazeTracking
gaze = GazeTracking()

# Initialize webcam
cap = cv2.VideoCapture(0)

# Function to calculate lip distance
def get_lip_distance(landmarks, upper_lip_idx, lower_lip_idx, frame_w, frame_h):
    upper_lip_points = np.array([(landmarks[i].x * frame_w, landmarks[i].y * frame_h) for i in upper_lip_idx])
    lower_lip_points = np.array([(landmarks[i].x * frame_w, landmarks[i].y * frame_h) for i in lower_lip_idx])
    return np.linalg.norm(np.mean(upper_lip_points, axis=0) - np.mean(lower_lip_points, axis=0))

# Generate video frames for Flask
def generate_frames():
    global previous_distance

    while True:
        # Capture frame from webcam
        ret, frame = cap.read()
        if not ret:
            break

        # Convert the frame to RGB (MediaPipe requires RGB input)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Process the frame with MediaPipe Face Detection
        results = face_detection.process(rgb_frame)

        # Draw detections and count the number of faces
        face_count = 0
        if results.detections:
            face_count = len(results.detections)
            for detection in results.detections:
                mp_drawing.draw_detection(frame, detection)

        # Analyze the frame with GazeTracking
        gaze.refresh(frame)
        frame = gaze.annotated_frame()

        # Add gaze direction text
        gaze_text = ""
        if gaze.is_blinking():
            gaze_text = "Blinking"
        elif gaze.is_right():
            gaze_text = "Looking right"
        elif gaze.is_left():
            gaze_text = "Looking left"
        elif gaze.is_center():
            gaze_text = "Looking center"

        cv2.putText(frame, gaze_text, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 1, (147, 58, 31), 2)

        # Add pupil coordinates
        left_pupil = gaze.pupil_left_coords()
        right_pupil = gaze.pupil_right_coords()
        cv2.putText(frame, f"Left pupil: {str(left_pupil)}", (10, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (147, 58, 31), 1)
        cv2.putText(frame, f"Right pupil: {str(right_pupil)}", (10, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (147, 58, 31), 1)

        # Add face count text
        face_count_text = f"Faces detected: {face_count}"
        cv2.putText(frame, face_count_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        # Lip detection
        status = "Not Speaking"
        h, w, _ = frame.shape
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

        # Add lip movement status text
        cv2.putText(frame, status, (10, 180), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        # Encode frame as JPEG and yield it
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.run(debug=True)

from flask import Flask, Response, redirect, render_template, request, jsonify
import cv2
import mediapipe as mp
import numpy as np
from GazeTracking.gaze_tracking import GazeTracking
from HeadPoseEstimation.session import Session
import base64

app = Flask(__name__)
cap = cv2.VideoCapture(0)

# cap = cv2.VideoCapture(0)   # Initialize webcam
gaze = GazeTracking()       # Initialize GazeTracking
session = Session()         # initializing a session


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

def get_lip_distance(landmarks, upper_lip_idx, lower_lip_idx, frame_w, frame_h):
    """Function to calculate lip distance"""
    upper_lip_points = np.array([(landmarks[i].x * frame_w, landmarks[i].y * frame_h) for i in upper_lip_idx])
    lower_lip_points = np.array([(landmarks[i].x * frame_w, landmarks[i].y * frame_h) for i in lower_lip_idx])
    return np.linalg.norm(np.mean(upper_lip_points, axis=0) - np.mean(lower_lip_points, axis=0))

def generate_frames():
    """Generates and processes video frames for proctering purpose"""
    global previous_distance

    while True:
        # Capture frame from webcam
        ret, frame = cap.read()
        if not ret:
            break
        
        # this processes the frame for head pose estimation and anomaly detection
        session.process_frame(frame)

        # rest of the code is for gaze tracking
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)      # Convert the frame to RGB (MediaPipe requires RGB input)
        results = face_detection.process(rgb_frame)             # Process the frame with MediaPipe Face Detection

        # Draw detections and count the number of faces
        face_count = 0
        if results.detections:
            face_count = len(results.detections)

        gaze.refresh(frame)     # Analyze the frame with GazeTracking
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

        cv2.putText(frame, gaze_text, (10, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (147, 58, 31), 2)

        # Add pupil coordinates
        left_pupil = gaze.pupil_left_coords()
        right_pupil = gaze.pupil_right_coords()
        cv2.putText(frame, f"Left pupil: {str(left_pupil)}", (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (147, 58, 31), 2)
        cv2.putText(frame, f"Right pupil: {str(right_pupil)}", (10, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (147, 58, 31), 2)

        # Add face count text
        face_count_text = f"Faces detected: {face_count}"
        cv2.putText(frame, face_count_text, (10, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

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
        cv2.putText(frame, status, (10, 210), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        # Encode frame as JPEG and yield it
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')


@app.route("/calibration_page")
def calibration_page():
    """Render the calibrate.html page on website"""
    return render_template("calibrate.html")

def calibration_stream():
    """Streaming the frames to be sent"""
    while True:
        _, frame = cap.read()
        txt1 = "Please sit in a position, you are comfortable in and position your head"
        txt2 = "in a ideal state which you will be possing through out this protoring."
        txt3 = "Look at the center of the screen. Press 'k' when you are ready!"

        cv2.putText(frame, txt1, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (133, 199, 125), 1)
        cv2.putText(frame, txt2, (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (133, 199, 125), 1)
        cv2.putText(frame, txt3, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (133, 199, 125), 1)

        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route("/calibrate_stream", methods=['GET'])
def calibration():
    """Send the video feed to calibrate.html"""
    return Response(calibration_stream(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route("/get_calibration_frame", methods=['POST'])
def get_calibration_frame():
    """Receiving the frame from calibrate.html for calibrating the system for anomaly detection"""
    if request.method == 'POST':
        image_data = request.json.get('image')
        if image_data:
            if ',' in image_data:
                image_data = image_data.split(",")[1]
            image_bytes = base64.b64decode(image_data)
            np_arr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            session.calibrate(img)
            
            return jsonify({"status": "success"})
        else:
            return jsonify({"status": "failed"})
    
    return jsonify({"status": "failed", "message": "Invalid request method"})

@app.route('/proctering_screen')
def proctoring_screen():
    """Renders the proctering_screen.html on website"""
    print("hello")
    return render_template("proctering_screen.html")

@app.route('/candidate_stream')
def candidate_stream():
    """Sends the proccessed video feed to proctering_screen.html"""
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/stop_proctering')
def stop_proctering():
    """Stoping the proctering"""
    session.save_logs()
    cap.release()
    return render_template("stop_proctering.html")

@app.route("/")
def start():
    global cap
    cap = cv2.VideoCapture(0)
    session.reset_session()
    return render_template("index.html")

if __name__ == '__main__':
    app.run(debug=True)
from flask import Flask, render_template, request
import os
import resend
from flask_cors import CORS
import logging
import cv2
import numpy as np
import mediapipe as mp
import eventlet
from flask_socketio import SocketIO

logging.basicConfig(level=logging.ERROR, format='%(asctime)s %(levelname)s %(message)s')

app = Flask(__name__)
CORS(app, methods=["GET", "POST"])

resend.api_key = os.environ["RESEND_API_KEY"]

socketio = SocketIO(app, cors_allowed_origins="*")

mp_face_mesh = mp.solutions.face_mesh.FaceMesh(refine_landmarks=True)
mp_face_detection = mp.solutions.face_detection.FaceDetection()

@app.route("/contact", methods=["POST"])
def contact():
    try:
        params: resend.Emails.SendParams = {
            "from": "onboarding@resend.dev",
            "to": ["leomirandadev@gmail.com"],
            "subject": f"New message from {request.json['firstName']} {request.json['lastName']} regarding {request.json['subject']}",
            "html": f"<h1><strong>Name:</strong></h1><br />{request.json['firstName']} {request.json['lastName']}<br /><br /><hr /><h1><strong>Email:</strong></h1><br />{request.json['email']}<br /><br /><hr /><h1><strong>Subject:</strong></h1><br />{request.json['subject']}<br /><br /><hr /><h1><strong>Message:</strong></h1><br />{request.json['message']}",
        }
        res = resend.Emails.send(params)
        print("Email sent! Response ID:",res.id)
        return res
    except Exception as e:
        logging.error("An error occurred: %s", str(e))
        return {"error": "An internal error has occurred. Please try again later."}


@app.route("/")
def start():
    return render_template("index.html")

#  WebSocket for real-time AI-based proctoring **
@socketio.on("video_frame")
def handle_video_stream(frame_bytes):
    """Processes video frame for AI-based proctoring."""
    frame = np.frombuffer(frame_bytes, dtype=np.uint8)
    frame = cv2.imdecode(frame, cv2.COLOR_BGR2RGB)
    
    alert = detect_anomalies(frame)
    
    if alert:
        socketio.emit("warning", {"alert": alert})

def detect_anomalies(frame):
    """Detects face, eye blinks, and lip movements."""
    results = mp_face_mesh.process(frame)
    face_results = mp_face_detection.process(frame)

    if not face_results.detections:
        return "Face Not Detected!"

    # TODO: Implement eye blink & lip movement detection properly
    if results.multi_face_landmarks:
        return None  # No suspicious activity detected

    return "Suspicious Activity Detected!"


if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() in ["true", "1", "t"]
    app.run(debug=debug_mode)

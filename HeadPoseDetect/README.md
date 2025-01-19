# Head Tracking Feature for Guard-AI

This project implements a **Head Pose Detection** feature for the Guard-AI proctoring system. It monitors the user's head movements during online exams and raises alerts when the user looks away from the screen, ensuring exam integrity. 

## Features
- Real-time head pose estimation using MediaPipe.
- Alerts when a user looks away from the screen.
- Web interface for video feed display powered by Flask.
- Cross-platform compatibility (works on any system with Python and a webcam).

---

## How It Works
1. Captures the video feed from the webcam.
2. Uses MediaPipe's FaceMesh solution to identify landmarks on the face.
3. Calculates the angle between the eyes to determine head orientation.
4. Displays an alert on the video feed if the user is looking away for more than a threshold angle.

---

## Setup and Installation

### Prerequisites
- Python 3.7+
- A working webcam
- Basic knowledge of Python and Flask

1. Clone the Repository
```bash
git clone https://github.com/<your-username>/Guard-AI.git
cd Guard-AI
2. pip install -r requirements.txt
3. cd Head
python3 head_app.py
4. open your browser and navigate to http://127.0.0.1:5000/

---

## Key Technologies Used

Python: Core programming language.
Flask: Lightweight web framework for creating the interface.
MediaPipe: Real-time machine learning framework for face tracking.
OpenCV: Computer vision library for processing video feeds.




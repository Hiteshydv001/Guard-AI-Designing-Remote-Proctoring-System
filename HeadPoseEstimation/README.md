# Head Pose Estimation

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [How it works](#how-it-works)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Overview

A real-time head pose estimation system for the proctoring platform to monitor candidates' focus (e.g., looking left, right, up, or down) beyond defined thresholds. and detect suspicious behavior, such as looking away from the screen, frequently turning their heads, no face detected or multiple face detected. This system generates alerts for the proctor when anomalies are detected. Also, events are logged for review, with timestamps and snapshots of the candidate’s head position.

## Features

- Head pose estimation (with web cam) for detecting deviations in focus (e.g., looking left, right, up, or down) beyond defined thresholds.
- Anomaly Detection for: frequent head movements, prolonged looking away from the screen, no face detected, multiple face detected
- Set configurable thresholds for generating alerts.
- Logging detected events for review, with timestamps and snapshots of the candidate’s head position
- Calibration of anomaly detection configuration with respect to alignment of user's face with camera

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/Hiteshydv001/Guard-AI-Designing-Remote-Proctoring-System.git
    ```
2. Navigate to the project directory:
    ```bash
    cd HeadPoseEstimation
    ```
3. Create a new virtual environment:
    ```bash
    conda create -p ./venv python=3.12
    ```
4. Activate the virtual environment:
    ```bash
    conda activate ./venv
    ```
5. To install the necessary dependencies, run the following command:
    ```bash
    pip install -r requirements.txt
    ```

## Usage

To run the head pose estimation feature, use the following command:

1. To demo this feature:
    ```bash
    python demo.py
    ```

## How it works:

1. We start by creating an object of Session class, which will start a proctered session.
2. After that, we call calibrate for calibration of anomaly detection configuration with respect to alignment of user's face with camera
3. Then we start capturing the frames.
4. For every frame captured we call process_frame method to process the frames, understand the head pose and identify anomalies, if any.
5. Once we are done with proctoring, we call save_logs method to save the anomalies which were captured during the session, and maintain a record of candidates activities.

## Project Structure

```
.
├── Suspicious Activity
│   └── User1
│       └── Date
│           └── Time
│               ├── Captures
│               │   ├── Frequest Head Movement
│               │   ├── More than 1 face
│               │   ├── No face
│               │   └── Prolonged Looking Away
│               └── logs.json
├── anomaly_detection.py
├── demo.py
├── face_detection.py
├── face_landmarker.py
├── face_landmarker.task
├── head_pose_estimation.py
├── README.md
├── requirements.txt
├── session.py
└── yolov11n-face.pt
```

## Contributing

We welcome contributions to improve the Head Pose Estimation and anomaly detection module. Please follow the guidelines in the `CONTRIBUTING.md` file.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more details.

## Contact

For any questions or issues, please contact the project maintainers.

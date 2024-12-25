# AI-Based Proctoring System for Secure Assessments

## Overview
This repository contains an innovative AI-driven proctoring system designed to ensure fairness, security, and accuracy in remote skill assessments. This project addresses the challenges of traditional proctoring methods by leveraging cutting-edge AI technologies.

## Problem Statement
Traditional proctoring methods struggle with maintaining the integrity of remote assessments. Challenges include ensuring:
- **Fairness** in evaluation.
- **Security** against unauthorized assistance.
- **Accuracy** in detecting suspicious behavior.

The AI-Based Proctoring System addresses these issues by employing advanced monitoring techniques and machine learning algorithms.

## Features and Technologies

### 1. Eyeball and Lips Movement Detection
- **Technology:** OpenCV, Dlib, or MediaPipe
- **Functionality:** Tracks eye and lip movements to prevent external communication and distractions.

### 2. Facial Emotion Recognition
- **Technology:** TensorFlow, Keras, or PyTorch
- **Functionality:** Detects emotional states and stress levels in real-time using convolutional neural networks.

### 3. Screen and Audio Monitoring
- **Screen Monitoring:** Tracks screen activity with PyAutoGUI and Pynput to enforce a full-window test mode.
- **Audio Monitoring:** Analyzes real-time sound using PyAudio and SpeechRecognition to detect external conversations or background noise.

### 4. Device and Port Checks
- **Technology:** Psutil library and network scanning tools.
- **Functionality:** Monitors active ports, detects unauthorized device usage, and flags anomalies.

### 5. Real-Time Alerts
- **Technology:** Node.js or Flask backend.
- **Functionality:** Event-driven anomaly detection triggers alerts based on suspicious behavior.

## Architecture & System Design

1. **Eyeball and Lips Movement Detection:**
   - Pre-trained and custom models for detecting unusual movements.
2. **Facial Emotion Recognition:**
   - Deep learning models trained on datasets like FER-2013.
3. **Audio Monitoring:**
   - Speech-to-text analysis and sound classification.
4. **Device and Network Monitoring:**
   - Signal pattern recognition algorithms to detect unauthorized devices.

## Future Improvements
- **Behavioral Analysis:** Enhanced models to detect typing cadence and body posture.
- **Voice and Audio Analysis:** NLP techniques for sentiment and conversational analysis.
- **AR Integration:** 360-degree monitoring using AR/VR.
- **Blockchain:** Tamper-proof data logs to ensure session integrity.

## Getting Started

### Prerequisites
- Python 3.x
- TensorFlow, OpenCV, PyAudio, and other required libraries.

## Contributing
Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature-name`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature-name`).
5. Open a pull request.

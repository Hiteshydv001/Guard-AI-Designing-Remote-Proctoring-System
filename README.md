# 🚀 AI-Based Proctoring System for Secure Assessments

## 🌟 Overview
This project introduces a cutting-edge **AI-powered proctoring system** designed to maintain **fairness**, **security**, and **integrity** in remote assessments. By leveraging advanced machine learning techniques, this system redefines how online tests are monitored.

---

## 🧐 Problem Statement
**Traditional proctoring methods** often fail to ensure:
- ✅ **Fairness**: Preventing external aid during tests.
- ✅ **Security**: Detecting unauthorized devices and activities.
- ✅ **Accuracy**: Identifying suspicious behavior effectively.

Our solution addresses these challenges with an **AI-driven approach**, delivering real-time monitoring and anomaly detection.

---

## 🛠️ Key Features & Technologies

### 1️⃣ Eyeball and Lips Movement Detection
- **🔧 Technology**: OpenCV, Dlib, MediaPipe
- **📊 Functionality**: Detects eye and lip movements to curb external communication.

### 2️⃣ Facial Emotion Recognition
- **🔧 Technology**: TensorFlow, Keras, PyTorch
- **📊 Functionality**: Monitors emotional states (e.g., stress or confusion) using deep learning models.

### 3️⃣ Screen and Audio Monitoring
- **🖥️ Screen Monitoring**: Tracks screen activity with PyAutoGUI and Pynput.
- **🎙️ Audio Monitoring**: Uses PyAudio and SpeechRecognition to detect conversations or background noise.

### 4️⃣ Device and Port Checks
- **🔧 Technology**: Psutil library and network scanning tools.
- **📊 Functionality**: Identifies unauthorized devices or activities and flags anomalies.

### 5️⃣ Real-Time Alerts
- **🔧 Technology**: Node.js or Flask backend.
- **📊 Functionality**: Sends event-driven alerts for suspicious behavior.

---

## 🏗️ Architecture & System Design

### **1. Eyeball and Lips Movement Detection**
- Pre-trained models combined with custom algorithms identify abnormal patterns.

### **2. Facial Emotion Recognition**
- CNNs trained on datasets like FER-2013 detect stress, confusion, and other emotions.

### **3. Screen and Audio Monitoring**
- Screen activities are analyzed in real-time.
- Speech-to-text conversion and sound classification ensure a distraction-free test.

### **4. Device and Network Monitoring**
- Wi-Fi/Bluetooth signal scanning detects unauthorized devices.
- Anomaly detection models monitor ports and active network connections.

---

## 🚀 Future Improvements
- **🧠 Behavioral Analysis**: Include typing cadence and posture detection.
- **🗣️ Advanced Audio Analysis**: Leverage NLP to detect conversational cues.
- **🌐 360-Degree Monitoring**: Integrate AR/VR for complete environment oversight.
- **🔒 Blockchain**: Implement tamper-proof logs for enhanced data integrity.

---

## 🛠️ Getting Started

### 📋 Prerequisites
- **Python 3.x**
- Libraries: TensorFlow, OpenCV, PyAudio, and other dependencies.

### 🚦 Steps to Run
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-repo/ai-proctoring.git
   ```
2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Run the Application**:
   ```bash
   python main.py
   ```

---

## 🤝 Contributing
We welcome your contributions to improve this project!  
Follow these steps to get involved:
1. Fork this repository.
2. Create a new branch:
   ```bash
   git checkout -b feature-name
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your message"
   ```
4. Push to the branch:
   ```bash
   git push origin feature-name
   ```
5. Submit a pull request for review.

---

🎉 **Join us in shaping the future of secure assessments!**

# Guard AI - Exam Monitoring System

## Features
✅ Logs **Login & Logout timestamps**  
✅ Detects **User Inactivity** (warns after 5 seconds)  
✅ Generates **Final Exam Session Summary**  

## Installation
1. Clone this repo: git clone https://github.com/yourrepo/guard-ai cd guard-ai
2. Install dependencies: pip install -r requirements.txt

## Usage
- **Start the exam session:**  
python main.py

- **View exam summary:**  
python summary.py

## File Structure
GuardAI/
│── main.py                # Main script to run the exam session
│── summary.py             # Script to generate and display session summary
│── logs/
│   ├── exam_session_log.csv  # Stores login/logout timestamps and inactivity data
│── requirements.txt       # Dependencies to install (pandas, keyboard, mouse)
│── README.md              # Project documentation




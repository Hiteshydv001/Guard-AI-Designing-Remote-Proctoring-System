"""
Anomaly Detection for Remote Proctoring System
This module provides functionality to detect suspicious activities during a remote proctoring session.
It includes detection for prolonged looking away from the screen, frequent head movements, and multiple faces in the frame.
Classes:
    Anomaly_Detection: A class to handle the detection of various anomalies during a proctoring session.
Methods:
    __init__(self, prolonged_time_thr=2, valid_head_mov_time_thr=0.8, freq_head_mov_time_thr=10, head_mov_count_thr=4, pitch_range=(-15, 7), yaw_range=(-25, 20)):
        Initializes the Anomaly_Detection class with the given thresholds and ranges.
    check_sus(self, pitch, yaw, frame):
        Checks for suspicious activities based on head pose (pitch and yaw) and updates logs and screenshots accordingly.
    handle_multiple_faces(self, count_faces, frame):
        Handles detection of multiple faces or no face in the frame and updates logs and screenshots accordingly.
    save_screenshot(frame, reason, index):
        Saves a screenshot of the user's suspicious activity with the given reason and index.
Attributes:
    suspicious_movements (dict): A dictionary to keep track of different types of suspicious movements.
    head_mov_count (int): Counter for head movements.
    logs (dict): A dictionary to store logs of detected anomalies.
    index (int): Index for anomalies occured.
    away_start_time (float): Timestamp when the user starts looking away.
    valid_head_mov_start_time (float): Timestamp when a valid head movement starts to get tracked.
    freq_head_mov_start_time (float): Timestamp when frequent head movements start to get tracked.
    prolonged_time_thr (float): Threshold for prolonged looking away time in seconds.
    valid_head_mov_time_thr (float): Threshold for valid head movement time in seconds.
    freq_head_mov_time_thr (float): Threshold for frequent head movement time in seconds.
    head_mov_count_thr (int): Minimum head movements to trigger suspicion.
    mult_face_start_time (float): Timestamp to start when multiple faces or no face is detected.
    pitch_range (tuple): Range of valid pitch values.
    yaw_range (tuple): Range of valid yaw values.
"""


import os
from datetime import datetime
import time
from PIL import Image
import gc

now = datetime.now().strftime('%Y-%m-%d %H_%M_%S')
date_str = now.split(' ')[0]
time_str = now.split(' ')[1]

CAPTURE_STORAGE_DIR = f"Suspicious Activity/User1/{date_str}/{time_str}/Captures"
LOG_STORAGE_DIR = f"Suspicious Activity/User1/{date_str}/{time_str}"


# for one session
class Anomaly_Detection:
    def __init__(self, prolonged_time_thr=2.5, valid_head_mov_time_thr=0.5, freq_head_mov_time_thr=30, head_mov_count_thr=4, pitch_range = (-15, 7), yaw_range = (-25, 20)):
        """
        Initializes the Anomaly_Detection class with the given thresholds and ranges.\n
        Args:
            prolonged_time_thr (float): Threshold for prolonged looking away time in seconds.
            valid_head_mov_time_thr (float): Threshold for valid head movement time in seconds.
            freq_head_mov_time_thr (float): Threshold for frequent head movement time in seconds.
            head_mov_count_thr (int): Minimum head movements to trigger suspicion.
            pitch_range (tuple): Range of valid pitch values.
            yaw_range (tuple): Range of valid yaw values.
        """

        os.makedirs(CAPTURE_STORAGE_DIR, exist_ok=True)
        os.makedirs(LOG_STORAGE_DIR, exist_ok=True)

        # Initialize variables
        self.suspicious_movements = {"Prolonged looking away from the screen": 0, "Frequent head movements": 0, "More than 1 face": 0, "No face": 0}
        self.head_mov_count = 0
        self.logs = {}
        self.index = 0

        self.away_start_time = None
        self.valid_head_mov_start_time = None
        self.freq_head_mov_start_time = None
        self.prolonged_time_thr = prolonged_time_thr  # seconds
        self.valid_head_mov_time_thr = valid_head_mov_time_thr  # seconds
        self.freq_head_mov_time_thr = freq_head_mov_time_thr
        self.head_mov_count_thr = head_mov_count_thr  # Minimum head movements to trigger suspicion
        self.mult_face_start_time = None

        self.pitch_range = pitch_range      # (from, to)
        self.yaw_range = yaw_range


    def check_sus(self, pitch, yaw, frame):
        """
        Checks for suspicious activities based on head pose (pitch and yaw) and updates logs and screenshots accordingly.
        """

        is_looking_away = pitch < self.pitch_range[0] or pitch > self.pitch_range[1] or yaw < self.yaw_range[0] or yaw > self.yaw_range[1]
        log = ""

        # Prolonged looking away detection
        if is_looking_away:
            if self.away_start_time is None:
                self.capt_frame_prol = frame.copy()
                self.away_start_time = time.time()
        else:
            if self.away_start_time:
                if time.time() - self.away_start_time > self.prolonged_time_thr:
                    log = f"Datetime: {datetime.now()}\n"
                    log += f"Prolonged looking away detected!\n"
                    self.logs[f"Violation_{abs(self.index)}"] = log
                    self.suspicious_movements["Prolonged looking away from the screen"] += 1
                    self.save_screenshot(self.capt_frame_prol, "Prolonged Looking Away", self.index)
                    self.away_start_time = time.time()  # Reset to detect next prolonged event
                    self.index += 1

            self.away_start_time = None  # Reset timer if looking back

        # Frequent head movement detection
        if is_looking_away:
            if self.valid_head_mov_start_time is None:
                self.valid_head_mov_start_time = time.time()
            if self.freq_head_mov_start_time is None:
                self.capt_frame_freq_head_mov = frame.copy()
                self.freq_head_mov_start_time = time.time()

        else:
            if self.valid_head_mov_start_time is not None:
                if time.time() - self.valid_head_mov_start_time > self.valid_head_mov_time_thr:
                    self.head_mov_count += 1

                    if self.head_mov_count >= self.head_mov_count_thr and time.time() - self.freq_head_mov_start_time < self.freq_head_mov_time_thr:
                        log = f"Datetime: {datetime.now()}\n"
                        log += f"Frequent Head Movement detected!\n"
                        self.logs[f"Violation_{abs(self.index)}"] = log
                        # log += f"Total Head Movements: {self.head_mov_count}\n"
                        self.suspicious_movements["Frequent head movements"] += 1
                        self.save_screenshot(self.capt_frame_freq_head_mov, "Frequent Head Movement", self.index)
                        self.index += 1
                        self.head_mov_count = 0
                        self.freq_head_mov_start_time = None

                self.valid_head_mov_start_time = None
                

    def handle_multiple_faces(self, count_faces, frame):
        """
        Handles detection of multiple faces or no face in the frame and updates logs and screenshots accordingly.
        """

        if count_faces == 0 or count_faces > 1:
            if self.mult_face_start_time is None:
                if count_faces > 1:
                    self.multi_face_reason = "More than 1 face"
                else:
                    self.multi_face_reason = "No face"

                self.capt_frame = frame.copy()
                self.mult_face_start_time = time.time()

        else:
            if self.mult_face_start_time is not None:
                reason = self.multi_face_reason
                log = f"Datetime: {datetime.now()}\n{reason + " detected!"}\nDuration: {time.time() - self.mult_face_start_time}"
                index = self.index

                self.suspicious_movements[reason] += 1
                self.save_screenshot(self.capt_frame, reason, self.index)
                
                self.logs[f"Violation_{abs(self.index)}"] = log
                self.index += 1
                self.mult_face_start_time = None

            self.mult_face_start_time = None
        

    @staticmethod
    def save_screenshot(frame, reason, index):
        """
        Save a screenshot of the user's suspicious activity.
        """

        img_dir = os.path.join(CAPTURE_STORAGE_DIR, reason)
        os.makedirs(img_dir, exist_ok=True)
        img = Image.fromarray(frame)
        img.save(f"{img_dir}/capture_{index}.jpg")
        del img
        gc.collect()
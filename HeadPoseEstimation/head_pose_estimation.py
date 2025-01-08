"""
This module provides functionality for head pose estimation using OpenCV.
Classes:
    Pose_Estimation: A class for estimating the head pose from facial landmarks.
Methods:
    __init__(self):
        Initializes the Pose_Estimation class with predefined 3D object points and distortion coefficients.
    get_head_pose(self, face_lms, frame_shape):
        Estimates the head pose given facial landmarks and the shape of the frame.
    get_vectors(self, object_points, image_points, camera_mat, dist_coeffs):
        Computes the rotation and translation vectors using the solvePnP function.
    get_euler_angles(R):
        Converts a rotation matrix to Euler angles (pitch, yaw, roll).
"""


import math
import cv2
import numpy as np

class Pose_Estimation:
    def __init__(self):
        self.object_points = np.array([
                [285, 528, 200],
                [285, 371, 152],
                [197, 574, 128],
                [173, 425, 108],
                [360, 574, 128],
                [391, 425, 108]
            ], dtype=np.float64)
        self.dist_coeffs = np.zeros((1, 4), dtype=np.float32)

    def get_head_pose(self, face_lms, frame_shape):
        """
        Estimates the head pose given facial landmarks and the shape of the frame.\n
        Args:
            face_lms (list): List of facial landmarks with x and y coordinates.
            frame_shape (tuple): Shape of the frame (height, width, channels).
        Returns:
            numpy.ndarray: Euler angles (pitch, yaw, roll) in degrees.
        """
        face_lms = face_lms
        h, w, _ = frame_shape
        image_points = np.array([(lm.x * w, lm.y * h) for lm in face_lms], dtype=np.float32)
        camera_mat = np.array([
                [w, 0, w / 2],  # fx, skew, cx
                [0, w, h / 2],  # fy, skew, cy
                [0, 0, 1]
            ], dtype=np.float32)
        
        rotation_vec, _ = self.get_vectors(self.object_points, image_points, camera_mat, self.dist_coeffs)
        rotation_mat, _ = cv2.Rodrigues(rotation_vec)

        return self.get_euler_angles(rotation_mat)

    def get_vectors(self, object_points, image_points, camera_mat, dist_coeffs):
        """
        Computes the rotation and translation vectors using the solvePnP function.\n
        Args:
            object_points (numpy.ndarray): 3D object points.
            image_points (numpy.ndarray): 2D image points.
            camera_mat (numpy.ndarray): Camera matrix.
            dist_coeffs (numpy.ndarray): Distortion coefficients.
        Returns:
            tuple: Rotation vector and translation vector.
        """
        success, rotation_vec, translation_vec = cv2.solvePnP(
            object_points,
            image_points,
            camera_mat,
            dist_coeffs
        )

        return rotation_vec, translation_vec

    @staticmethod
    def get_euler_angles(R):
        """
        Converts a rotation matrix to Euler angles (pitch, yaw, roll).\n
        Args:
            R (numpy.ndarray): Rotation matrix.
        Returns:
            numpy.ndarray: Euler angles (pitch, yaw, roll) in degrees.
        """
        sy = math.sqrt(R[0, 0] ** 2 + R[1, 0] ** 2)
        singular = sy < 1e-6

        if not singular:
            x = math.atan2(R[2, 1], R[2, 2])  # pitch
            y = math.atan2(-R[2, 0], sy)      # yaw
            z = math.atan2(R[1, 0], R[0, 0])  # roll
        
        else:
            x = math.atan2(-R[1, 2], R[1, 1])
            y = math.atan2(-R[2, 0], sy)
            z = 0

        return np.degrees([x, y, z])   # converting radians to degrees
import mediapipe as mp

mp_face_mesh = mp.solutions.face_mesh.FaceMesh(refine_landmarks=True)

def detect_lip_movement(frame):
    results = mp_face_mesh.process(frame)
    return bool(results.multi_face_landmarks)

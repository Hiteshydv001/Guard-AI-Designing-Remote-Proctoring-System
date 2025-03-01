import cv2
import numpy as np
from tensorflow.keras.models import load_model
from preprocess import preprocess_image

# Load model
model = load_model('model/face_spoofing_model.h5')

def detect_spoof(image_path):
    # Preprocess image
    image = preprocess_image(image_path)
    
    # Predict
    prediction = model.predict(image)
    
    # Display results
    label = 'Real' if prediction[0] > 0.5 else 'Spoofed'
    confidence = prediction[0] if prediction[0] > 0.5 else 1 - prediction[0]
    
    # Display image with result
    image = cv2.imread(image_path)
    cv2.putText(image, f'{label} ({confidence:.2f})', (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    
    cv2.imshow('Result', image)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

# Example usage
detect_spoof('path_to_image.jpg')

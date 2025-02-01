import cv2
import numpy as np
from tensorflow.keras.models import load_model
from utils.preprocess import preprocess_image

# Load the trained model
model = load_model('model/face_spoofing_model.h5')

def detect_spoof(image_path):
    # Preprocess image
    image = preprocess_image(image_path)
    
    # Predict using the model
    prediction = model.predict(image)
    
    # Determine label and confidence score
    label = 'Real' if prediction[0] > 0.5 else 'Spoofed'
    confidence = float(prediction[0]) if prediction[0] > 0.5 else float(1 - prediction[0])
    
    # Load the original image for display
    display_image = cv2.imread(image_path)
    cv2.putText(display_image, f'{label} ({confidence:.2f})', (50, 50), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0) if label == 'Real' else (0, 0, 255), 2)
    
    # Show the image with the prediction label
    cv2.imshow('Spoof Detection Result', display_image)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

# Test the model on an example image
image_path = 'path_to_test_image.jpg'  # Replace with your test image path
detect_spoof(image_path)

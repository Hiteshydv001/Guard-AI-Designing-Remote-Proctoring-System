import cv2
import numpy as np

def preprocess_image(image_path, target_size=(224, 224)):
    # Load image
    image = cv2.imread(image_path)
    
    # Resize image
    image = cv2.resize(image, target_size)
    
    # Normalize pixel values
    image = image / 255.0
    
    # Expand dimensions to fit the model input
    image = np.expand_dims(image, axis=0)
    
    return image

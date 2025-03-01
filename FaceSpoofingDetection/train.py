from model.face_spoofing_model import create_model
from tensorflow.keras.preprocessing.image import ImageDataGenerator

# Create model
model = create_model()

# Image data generators for loading and augmenting images
train_datagen = ImageDataGenerator(
    rescale=1./255, 
    rotation_range=20, 
    width_shift_range=0.2, 
    height_shift_range=0.2,
    horizontal_flip=True
)

train_generator = train_datagen.flow_from_directory(
    'dataset/train', 
    target_size=(224, 224), 
    batch_size=32, 
    class_mode='binary'
)

validation_datagen = ImageDataGenerator(rescale=1./255)

validation_generator = validation_datagen.flow_from_directory(
    'dataset/validation', 
    target_size=(224, 224), 
    batch_size=32, 
    class_mode='binary'
)

# Train the model
model.fit(train_generator, validation_data=validation_generator, epochs=10)

# Save the trained model
model.save('model/face_spoofing_model.h5')

print("Model training complete! Saved as 'model/face_spoofing_model.h5'.")

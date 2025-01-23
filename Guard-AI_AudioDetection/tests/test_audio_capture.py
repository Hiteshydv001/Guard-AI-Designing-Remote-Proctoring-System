import os
from app.audio_capture import capture_audio

def test_capture_audio():
    test_file = 'test_audio.wav'
    try:
        capture_audio(test_file, duration=5)
        
        assert os.path.exists(test_file), "Test failed: Audio file was not created."
        
        assert os.path.getsize(test_file) > 0, "Test failed: Audio file is empty."
        
        print("Audio capture test passed.")
    except Exception as e:
        print(f"Audio capture test failed: {e}")
    finally:
        if os.path.exists(test_file):
            os.remove(test_file)

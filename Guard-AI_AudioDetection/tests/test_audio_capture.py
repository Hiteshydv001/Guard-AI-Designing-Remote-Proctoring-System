from app.audio_capture import capture_audio

def test_capture_audio():
    try:
        capture_audio('test_audio.wav', duration=5)
        print("Audio capture test passed.")
    except Exception as e:
        print(f"Audio capture test failed: {e}")

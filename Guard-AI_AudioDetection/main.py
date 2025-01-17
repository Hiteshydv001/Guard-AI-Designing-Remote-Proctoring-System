from datetime import datetime
from app.audio_capture import capture_audio
from app.noise_reduction import reduce_noise
from app.detection.keyword_detection import keyword_detection
from app.alerts.alert_system import send_alert
from app.alerts.logger import log_event

def main():
    audio_file = 'assets/samples/audio_sample.wav'
    cleaned_file = 'assets/samples/cleaned_audio.wav'

    # Step 1: Capture Audio
    capture_audio(audio_file, duration=10)

    # Step 2: Reduce Noise
    reduce_noise(audio_file, cleaned_file)

    # Step 3: Keyword Detection
    keywords = ['help', 'answer', 'cheat']
    if keyword_detection(cleaned_file, keywords):
        event = "Suspicious Keyword Detected"
        timestamp = datetime.now()
        
        # Step 4: Send Alert
        send_alert(event, timestamp)

        # Step 5: Log Event
        log_event(event, timestamp)

if __name__ == "__main__":
    main()

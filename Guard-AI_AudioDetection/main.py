from datetime import datetime
from app.audio_capture import AudioCapture  # Import the class, not the function
from app.noise_reduction import reduce_noise
from app.detection.keyword_detection import keyword_detection, process_audio_chunk
from app.alerts.alert_system import send_alert
from app.alerts.logger import log_event
import threading
import queue

def main():
    audio_file = 'assets/samples/audio_sample.wav'
    cleaned_file = 'assets/samples/cleaned_audio.wav'
    keywords = ['help', 'answer', 'cheat']
    audio_queue = queue.Queue()

    # Create an instance of AudioCapture
    audio = AudioCapture()

    def audio_capture_thread():
        print("Starting audio capture...")
        audio.start_capture()
        while audio.is_recording:
            data = audio.stream.read(1024)
            audio_queue.put(data)

    def audio_processing_thread():
        while True:
            audio_chunk = audio_queue.get()
            if audio_chunk is None:
                break
            cleaned_chunk = reduce_noise(audio_chunk)
            if process_audio_chunk(cleaned_chunk, keywords):
                event = "Suspicious Keyword Detected"
                timestamp = datetime.now()
                send_alert(event, timestamp)
                log_event(event, timestamp)

    capture_thread = threading.Thread(target=audio_capture_thread)
    processing_thread = threading.Thread(target=audio_processing_thread)

    capture_thread.start()
    processing_thread.start()

    try:
        while True:
            pass
    except KeyboardInterrupt:
        print("Stopping audio capture...")
        audio.stop_audio_capture()
        audio_queue.put(None)  # Signal the processing thread to stop
        capture_thread.join()
        processing_thread.join()

if __name__ == "__main__":
    main()

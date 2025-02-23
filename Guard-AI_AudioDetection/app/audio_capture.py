import pyaudio
import wave
import threading
import time

class AudioCapture:
    def __init__(self):
        self.p = pyaudio.PyAudio()
        self.stream = self.p.open(format=pyaudio.paInt16,
                                  channels=1,
                                  rate=44100,
                                  input=True,
                                  frames_per_buffer=1024)
        self.frames = []
        self.is_recording = False
        self.thread = None

    def start_capture(self):
        self.is_recording = True
        self.thread = threading.Thread(target=self.capture_audio)  # Fixed method name
        self.thread.start()

    def capture_audio(self, audio_queue=None):
        print("Recording...")
        while self.is_recording:
              try:
                    data = self.stream.read(1024, exception_on_overflow=False)
                    self.frames.append(data)
                    if audio_queue is not None:  # Store in queue if provided
                          audio_queue.put(data)
        
          
              except Exception as e:
                 print(f"Error capturing audio: {e}")
        print("Recording finished.")


    def stop_audio_capture(self):
        self.is_recording = False
        if self.thread is not None:
            self.thread.join()
        time.sleep(0.1)  # Allow last buffer to be processed
        self.stream.stop_stream()
        self.stream.close()
        self.p.terminate()

    def save_audio(self, audio_file):
        with wave.open(audio_file, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(self.p.get_sample_size(pyaudio.paInt16))
            wf.setframerate(44100)
            wf.writeframes(b''.join(self.frames))
        print(f"Audio saved to {audio_file}")

# Example usage:
if __name__ == "__main__":
    audio = AudioCapture()
    audio.start_capture()
    time.sleep(5)  # Record for 5 seconds
    audio.stop_audio_capture()
    audio.save_audio("output.wav")

import os
# Set the paths for both ffmpeg and ffprobe
os.environ["PATH"] += os.pathsep + r"C:\Users\PRIYANKA BHUTADA\ffmpeg-master-latest-win64-gpl-shared\ffmpeg-master-latest-win64-gpl-shared\bin"
os.environ["FFMPEG_BINARY"] = r"C:\Users\PRIYANKA BHUTADA\ffmpeg-master-latest-win64-gpl-shared\ffmpeg-master-latest-win64-gpl-shared\bin\ffmpeg.exe"
os.environ["FFPROBE_BINARY"] = r"C:\Users\PRIYANKA BHUTADA\ffmpeg-master-latest-win64-gpl-shared\ffmpeg-master-latest-win64-gpl-shared\bin\ffprobe.exe"

from pydub import AudioSegment
AudioSegment.converter = r"C:\Users\PRIYANKA BHUTADA\ffmpeg-master-latest-win64-gpl-shared\ffmpeg-master-latest-win64-gpl-shared\bin\ffmpeg.exe"
AudioSegment.ffmpeg = r"C:\Users\PRIYANKA BHUTADA\ffmpeg-master-latest-win64-gpl-shared\ffmpeg-master-latest-win64-gpl-shared\bin\ffmpeg.exe"
AudioSegment.ffprobe = r"C:\Users\PRIYANKA BHUTADA\ffmpeg-master-latest-win64-gpl-shared\ffmpeg-master-latest-win64-gpl-shared\bin\ffprobe.exe"

import pyaudio
import wave
import numpy as np
import speech_recognition as sr
from datetime import datetime
import threading
import queue
import time
import logging
import os
from pydub import AudioSegment
from pydub.silence import detect_nonsilent
import tempfile


class AudioMonitor:
    def __init__(self, threshold=0.05, keywords=None):
        logging.basicConfig(
            filename='audio_monitor.log',
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger('AudioMonitor')
        

        self.CHUNK = 2048  
        self.FORMAT = pyaudio.paFloat32
        self.CHANNELS = 1
        self.RATE = 44100
        self.THRESHOLD = threshold
        

        self.temp_dir = tempfile.mkdtemp()
        

        try:
            self.audio = pyaudio.PyAudio()
        except Exception as e:
            self.logger.error(f"Failed to initialize PyAudio: {str(e)}")
            raise
        
        self.stream = None
        self.audio_queue = queue.Queue()
        

        self.recognizer = sr.Recognizer()
        self.recognizer.energy_threshold = 150
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.5  
        self.recognizer.phrase_threshold = 0.3 

        self.keywords = keywords if keywords else ['help', 'answer', 'cheat']
        
        self.is_monitoring = False
        self.suspicious_events = []
        self.processing_thread = None

    def start_monitoring(self):
        """Start audio monitoring with error handling"""
        if self.is_monitoring:
            self.logger.warning("Monitoring is already active")
            return

        try:
            self.is_monitoring = True
            self.stream = self.audio.open(
                format=self.FORMAT,
                channels=self.CHANNELS,
                rate=self.RATE,
                input=True,
                frames_per_buffer=self.CHUNK,
                stream_callback=self._audio_callback
            )
   
            self.processing_thread = threading.Thread(target=self._process_audio)
            self.processing_thread.daemon = True  
            self.processing_thread.start()
            
            self.logger.info("Monitoring started successfully")
            
        except Exception as e:
            self.is_monitoring = False
            self.logger.error(f"Failed to start monitoring: {str(e)}")
            raise

    def _audio_callback(self, in_data, frame_count, time_info, status):
        """Callback for audio stream processing"""
        if status:
            self.logger.warning(f"Audio stream status: {status}")
        self.audio_queue.put(in_data)
        return (None, pyaudio.paContinue)

    def stop_monitoring(self):
        """Stop audio monitoring safely"""
        self.is_monitoring = False
        
        try:
            if self.stream:
                self.stream.stop_stream()
                self.stream.close()
            
            if self.processing_thread and self.processing_thread.is_alive():
                self.processing_thread.join(timeout=2.0)  
                
            while not self.audio_queue.empty():
                self.audio_queue.get_nowait()
                
            self.logger.info("Monitoring stopped successfully")
            
        except Exception as e:
            self.logger.error(f"Error while stopping monitoring: {str(e)}")

    def _process_audio(self):
        """Process audio stream with improved error handling"""
        while self.is_monitoring:
            try:
                try:
                    audio_data = self.audio_queue.get(timeout=1.0)
                except queue.Empty:
                    continue
                
                data = np.frombuffer(audio_data, dtype=np.float32)
                audio_level = np.max(np.abs(data))
                
                if audio_level > self.THRESHOLD:
                    self._analyze_audio_chunk(data)
                    
            except Exception as e:
                self.logger.error(f"Error in audio processing: {str(e)}")
                time.sleep(0.1)  

    def _analyze_audio_chunk(self, audio_data):
        """Analyze audio chunk with improved speech recognition"""
        try:
            temp_path = os.path.join(self.temp_dir, f"temp_{int(time.time())}.wav")
            
            with wave.open(temp_path, 'wb') as wf:
                wf.setnchannels(self.CHANNELS)
                wf.setsampwidth(4)  
                wf.setframerate(self.RATE)
                wf.writeframes(audio_data.tobytes())

            with sr.AudioFile(temp_path) as source:
                audio = self.recognizer.record(source)
                try:
                    text = self.recognizer.recognize_google(audio)
                    self._check_keywords(text)
                except sr.UnknownValueError:
                    self.logger.debug("Speech not recognized")
                except sr.RequestError as e:
                    self.logger.error(f"Speech recognition service error: {str(e)}")

            try:
                os.remove(temp_path)
            except OSError:
                pass
                
        except Exception as e:
            self.logger.error(f"Error analyzing audio chunk: {str(e)}")

    def _check_keywords(self, text):
        """Check for suspicious keywords in text"""
        text = text.lower()
        print(f"\nChecking for keywords in: '{text}'")  
        for keyword in self.keywords:
            if keyword in text:
                message = f"Keyword detected: {keyword} in phrase '{text}'"
                print(f"\nALERT: {message}") 
                self._log_suspicious_event(message)
                self._send_alert(message)

    def get_monitoring_report(self, start_time=None, end_time=None):
        """Generate detailed monitoring report with optional time filtering"""
        try:
            filtered_events = self.suspicious_events
            if start_time:
                filtered_events = [e for e in filtered_events if e['timestamp'] >= start_time]
            if end_time:
                filtered_events = [e for e in filtered_events if e['timestamp'] <= end_time]
            
            report = {
                'total_events': len(filtered_events),
                'events': filtered_events,
                'monitoring_status': 'active' if self.is_monitoring else 'inactive',
                'generated_at': datetime.now()
            }
            return report
            
        except Exception as e:
            self.logger.error(f"Error generating report: {str(e)}")
            return None

def test_audio_monitor():
    """Test the audio monitoring system with enhanced error handling"""
    monitor = None
    
    try:
        monitor = AudioMonitor(
            threshold=0.15,  
            keywords=['help', 'answer', 'cheat', 'hello', '123']  
        )
        
        print("Starting audio monitoring...")
        monitor.start_monitoring()

        time.sleep(60)
        
    except KeyboardInterrupt:
        print("\nMonitoring interrupted by user")
    except Exception as e:
        print(f"Error during monitoring: {str(e)}")
    finally:
        if monitor:
            print("Stopping audio monitoring...")
            monitor.stop_monitoring()
            
            report = monitor.get_monitoring_report()
            if report:
                print("\nMonitoring Report:")
                print(f"Total suspicious events: {report['total_events']}")
                for event in report['events']:
                    print(f"Event at {event['timestamp']}: {event['description']}")

def _check_keywords(self, text):
    """Check for suspicious keywords in text"""
    print(f"Detected speech: {text}")  
    text = text.lower()
    for keyword in self.keywords:
        if keyword in text:
            self._log_suspicious_event(f"Keyword detected: {keyword}")
            self._send_alert(f"Suspicious keyword detected: {keyword}")

if __name__ == "__main__":
    test_audio_monitor()
import speech_recognition as sr

def process_audio(file):
    recognizer = sr.Recognizer()

    with sr.AudioFile(file) as source:
        audio_data = recognizer.record(source)

    try:
        text = recognizer.recognize_google(audio_data).lower()
        suspicious_keywords = ["help", "answer", "cheat"]
        detected_words = [word for word in suspicious_keywords if word in text]

        if detected_words:
            return {"alert": True, "keywords_detected": detected_words}
        else:
            return {"alert": False, "message": "No suspicious activity detected"}
    except sr.UnknownValueError:
        return {"alert": False, "message": "Could not understand the audio"}

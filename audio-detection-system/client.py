import requests

url = "http://127.0.0.1:8000/detect_audio"
files = {"file": open("test_audio/sample.wav", "rb")}

response = requests.post(url, files=files)
print(response.json())

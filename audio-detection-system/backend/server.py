from fastapi import FastAPI, UploadFile, File, HTTPException
import os
import resend
import logging
import io
from fastapi.middleware.cors import CORSMiddleware
from audio_processing import process_audio

logging.basicConfig(level=logging.ERROR, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change this for production
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Resend API key setup
resend.api_key = os.environ.get("RESEND_API_KEY", "")

@app.post("/contact")
async def contact(data: dict):
    """Handles contact form submissions"""
    try:
        params = {
            "from": "onboarding@resend.dev",
            "to": ["leomirandadev@gmail.com"],
            "subject": f"New message from {data['firstName']} {data['lastName']} regarding {data['subject']}",
            "html": f"<h1><strong>Name:</strong></h1><br />{data['firstName']} {data['lastName']}<br /><br /><hr /><h1><strong>Email:</strong></h1><br />{data['email']}<br /><br /><hr /><h1><strong>Subject:</strong></h1><br />{data['subject']}<br /><br /><hr /><h1><strong>Message:</strong></h1><br />{data['message']}",
        }
        res = resend.Emails.send(params)
        print("Email sent! Response ID:", res.id)
        return {"message": "Email sent successfully"}
    except Exception as e:
        logging.error("An error occurred: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/detect_audio")
async def detect_audio(file: UploadFile = File(...)):
    """Detects suspicious words from audio file"""
    try:
        audio_bytes = await file.read()
        audio_file = io.BytesIO(audio_bytes)
        result = process_audio(audio_file)
        return result
    except Exception as e:
        logging.error("Audio processing error: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/")
async def root():
    return {"message": "FastAPI Audio Detection Server is Running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

import wave
import numpy as np

def reduce_noise(input_file, output_file="cleaned.wav", noise_reduction_factor=0.8):
    with wave.open(input_file, "rb") as wf:
        params = wf.getparams()
        frames = wf.readframes(wf.getnframes())
        audio_data = np.frombuffer(frames, dtype=np.int16)

    # Apply a simple noise reduction algorithm
    audio_data_cleaned = audio_data * noise_reduction_factor
    audio_data_cleaned = audio_data_cleaned.astype(np.int16)

    with wave.open(output_file, "wb") as wf:
        wf.setparams(params)
        wf.writeframes(audio_data_cleaned.tobytes())

    return output_file

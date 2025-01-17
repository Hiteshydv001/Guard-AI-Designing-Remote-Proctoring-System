import time
import pandas as pd
from pynput import keyboard, mouse

# Inactivity settings
INACTIVITY_LIMIT = 10  # Time before warning (seconds)
exam_duration = 45  # Simulated exam session time

# Create session data dictionary
session_data = {
    "Login Time": time.strftime("%Y-%m-%d %H:%M:%S"),
    "Logout Time": None,
    "Inactive Warnings": 0,
    "Total Inactive Time (secs)": 0
}

print(f"Login Time Recorded: {session_data['Login Time']}")

start_time = time.time()
last_active_time = time.time()
inactive_time = 0

# Function to update activity time
def on_activity(_):
    global last_active_time
    last_active_time = time.time()

# Set up listeners
keyboard_listener = keyboard.Listener(on_press=on_activity)
mouse_listener = mouse.Listener(on_click=on_activity)

keyboard_listener.start()
mouse_listener.start()

while time.time() - start_time < exam_duration:
    if time.time() - last_active_time >= INACTIVITY_LIMIT:
        session_data["Inactive Warnings"] += 1
        session_data["Total Inactive Time (secs)"] += INACTIVITY_LIMIT
        print(f"Warning {session_data['Inactive Warnings']}: Inactive for {INACTIVITY_LIMIT} seconds!")
        last_active_time = time.time()  # Reset inactivity timer

# Log logout time
session_data["Logout Time"] = time.strftime("%Y-%m-%d %H:%M:%S")
print(f"Logout Time Recorded: {session_data['Logout Time']}")

# Save session data to CSV
df = pd.DataFrame([session_data])
df.to_csv("logs/exam_session_log.csv", index=False)
print("Session log saved successfully!")

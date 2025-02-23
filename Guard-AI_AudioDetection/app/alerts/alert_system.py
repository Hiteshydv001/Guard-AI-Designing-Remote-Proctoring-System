from datetime import datetime

def send_alert(event, timestamp):
    print(f"ALERT: {event} detected at {timestamp}.")

def send_real_time_alert(event):
    timestamp = datetime.now()
    send_alert(event, timestamp)

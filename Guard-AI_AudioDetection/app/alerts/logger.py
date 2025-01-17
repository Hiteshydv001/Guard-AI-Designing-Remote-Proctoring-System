import json

def log_event(event, timestamp, log_file='assets/logs/event_log.json'):
    log_entry = {"event": event, "timestamp": str(timestamp)}
    try:
        with open(log_file, 'r+') as file:
            logs = json.load(file)
            logs.append(log_entry)
            file.seek(0)
            json.dump(logs, file, indent=4)
    except FileNotFoundError:
        with open(log_file, 'w') as file:
            json.dump([log_entry], file, indent=4)

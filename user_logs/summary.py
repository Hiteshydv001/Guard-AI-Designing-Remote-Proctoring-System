import pandas as pd

df = pd.read_csv("logs/exam_session_log.csv")

print("\n📜 FINAL EXAM SESSION SUMMARY 📜")
print(df.to_string(index=False))

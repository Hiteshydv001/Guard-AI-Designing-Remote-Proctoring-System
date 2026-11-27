"""Aggregations for the proctor dashboards."""

from __future__ import annotations

import statistics
from collections import Counter
from datetime import timedelta

from ..models import Attempt, Exam, Violation, utcnow
from .exams import aware, exam_settings, is_correct, percentage

BUCKETS = [(0, 20), (20, 40), (40, 60), (60, 80), (80, 101)]


def exam_analytics(exam: Exam, attempts: list[Attempt], violations: list[Violation]) -> dict:
    finished = [a for a in attempts if a.status != "in_progress"]
    pcts = [p for p in (percentage(a) for a in finished) if p is not None]
    pass_mark = float(exam_settings(exam).get("pass_percentage", 40))
    durations = [
        (aware(a.submitted_at) - aware(a.started_at)).total_seconds() / 60 for a in finished if a.submitted_at and a.started_at
    ]

    questions = []
    for q in exam.questions:
        answered = [a for a in finished if (a.answers or {}).get(q.id) not in (None, "", [])]
        if q.type == "text":
            graded = [a for a in finished if q.id in (a.manual_scores or {})]
            avg = statistics.mean(float(a.manual_scores[q.id]) / q.points for a in graded) if graded and q.points else None
            rate = None if avg is None else round(100 * avg, 1)
        else:
            correct = sum(1 for a in finished if is_correct(q, (a.answers or {}).get(q.id)))
            rate = round(100 * correct / len(finished), 1) if finished else None
        questions.append(
            {
                "id": q.id,
                "prompt": q.prompt,
                "type": q.type,
                "correct_rate": rate,
                "answered_rate": round(100 * len(answered) / len(finished), 1) if finished else None,
            }
        )

    return {
        "summary": {
            "attempts": len(attempts),
            "in_progress": len(attempts) - len(finished),
            "submitted": sum(1 for a in finished if a.status == "submitted"),
            "terminated": sum(1 for a in finished if a.status == "terminated"),
            "average": round(statistics.mean(pcts), 1) if pcts else None,
            "median": round(statistics.median(pcts), 1) if pcts else None,
            "highest": max(pcts) if pcts else None,
            "pass_rate": round(100 * sum(1 for p in pcts if p >= pass_mark) / len(pcts), 1) if pcts else None,
            "pass_percentage": pass_mark,
            "avg_minutes": round(statistics.mean(durations), 1) if durations else None,
            "flagged": sum(1 for a in attempts if (a.risk_score or 0) >= 10),
        },
        "score_distribution": [
            {"range": f"{lo}–{min(hi, 100)}%", "count": sum(1 for p in pcts if lo <= p < hi)} for lo, hi in BUCKETS
        ],
        "questions": questions,
        "violations_by_type": [{"type": t, "count": c} for t, c in Counter(v.type for v in violations).most_common()],
    }


def activity_series(attempts: list[Attempt], violations: list[Violation], days: int = 14) -> list[dict]:
    today = utcnow().date()
    start = today - timedelta(days=days - 1)
    starts = Counter(aware(a.started_at).date() for a in attempts if a.started_at)
    flags = Counter(aware(v.created_at).date() for v in violations if v.created_at)
    return [
        {
            "date": (start + timedelta(days=i)).isoformat(),
            "attempts": starts.get(start + timedelta(days=i), 0),
            "flags": flags.get(start + timedelta(days=i), 0),
        }
        for i in range(days)
    ]

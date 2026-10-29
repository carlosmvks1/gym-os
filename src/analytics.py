#!/usr/bin/env python3
import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOG = ROOT / "data" / "training_log.csv"


def main():
    if not LOG.exists():
        print("No training log found.")
        return

    by_exercise = defaultdict(lambda: {"sets": 0, "reps": 0, "tonnage": 0.0, "last_date": ""})
    with LOG.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        print("Training log is empty. Log your first working sets.")
        return

    for r in rows:
        try:
            reps = int(float(r["reps"]))
            weight = float(r["weight_kg"])
        except (ValueError, TypeError):
            continue
        x = by_exercise[r["exercise"]]
        x["sets"] += 1
        x["reps"] += reps
        x["tonnage"] += reps * weight
        x["last_date"] = max(x["last_date"], r["date"])

    print(f"{'Exercise':30} {'Sets':>5} {'Reps':>6} {'Tonnage':>10} {'Last':>12}")
    print("-" * 70)
    for exercise, x in sorted(by_exercise.items()):
        print(f"{exercise[:30]:30} {x['sets']:>5} {x['reps']:>6} {x['tonnage']:>10.0f} {x['last_date']:>12}")


if __name__ == "__main__":
    main()

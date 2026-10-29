#!/usr/bin/env python3
import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_LOG = ROOT / "data" / "training_log.csv"
PRIVATE_LOG = ROOT / "data" / "private" / "training_log.csv"


def active_log_path() -> Path:
    return PRIVATE_LOG if PRIVATE_LOG.exists() else PUBLIC_LOG


def main():
    log_path = active_log_path()

    if not log_path.exists():
        print("No training log found.")
        return

    by_exercise = defaultdict(
        lambda: {"sets": 0, "reps": 0, "tonnage": 0.0, "last_date": ""}
    )

    with log_path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        print("Training log is empty. Log your first working sets.")
        return

    for row in rows:
        try:
            reps = int(float(row["reps"]))
            weight = float(row["weight_kg"])
        except (ValueError, TypeError):
            continue

        item = by_exercise[row["exercise"]]
        item["sets"] += 1
        item["reps"] += reps
        item["tonnage"] += reps * weight
        item["last_date"] = max(item["last_date"], row["date"])

    print(f"Using log: {log_path.relative_to(ROOT)}\n")
    print(f"{'Exercise':30} {'Sets':>5} {'Reps':>6} {'Tonnage':>10} {'Last':>12}")
    print("-" * 70)

    for exercise, item in sorted(by_exercise.items()):
        print(
            f"{exercise[:30]:30} "
            f"{item['sets']:>5} "
            f"{item['reps']:>6} "
            f"{item['tonnage']:>10.0f} "
            f"{item['last_date']:>12}"
        )


if __name__ == "__main__":
    main()

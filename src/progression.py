#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_LOG_PATH = ROOT / "data" / "training_log.csv"
PRIVATE_LOG_PATH = ROOT / "data" / "private" / "training_log.csv"
LIBRARY_PATH = ROOT / "data" / "exercise_library.csv"
RULES_PATH = ROOT / "program" / "progression_rules.json"


@dataclass
class SessionPerformance:
    date: str
    weight: float
    reps: list[int]
    rirs: list[float]

    @property
    def avg_rir(self) -> Optional[float]:
        return sum(self.rirs) / len(self.rirs) if self.rirs else None


def active_log_path() -> Path:
    return PRIVATE_LOG_PATH if PRIVATE_LOG_PATH.exists() else PUBLIC_LOG_PATH


def _float(value: str) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def load_library() -> dict[str, dict]:
    with LIBRARY_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return {r["exercise"]: r for r in rows if r.get("exercise")}


def load_rules() -> dict:
    with RULES_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def exercise_history(exercise: str) -> list[SessionPerformance]:
    grouped = defaultdict(list)
    log_path = active_log_path()

    if not log_path.exists():
        return []

    with log_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("exercise") == exercise:
                grouped[row["date"]].append(row)

    history = []
    for date in sorted(grouped):
        rows = grouped[date]
        weights = [_float(r.get("weight_kg", "")) for r in rows]
        weights = [w for w in weights if w is not None]
        reps = [int(float(r["reps"])) for r in rows if r.get("reps")]
        rirs = [_float(r.get("rir", "")) for r in rows]
        rirs = [r for r in rirs if r is not None]
        if weights and reps:
            history.append(SessionPerformance(date, max(weights), reps, rirs))
    return history


def recommend(exercise: str, fallback_weight: Optional[float] = None) -> dict:
    library = load_library()
    rules = load_rules()

    if exercise not in library:
        return {
            "exercise": exercise,
            "action": "calibrate",
            "reason": "Exercise is not in exercise_library.csv",
        }

    meta = library[exercise]
    rep_min = int(meta["rep_min"])
    rep_max = int(meta["rep_max"])
    increment = float(meta["load_increment_kg"])
    history = exercise_history(exercise)

    if not history:
        return {
            "exercise": exercise,
            "action": "calibrate",
            "weight_kg": fallback_weight,
            "rep_range": [rep_min, rep_max],
            "reason": "No logged working sets yet.",
        }

    latest = history[-1]
    current_weight = latest.weight

    if min(latest.reps) < rep_min:
        return {
            "exercise": exercise,
            "action": "hold",
            "weight_kg": current_weight,
            "rep_range": [rep_min, rep_max],
            "reason": (
                "At least one working set is below the target rep range; "
                "earn reps before adding load."
            ),
        }

    required = int(rules["sessions_required_to_increase_load"])
    recent = history[-required:]
    target_rir_min = float(rules["target_rir_min"])

    qualifies = len(recent) == required
    if qualifies:
        for performance in recent:
            if min(performance.reps) < rep_max:
                qualifies = False
                break
            if (
                performance.avg_rir is not None
                and performance.avg_rir < target_rir_min
            ):
                qualifies = False
                break

    if qualifies:
        return {
            "exercise": exercise,
            "action": "increase_load",
            "weight_kg": round(current_weight + increment, 2),
            "previous_weight_kg": current_weight,
            "rep_range": [rep_min, rep_max],
            "reason": (
                f"Top of rep range achieved for {required} consecutive sessions "
                "at acceptable RIR."
            ),
        }

    return {
        "exercise": exercise,
        "action": "progress_reps",
        "weight_kg": current_weight,
        "rep_range": [rep_min, rep_max],
        "reason": (
            "Keep load stable and add reps while staying in the target RIR range."
        ),
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("exercise")
    args = parser.parse_args()
    print(json.dumps(recommend(args.exercise), indent=2))

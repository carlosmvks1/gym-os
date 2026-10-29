#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
LIBRARY_PATH = ROOT / "data" / "exercise_library.csv"
RULES_PATH = ROOT / "program" / "progression_rules.json"


def load_library() -> dict[str, dict[str, str]]:
    with LIBRARY_PATH.open(newline="", encoding="utf-8") as f:
        return {row["exercise"]: row for row in csv.DictReader(f) if row.get("exercise")}


def load_rules() -> dict[str, Any]:
    with RULES_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def round_load(value: float, increment: float) -> float:
    if increment <= 0:
        return round(value, 2)
    return round(round(value / increment) * increment, 2)


def adjust_load(weight: float, increment: float, direction: str) -> float:
    if direction == "up":
        return round_load(weight + increment, increment)
    if direction == "down":
        return max(increment, round_load(weight - increment, increment))
    return round_load(weight, increment)


def confidence(valid_target_sets: int) -> dict[str, Any]:
    if valid_target_sets >= 3:
        return {"label": "high", "score": 1.0}
    if valid_target_sets == 2:
        return {"label": "medium", "score": 0.67}
    if valid_target_sets == 1:
        return {"label": "low", "score": 0.33}
    return {"label": "very_low", "score": 0.0}


def recommend_next_set(
    exercise: str,
    sets: list[dict[str, Any]],
    library: dict[str, dict[str, str]] | None = None,
    rules: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Calibration engine.

    Each set must contain:
      {"weight_kg": float, "reps": int, "rir": float}

    The engine intentionally uses transparent rules:
    - too easy -> increase one exercise-specific increment
    - inside target reps + RIR -> hold and confirm
    - too hard -> decrease one increment
    """
    library = library or load_library()
    rules = rules or load_rules()

    if exercise not in library:
        raise ValueError(f"Unknown exercise: {exercise}")

    meta = library[exercise]
    rep_min = int(meta["rep_min"])
    rep_max = int(meta["rep_max"])
    increment = float(meta["load_increment_kg"])

    calibration_rules = rules.get("calibration", {})
    rir_min = float(calibration_rules.get("target_rir_min", rules.get("target_rir_min", 1)))
    rir_max = float(calibration_rules.get("target_rir_max", rules.get("target_rir_max", 3)))
    target_sets = int(calibration_rules.get("target_sets_for_medium_confidence", 2))

    if not sets:
        return {
            "exercise": exercise,
            "action": "choose_conservative_start",
            "next_weight_kg": None,
            "target_reps": [rep_min, rep_max],
            "target_rir": [rir_min, rir_max],
            "confidence": confidence(0),
            "calibrated": False,
            "reason": "No calibration sets logged yet. Choose a conservative starting load.",
        }

    normalized: list[dict[str, float | int]] = []
    for index, set_data in enumerate(sets, start=1):
        try:
            weight = float(set_data["weight_kg"])
            reps = int(set_data["reps"])
            rir = float(set_data["rir"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(
                f"Set {index} requires valid weight_kg, reps and rir values."
            ) from exc

        if weight <= 0 or reps <= 0 or not 0 <= rir <= 10:
            raise ValueError(f"Set {index} has invalid values.")

        normalized.append({"weight_kg": weight, "reps": reps, "rir": rir})

    valid_target_sets = sum(
        rep_min <= s["reps"] <= rep_max and rir_min <= s["rir"] <= rir_max
        for s in normalized
    )
    current_confidence = confidence(valid_target_sets)
    last = normalized[-1]

    weight = float(last["weight_kg"])
    reps = int(last["reps"])
    rir = float(last["rir"])

    if reps < rep_min or rir < rir_min:
        action = "decrease_load"
        next_weight = adjust_load(weight, increment, "down")
        reason = (
            "The last set was too hard for calibration: reps fell below range "
            "or RIR was below target."
        )
    elif reps > rep_max or rir > rir_max:
        action = "increase_load"
        next_weight = adjust_load(weight, increment, "up")
        reason = (
            "The last set was too easy for calibration: reps exceeded range "
            "or too many reps were left in reserve."
        )
    else:
        action = "hold_load"
        next_weight = adjust_load(weight, increment, "hold")
        reason = (
            "The last set landed inside the calibration zone. "
            "Repeat the load to confirm it."
        )

    calibrated = valid_target_sets >= target_sets

    if calibrated and action == "hold_load":
        reason += " Working load is provisionally calibrated."

    return {
        "exercise": exercise,
        "action": action,
        "next_weight_kg": next_weight,
        "target_reps": [rep_min, rep_max],
        "target_rir": [rir_min, rir_max],
        "valid_target_sets": valid_target_sets,
        "confidence": current_confidence,
        "calibrated": calibrated,
        "reason": reason,
    }


def interactive_calibration(exercise: str) -> None:
    sets: list[dict[str, Any]] = []

    print(f"\nGYM OS — CALIBRATION: {exercise}\n")
    first = recommend_next_set(exercise, sets)
    print(
        f"Target: {first['target_reps'][0]}-{first['target_reps'][1]} reps "
        f"@ RIR {first['target_rir'][0]:g}-{first['target_rir'][1]:g}"
    )
    print("Choose a deliberately conservative first working weight.\n")

    while True:
        try:
            weight = float(input("Weight (kg): "))
            reps = int(input("Reps: "))
            rir = float(input("RIR: "))
        except ValueError:
            print("Invalid entry. Try again.\n")
            continue

        sets.append({"weight_kg": weight, "reps": reps, "rir": rir})
        result = recommend_next_set(exercise, sets)

        print(f"\nCoach: {result['reason']}")
        print(f"Action: {result['action']}")
        print(f"Next load: {result['next_weight_kg']:g} kg")
        print(
            f"Confidence: {result['confidence']['label']} "
            f"({result['confidence']['score']:.0%})"
        )

        if result["calibrated"] and result["action"] == "hold_load":
            print("\nProvisional working load calibrated.")
            break

        if len(sets) >= 5:
            print(
                "\nCalibration stopped after 5 sets. "
                "Do not keep adding fatigue just to force certainty."
            )
            break

        print()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Gym OS live calibration coach")
    parser.add_argument("exercise", help="Exact exercise name from exercise_library.csv")
    args = parser.parse_args()

    interactive_calibration(args.exercise)

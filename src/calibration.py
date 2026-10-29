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


def _round_load(value: float) -> float:
    return round(value + 1e-12, 2)


def adjust_load(weight: float, increment: float, direction: str) -> float:
    if direction == "up":
        return _round_load(weight + increment)
    if direction == "down":
        return max(increment, _round_load(weight - increment))
    return _round_load(weight)


def confidence(valid_sets_at_current_load: int) -> dict[str, Any]:
    if valid_sets_at_current_load >= 3:
        return {"label": "high", "score": 1.0}
    if valid_sets_at_current_load == 2:
        return {"label": "medium", "score": 0.67}
    if valid_sets_at_current_load == 1:
        return {"label": "low", "score": 0.33}
    return {"label": "very_low", "score": 0.0}


def _is_valid_target_set(
    set_data: dict[str, float | int],
    rep_min: int,
    rep_max: int,
    rir_min: float,
    rir_max: float,
) -> bool:
    return (
        rep_min <= int(set_data["reps"]) <= rep_max
        and rir_min <= float(set_data["rir"]) <= rir_max
    )


def _confirmation_streak(
    sets: list[dict[str, float | int]],
    rep_min: int,
    rep_max: int,
    rir_min: float,
    rir_max: float,
) -> int:
    if not sets:
        return 0

    current_weight = float(sets[-1]["weight_kg"])
    streak = 0
    for item in reversed(sets):
        if abs(float(item["weight_kg"]) - current_weight) > 1e-9:
            break
        if not _is_valid_target_set(item, rep_min, rep_max, rir_min, rir_max):
            break
        streak += 1
    return streak


def recommend_next_set(
    exercise: str,
    sets: list[dict[str, Any]],
    library: dict[str, dict[str, str]] | None = None,
    rules: dict[str, Any] | None = None,
) -> dict[str, Any]:
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
    confirming_sets = int(calibration_rules.get("target_sets_for_medium_confidence", 2))

    if not sets:
        return {
            "exercise": exercise,
            "action": "user_selects_first_load",
            "next_weight_kg": None,
            "target_reps": [rep_min, rep_max],
            "target_rir": [rir_min, rir_max],
            "confidence": confidence(0),
            "confirming_sets": 0,
            "calibrated": False,
            "should_stop": False,
            "reason": "Cold start: choose the first load yourself. Gym OS starts coaching after set 1.",
        }

    normalized: list[dict[str, float | int]] = []
    for index, set_data in enumerate(sets, start=1):
        try:
            weight = float(set_data["weight_kg"])
            reps = int(set_data["reps"])
            rir = float(set_data["rir"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"Set {index} requires valid weight_kg, reps and rir values.") from exc

        if weight <= 0 or reps <= 0 or not 0 <= rir <= 10:
            raise ValueError(f"Set {index} has invalid values.")

        normalized.append({"weight_kg": weight, "reps": reps, "rir": rir})

    last = normalized[-1]
    weight = float(last["weight_kg"])
    reps = int(last["reps"])
    rir = float(last["rir"])

    streak = _confirmation_streak(normalized, rep_min, rep_max, rir_min, rir_max)
    current_confidence = confidence(streak)

    if reps < rep_min and rir > rir_max:
        action = "hold_load"
        next_weight = adjust_load(weight, increment, "hold")
        reason = "Stopped below the rep range with plenty in reserve; keep the load and take the next set further."
    elif reps < rep_min:
        action = "decrease_load"
        next_weight = adjust_load(weight, increment, "down")
        reason = "Below the target rep range without excess reserve; reduce one increment."
    elif reps > rep_max:
        action = "increase_load"
        next_weight = adjust_load(weight, increment, "up")
        reason = "Exceeded the target rep range; increase one increment on the next set."
    elif rir < rir_min:
        action = "decrease_load"
        next_weight = adjust_load(weight, increment, "down")
        reason = "Rep count was in range, but effort was above the calibration target."
    elif rir > rir_max:
        action = "increase_load"
        next_weight = adjust_load(weight, increment, "up")
        reason = "Rep count was in range, but the set was too easy for calibration."
    else:
        action = "hold_load"
        next_weight = adjust_load(weight, increment, "hold")
        reason = "The set landed inside the calibration zone. Repeat the same load once to confirm it."

    calibrated = action == "hold_load" and streak >= confirming_sets
    if calibrated:
        reason = "Working load provisionally calibrated at this exact load. Stop calibrating this exercise for today."

    return {
        "exercise": exercise,
        "action": action,
        "next_weight_kg": next_weight,
        "target_reps": [rep_min, rep_max],
        "target_rir": [rir_min, rir_max],
        "confidence": current_confidence,
        "confirming_sets": streak,
        "calibrated": calibrated,
        "should_stop": calibrated,
        "reason": reason,
    }

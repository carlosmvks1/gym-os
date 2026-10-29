#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from .calibration import recommend_next_set
except ImportError:
    from calibration import recommend_next_set

ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "data" / "live_session.json"
PRIVATE_LOG = ROOT / "data" / "private" / "training_log.csv"
LIBRARY_PATH = ROOT / "data" / "exercise_library.csv"
RULES_PATH = ROOT / "program" / "progression_rules.json"

FIELDS = [
    "date",
    "session",
    "exercise",
    "set_number",
    "reps",
    "weight_kg",
    "rir",
    "rpe",
    "notes",
]


def load_library() -> dict[str, dict[str, str]]:
    with LIBRARY_PATH.open(newline="", encoding="utf-8") as f:
        return {row["exercise"]: row for row in csv.DictReader(f) if row.get("exercise")}


def load_rules() -> dict[str, Any]:
    with RULES_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def load_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        raise RuntimeError("No active session. Start one first.")
    return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def start_session(name: str) -> dict[str, Any]:
    if STATE_PATH.exists():
        raise RuntimeError("A session is already active. Finish or cancel it first.")

    state = {
        "name": name,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "sets": [],
    }
    save_state(state)
    return state


def exercise_sets(state: dict[str, Any], exercise: str) -> list[dict[str, Any]]:
    return [item for item in state["sets"] if item["exercise"] == exercise]


def add_set(
    exercise: str,
    weight_kg: float,
    reps: int,
    rir: float,
    rpe: float | None = None,
    notes: str = "",
) -> tuple[dict[str, Any], dict[str, Any]]:
    state = load_state()
    library = load_library()
    rules = load_rules()

    if exercise not in library:
        raise ValueError(f"Unknown exercise: {exercise}")

    previous = exercise_sets(state, exercise)

    item = {
        "exercise": exercise,
        "set_number": len(previous) + 1,
        "weight_kg": float(weight_kg),
        "reps": int(reps),
        "rir": float(rir),
        "rpe": rpe,
        "notes": notes,
    }

    state["sets"].append(item)
    save_state(state)

    result = recommend_next_set(exercise, previous + [item], library, rules)
    return item, result


def session_status() -> dict[str, Any]:
    state = load_state()
    grouped: dict[str, list[dict[str, Any]]] = {}

    for item in state["sets"]:
        grouped.setdefault(item["exercise"], []).append(item)

    return {
        "name": state["name"],
        "started_at": state["started_at"],
        "total_sets": len(state["sets"]),
        "exercises": grouped,
    }


def finish_session() -> tuple[int, Path]:
    state = load_state()

    if not state["sets"]:
        raise RuntimeError("The active session has no logged sets.")

    PRIVATE_LOG.parent.mkdir(parents=True, exist_ok=True)
    exists = PRIVATE_LOG.exists()

    with PRIVATE_LOG.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        if not exists:
            writer.writeheader()

        date = state["started_at"][:10]

        for item in state["sets"]:
            writer.writerow(
                {
                    "date": date,
                    "session": state["name"],
                    "exercise": item["exercise"],
                    "set_number": item["set_number"],
                    "reps": item["reps"],
                    "weight_kg": item["weight_kg"],
                    "rir": item["rir"],
                    "rpe": "" if item["rpe"] is None else item["rpe"],
                    "notes": item["notes"],
                }
            )

    count = len(state["sets"])
    STATE_PATH.unlink()
    return count, PRIVATE_LOG


def cancel_session() -> bool:
    if STATE_PATH.exists():
        STATE_PATH.unlink()
        return True
    return False


def print_status() -> None:
    status = session_status()
    print(f"\n{status['name']} — {status['total_sets']} sets logged")

    if not status["exercises"]:
        print("No sets yet.")
        return

    for exercise, items in status["exercises"].items():
        print(f"\n{exercise}")
        for item in items:
            print(
                f"  Set {item['set_number']}: "
                f"{item['weight_kg']:g} kg × {item['reps']} @ RIR {item['rir']:g}"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Gym OS live session")
    sub = parser.add_subparsers(dest="command", required=True)

    start = sub.add_parser("start", help="Start a free training session")
    start.add_argument("name")

    add = sub.add_parser("add", help="Log a set and receive coaching")
    add.add_argument("exercise")
    add.add_argument("weight_kg", type=float)
    add.add_argument("reps", type=int)
    add.add_argument("rir", type=float)
    add.add_argument("--rpe", type=float, default=None)
    add.add_argument("--notes", default="")

    sub.add_parser("status", help="Show the active session")
    sub.add_parser("finish", help="Save the session to the private local log")
    sub.add_parser("cancel", help="Discard the active session")

    args = parser.parse_args()

    try:
        if args.command == "start":
            state = start_session(args.name)
            print(f"Started: {state['name']}")
            print("Choose your first exercise and first load. Gym OS will coach after set 1.")

        elif args.command == "add":
            item, result = add_set(
                args.exercise,
                args.weight_kg,
                args.reps,
                args.rir,
                args.rpe,
                args.notes,
            )
            print(
                f"Logged: {item['exercise']} — "
                f"{item['weight_kg']:g} kg × {item['reps']} @ RIR {item['rir']:g}"
            )
            print(f"Coach: {result['reason']}")
            print(f"Next load: {result['next_weight_kg']:g} kg")
            print(
                f"Confidence: {result['confidence']['label']} "
                f"({result['confidence']['score']:.0%})"
            )

        elif args.command == "status":
            print_status()

        elif args.command == "finish":
            count, path = finish_session()
            print(f"Session saved: {count} sets")
            print(f"Private log: {path.relative_to(ROOT)}")

        elif args.command == "cancel":
            print("Active session discarded." if cancel_session() else "No active session.")

    except (RuntimeError, ValueError) as exc:
        raise SystemExit(str(exc))


if __name__ == "__main__":
    main()

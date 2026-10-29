#!/usr/bin/env python3
import json
import sys
from pathlib import Path

from progression import recommend

ROOT = Path(__file__).resolve().parents[1]
PROGRAM = ROOT / "program" / "current_program.json"


def main():
    if len(sys.argv) < 2:
        print('Usage: python src/next_session.py "Upper A"')
        raise SystemExit(1)

    day = sys.argv[1]
    with PROGRAM.open(encoding="utf-8") as f:
        program = json.load(f)

    days = program.get("days", {})
    if day not in days:
        print(f"Unknown session: {day}")
        print("Available:", ", ".join(days))
        raise SystemExit(1)

    print(f"\n{day} — next session\n")
    print(f"{'Exercise':28} {'Sets':>4} {'Weight':>10} {'Reps':>9}  Action")
    print("-" * 75)

    for item in days[day]:
        result = recommend(item["exercise"], item.get("starting_weight_kg"))
        weight = result.get("weight_kg")
        weight_text = "CALIBRATE" if weight is None else f"{weight:g} kg"
        rep_range = result.get("rep_range", ["?", "?"])
        print(
            f"{item['exercise'][:28]:28} "
            f"{item['sets']:>4} "
            f"{weight_text:>10} "
            f"{rep_range[0]}-{rep_range[1]:<5}  "
            f"{result['action']}"
        )
        print(f"  -> {result['reason']}")


if __name__ == "__main__":
    main()

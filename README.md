# Gym OS

A small, auditable training system for logging workouts, tracking progression and generating the next session from real training data.

## v0.1

Gym OS separates **data** from **coaching logic**:

- `data/athlete_profile.json` — athlete profile and goals
- `data/exercise_library.csv` — preferred/allowed exercises and rep ranges
- `data/training_log.csv` — one row per working set
- `data/body_metrics.csv` — optional bodyweight/waist trends
- `data/recovery_log.csv` — sleep, energy, soreness and stress
- `program/current_program.json` — current split
- `program/progression_rules.json` — progression rules
- `src/progression.py` — progression engine
- `src/analytics.py` — training summaries
- `src/next_session.py` — generates the next planned session

## Privacy

Do **not** add sensitive health/body data while this repository is public. Make the repository private before using the personal logs.

## Log a workout

Add one row per working set to `data/training_log.csv`.

Example:

```csv
2026-10-29,Upper A,Incline Dumbbell Press,1,10,30,2,8,Felt good
2026-10-29,Upper A,Incline Dumbbell Press,2,9,30,2,8,
2026-10-29,Upper A,Incline Dumbbell Press,3,8,30,1,9,
```

RIR = reps in reserve. RPE is optional.

## Run locally

```bash
python src/analytics.py
python src/next_session.py "Upper A"
```

## Progression philosophy

The engine does not blindly add weight every week. It uses the recent log, target rep range and RIR:

1. Build reps inside the target range.
2. Add load only after the top of the range is demonstrated with acceptable effort across consecutive sessions.
3. Hold or reduce load when performance or recovery deteriorates.
4. Accessories default to rep progression before load progression.

This is an initial decision engine, not a substitute for judgment. The rules should evolve from real training data.

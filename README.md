# Gym OS

**Personal Adaptive Training System**

Gym OS is being built as a coach first and a workout tracker second. The tracker exists to give the coaching engine enough structured data to decide what should happen next.

## Current milestone: live calibration

The first working loop is:

```text
choose conservative load
        ↓
perform set
        ↓
log weight × reps @ RIR
        ↓
Gym OS interprets the set
        ↓
increase / hold / decrease
        ↓
repeat until a working zone is confirmed
```

Example:

```text
22.5 kg × 10 @ RIR 4
→ too easy
→ next set: 25 kg

25 kg × 9 @ RIR 2
→ target zone
→ hold 25 kg

25 kg × 8 @ RIR 1
→ target zone confirmed
→ provisional working load calibrated
```

The goal is **not** to test maximal strength. The goal is to find a repeatable working load with useful reps and controlled effort while avoiding unnecessary fatigue.

## Run the calibration coach

```bash
python src/calibration.py "Incline Dumbbell Press"
```

After each set enter:

- weight in kg
- reps
- RIR (reps in reserve)

Gym OS returns the next-load recommendation and its current confidence.

## Architecture

- `data/athlete_profile.json` — athlete profile and goals
- `data/exercise_library.csv` — exercise-specific rep ranges and load increments
- `data/training_log.csv` — one row per working set
- `data/body_metrics.csv` — optional bodyweight/waist trends
- `data/recovery_log.csv` — sleep, energy, soreness and stress
- `program/current_program.json` — current split
- `program/progression_rules.json` — coaching rules
- `src/calibration.py` — live set-by-set calibration coach
- `src/progression.py` — between-session progression engine
- `src/analytics.py` — training summaries
- `src/next_session.py` — next-session generator
- `tests/test_calibration.py` — calibration behavior tests

## Calibration confidence

Gym OS does not pretend to know an athlete from one set.

- 0 valid target sets → very low confidence
- 1 valid target set → low confidence
- 2 valid target sets → medium confidence / provisional calibration
- 3+ valid target sets → high confidence

Confidence can later evolve from a simple rule into a richer model using repeated exposures, rep drop-off, RIR accuracy and session history.

## Tests

```bash
python -m unittest discover -s tests
```

## Privacy

This repository is currently public. Do **not** commit sensitive body, health, injury, photo or recovery data while it remains public.

The `.gitignore` excludes local/private session files and photos, but already-tracked CSV templates are still visible.

## Existing progression engine

Outside calibration, Gym OS currently uses conservative double-progression logic:

1. Build reps inside the target range.
2. Add load only after repeated performance at the top of the range with acceptable RIR.
3. Hold or reduce load when performance deteriorates.
4. Use exercise-specific increments.

This is an early decision engine. The rules will evolve only when real training data gives us a reason to change them.

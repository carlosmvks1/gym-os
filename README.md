# Gym OS

**Personal Adaptive Training System**

Gym OS is a coach first and a workout tracker second. The tracker exists to give the coaching engine structured data to decide what should happen next.

## Core rule: user-seeded cold start

Gym OS does **not** invent the first load of an exercise it has never seen you perform.

```text
first exposure
      ↓
you choose exercise + load
      ↓
you perform set 1
      ↓
log weight × reps @ RIR
      ↓
Gym OS starts coaching
      ↓
increase / hold / decrease
```

Once real history exists, later versions can suggest the first load of the day. You will still be able to override it.

## Current milestone: persistent live sessions

Start a free session:

```bash
python src/session.py start "Calibration 01"
```

Log your first set:

```bash
python src/session.py add "Incline Dumbbell Press" 22.5 10 4
```

Gym OS responds immediately with the coaching decision for the next set.

Example:

```text
Logged: Incline Dumbbell Press — 22.5 kg × 10 @ RIR 4
Coach: The last set was too easy for calibration.
Next load: 25 kg
Confidence: very_low (0%)
```

Then log the next set:

```bash
python src/session.py add "Incline Dumbbell Press" 25 9 2
```

Check the session:

```bash
python src/session.py status
```

Finish it:

```bash
python src/session.py finish
```

Finished sessions are written to:

```text
data/private/training_log.csv
```

That folder is ignored by Git, so personal training data is not pushed to the public repository.

To discard the current session:

```bash
python src/session.py cancel
```

## Calibration logic

The goal is not to test maximal strength. It is to find a repeatable working zone.

```text
22.5 kg × 10 @ RIR 4
→ too easy
→ increase

25 kg × 9 @ RIR 2
→ target zone
→ hold

25 kg × 8 @ RIR 1
→ target zone confirmed
→ provisional calibration
```

Calibration confidence currently works as:

- 0 valid target sets → very low
- 1 valid target set → low
- 2 valid target sets → medium / provisional calibration
- 3+ valid target sets → high

This is intentionally simple and auditable. It can become more sophisticated once real repeated exposures exist.

## Architecture

- `data/exercise_library.csv` — exercise-specific targets and increments
- `data/live_session.json` — temporary active session, ignored by Git
- `data/private/training_log.csv` — personal history, ignored by Git
- `program/progression_rules.json` — coaching rules
- `src/session.py` — persistent live-session controller
- `src/calibration.py` — set-by-set coaching engine
- `src/progression.py` — between-session progression engine
- `src/analytics.py` — training summaries
- `src/next_session.py` — future-session generator
- `tests/` — behavior tests

Both the progression engine and analytics automatically use the private log when it exists.

## Tests

```bash
python -m unittest discover -s tests
```

## Privacy

This repository was created public. Do not commit body measurements, injuries, photos or other personal health data unless you deliberately make the repository private.

Gym OS currently keeps live and finished personal session data under ignored local paths by default.

## Product principle

Every feature should answer one question:

> Does this help make a better training decision now or later?

If not, it probably does not belong in the core product yet.


## PWA shell

A mobile-first PWA now lives in `docs/`.

It is intentionally simple:

- start a workout
- choose an exercise
- choose the first load yourself
- log weight × reps @ RIR
- receive immediate next-set coaching
- keep the active workout after refresh
- finish the session into local browser history
- work offline after the first load through a service worker

Personal session data is stored in the browser's local storage. It is not committed to the public GitHub repository.

### Publish with GitHub Pages

In the repository:

`Settings → Pages → Deploy from a branch → main → /docs`

Once Pages is enabled, the PWA can be opened from the phone browser and added to the Home Screen.

This PWA is only the interaction layer. The coaching rules remain deliberately simple while the decision engine is being validated.

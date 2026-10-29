export function confidence(validSetsAtCurrentLoad) {
  if (validSetsAtCurrentLoad >= 3) return { label: "high", score: 1.0 };
  if (validSetsAtCurrentLoad === 2) return { label: "medium", score: 0.67 };
  if (validSetsAtCurrentLoad === 1) return { label: "low", score: 0.33 };
  return { label: "very low", score: 0.0 };
}

function roundLoad(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isValidTargetSet(set, meta, rirMin, rirMax) {
  return (
    set.reps >= meta.repMin &&
    set.reps <= meta.repMax &&
    set.rir >= rirMin &&
    set.rir <= rirMax
  );
}

function confirmationStreak(sets, meta, rirMin, rirMax) {
  if (!sets.length) return 0;
  const currentWeight = sets.at(-1).weightKg;
  let streak = 0;

  for (let i = sets.length - 1; i >= 0; i -= 1) {
    const set = sets[i];
    if (Math.abs(set.weightKg - currentWeight) > 1e-9) break;
    if (!isValidTargetSet(set, meta, rirMin, rirMax)) break;
    streak += 1;
  }

  return streak;
}

export function decideNextSet(
  meta,
  sets,
  { targetRirMin = 1, targetRirMax = 3, confirmingSets = 2 } = {}
) {
  if (!meta) {
    return {
      action: "unknown_exercise",
      headline: "Exercise not configured yet.",
      text: "Add it to the exercise library before using coaching rules.",
      nextWeight: null,
      confidence: "very low",
      confidenceScore: 0,
      confirmingSets: 0,
      calibrated: false,
      shouldStop: false,
      meta: null,
    };
  }

  if (!sets.length) {
    return {
      action: "user_selects_first_load",
      headline: "You choose the first load.",
      text: `Target ${meta.repMin}–${meta.repMax} reps. Log the set and Gym OS takes over from there.`,
      nextWeight: null,
      confidence: "very low",
      confidenceScore: 0,
      confirmingSets: 0,
      calibrated: false,
      shouldStop: false,
      meta,
    };
  }

  const last = sets.at(-1);
  const weight = Number(last.weightKg);
  const reps = Number(last.reps);
  const rir = Number(last.rir);
  const increment = Number(meta.increment);

  if (![weight, reps, rir, increment].every(Number.isFinite) || weight <= 0 || reps <= 0 || rir < 0 || rir > 10 || increment <= 0) {
    throw new Error("Invalid set or exercise configuration.");
  }

  const streak = confirmationStreak(sets, meta, targetRirMin, targetRirMax);
  const currentConfidence = confidence(streak);

  let action;
  let nextWeight;
  let headline;
  let text;

  if (reps < meta.repMin && rir > targetRirMax) {
    action = "hold_load";
    nextWeight = weight;
    headline = "Keep the load; take the set further.";
    text = "You stopped below the rep range while still having plenty in reserve. This does not show that the load is too heavy.";
  } else if (reps < meta.repMin) {
    action = "decrease_load";
    nextWeight = Math.max(increment, roundLoad(weight - increment));
    headline = "Back the load down.";
    text = "You fell below the target rep range without excess reps in reserve.";
  } else if (reps > meta.repMax) {
    action = "increase_load";
    nextWeight = roundLoad(weight + increment);
    headline = "Increase the load.";
    text = rir < targetRirMin
      ? "You exceeded the rep range and also pushed too close to failure. Increase the load next time, but keep calibration sets controlled."
      : "You exceeded the target rep range. Move up one exercise-specific increment.";
  } else if (rir < targetRirMin) {
    action = "decrease_load";
    nextWeight = Math.max(increment, roundLoad(weight - increment));
    headline = "Back the load down.";
    text = "Rep count was acceptable, but the set was harder than the calibration target.";
  } else if (rir > targetRirMax) {
    action = "increase_load";
    nextWeight = roundLoad(weight + increment);
    headline = "Increase the load.";
    text = "Rep count was acceptable, but you had too many reps in reserve.";
  } else {
    action = "hold_load";
    nextWeight = weight;
    headline = streak >= confirmingSets
      ? "Working load provisionally calibrated."
      : "Hold the load.";
    text = streak >= confirmingSets
      ? "You repeated useful work at the same load inside the target zone. Stop calibrating this exercise for today."
      : "That set landed in the useful zone. Repeat the same load once to confirm it.";
  }

  const calibrated = action === "hold_load" && streak >= confirmingSets;

  return {
    action,
    headline,
    text,
    nextWeight,
    confidence: currentConfidence.label,
    confidenceScore: currentConfidence.score,
    confirmingSets: streak,
    calibrated,
    shouldStop: calibrated,
    meta,
  };
}

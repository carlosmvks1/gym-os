export function decideExerciseContinuation({
  coachDecision,
  sets,
  maxCalibrationSets = 5,
}) {
  const totalSets = Array.isArray(sets) ? sets.length : 0;

  if (!coachDecision) {
    return {
      action: "continue",
      status: "not_started",
      shouldStop: false,
      reason: "No coaching decision yet.",
    };
  }

  if (coachDecision.shouldStop) {
    return {
      action: "complete_exercise",
      status: "calibrated",
      shouldStop: true,
      reason: "Calibration target confirmed. Additional calibration sets are not needed today.",
    };
  }

  if (totalSets >= maxCalibrationSets) {
    return {
      action: "complete_exercise",
      status: "unresolved",
      shouldStop: true,
      reason: "Calibration cap reached. Stop this exercise rather than adding fatigue just to force certainty.",
    };
  }

  return {
    action: "continue",
    status: "calibrating",
    shouldStop: false,
    reason: "Continue calibration with the next coached set.",
  };
}

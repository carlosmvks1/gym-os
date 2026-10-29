import test from "node:test";
import assert from "node:assert/strict";
import { decideExerciseContinuation } from "../docs/exercise-policy.js";

test("calibrated exercise should stop", () => {
  const result = decideExerciseContinuation({
    coachDecision: { shouldStop: true },
    sets: [{}, {}, {}],
  });
  assert.equal(result.shouldStop, true);
  assert.equal(result.status, "calibrated");
});

test("unfinished calibration continues below cap", () => {
  const result = decideExerciseContinuation({
    coachDecision: { shouldStop: false },
    sets: [{}, {}],
  });
  assert.equal(result.shouldStop, false);
  assert.equal(result.status, "calibrating");
});

test("calibration stops at guardrail cap", () => {
  const result = decideExerciseContinuation({
    coachDecision: { shouldStop: false },
    sets: [{}, {}, {}, {}, {}],
  });
  assert.equal(result.shouldStop, true);
  assert.equal(result.status, "unresolved");
});

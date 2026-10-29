import test from "node:test";
import assert from "node:assert/strict";
import { decideNextSet } from "../docs/coach.js";

const meta = { exercise: "Incline Dumbbell Press", repMin: 6, repMax: 10, increment: 2.5 };

test("cold start is user-seeded", () => {
  const result = decideNextSet(meta, []);
  assert.equal(result.action, "user_selects_first_load");
  assert.equal(result.nextWeight, null);
});

test("easy set increases exact relative increment", () => {
  const result = decideNextSet(meta, [{ weightKg: 22.5, reps: 10, rir: 4 }]);
  assert.equal(result.action, "increase_load");
  assert.equal(result.nextWeight, 25);
});

test("two valid sets at same load calibrate and stop", () => {
  const result = decideNextSet(meta, [
    { weightKg: 25, reps: 9, rir: 2 },
    { weightKg: 25, reps: 8, rir: 1 },
  ]);
  assert.equal(result.calibrated, true);
  assert.equal(result.shouldStop, true);
  assert.equal(result.confirmingSets, 2);
});

test("valid sets at different loads do not confirm each other", () => {
  const result = decideNextSet(meta, [
    { weightKg: 22.5, reps: 9, rir: 2 },
    { weightKg: 25, reps: 8, rir: 2 },
  ]);
  assert.equal(result.calibrated, false);
  assert.equal(result.confirmingSets, 1);
});

test("low reps with lots in reserve holds load", () => {
  const result = decideNextSet(meta, [{ weightKg: 25, reps: 5, rir: 4 }]);
  assert.equal(result.action, "hold_load");
  assert.equal(result.nextWeight, 25);
});

test("above rep range increases load even after overshooting effort", () => {
  const result = decideNextSet(meta, [{ weightKg: 25, reps: 15, rir: 0 }]);
  assert.equal(result.action, "increase_load");
  assert.equal(result.nextWeight, 27.5);
});

test("broad input sweep always returns a positive finite next load after set 1", () => {
  for (let reps = 1; reps <= 30; reps += 1) {
    for (let rir = 0; rir <= 10; rir += 0.5) {
      const result = decideNextSet(meta, [{ weightKg: 22.5, reps, rir }]);
      assert.equal(Number.isFinite(result.nextWeight), true);
      assert.equal(result.nextWeight > 0, true);
    }
  }
});

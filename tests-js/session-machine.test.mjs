import test from "node:test";
import assert from "node:assert/strict";
import {
  initialSessionState,
  startSession,
  logSet,
  finishSession,
  cancelSession,
  restoreSession,
} from "../docs/session-machine.js";

test("idle -> active", () => {
  const next = startSession(initialSessionState, {
    id: "s1",
    name: "Workout",
    startedAt: "2026-10-29T12:00:00Z",
  });

  assert.equal(next.value, "active");
  assert.equal(next.session.sets.length, 0);
});

test("cannot start a second active session", () => {
  const active = startSession(initialSessionState, {
    id: "s1",
    name: "Workout",
    startedAt: "2026-10-29T12:00:00Z",
  });

  assert.throws(
    () =>
      startSession(active, {
        id: "s2",
        name: "Second",
        startedAt: "2026-10-29T13:00:00Z",
      }),
    /another session is active/
  );
});

test("logging sets numbers them per exercise", () => {
  let snapshot = startSession(initialSessionState, {
    id: "s1",
    name: "Workout",
    startedAt: "2026-10-29T12:00:00Z",
  });

  snapshot = logSet(snapshot, {
    exercise: "Cable Curl",
    weightKg: 10,
    reps: 12,
    rir: 2,
    loggedAt: "2026-10-29T12:10:00Z",
  });

  snapshot = logSet(snapshot, {
    exercise: "Lat Pulldown",
    weightKg: 50,
    reps: 10,
    rir: 2,
    loggedAt: "2026-10-29T12:15:00Z",
  });

  snapshot = logSet(snapshot, {
    exercise: "Cable Curl",
    weightKg: 10,
    reps: 11,
    rir: 1,
    loggedAt: "2026-10-29T12:20:00Z",
  });

  assert.equal(snapshot.session.sets[0].setNumber, 1);
  assert.equal(snapshot.session.sets[1].setNumber, 1);
  assert.equal(snapshot.session.sets[2].setNumber, 2);
});

test("cannot log into idle state", () => {
  assert.throws(
    () =>
      logSet(initialSessionState, {
        exercise: "Cable Curl",
        weightKg: 10,
        reps: 12,
        rir: 2,
      }),
    /not active/
  );
});

test("cannot finish empty active session", () => {
  const active = startSession(initialSessionState, {
    id: "s1",
    name: "Workout",
    startedAt: "2026-10-29T12:00:00Z",
  });

  assert.throws(() => finishSession(active, "2026-10-29T13:00:00Z"), /empty workout/);
});

test("finish produces completed session and returns idle", () => {
  let active = startSession(initialSessionState, {
    id: "s1",
    name: "Workout",
    startedAt: "2026-10-29T12:00:00Z",
  });

  active = logSet(active, {
    exercise: "Cable Curl",
    weightKg: 10,
    reps: 12,
    rir: 2,
    loggedAt: "2026-10-29T12:10:00Z",
  });

  const result = finishSession(active, "2026-10-29T13:00:00Z");

  assert.equal(result.snapshot.value, "idle");
  assert.equal(result.completedSession.finishedAt, "2026-10-29T13:00:00Z");
  assert.equal(result.completedSession.sets.length, 1);
});

test("cancel discards active session", () => {
  const active = startSession(initialSessionState, {
    id: "s1",
    name: "Workout",
    startedAt: "2026-10-29T12:00:00Z",
  });

  assert.deepEqual(cancelSession(active), initialSessionState);
});

test("stored active session can be restored", () => {
  const restored = restoreSession({
    id: "saved",
    name: "Saved Workout",
    startedAt: "2026-10-29T12:00:00Z",
    sets: [],
  });

  assert.equal(restored.value, "active");
  assert.equal(restored.session.id, "saved");
});

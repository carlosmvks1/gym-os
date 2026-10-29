export const initialSessionState = Object.freeze({
  value: "idle",
  session: null,
});

function cloneSession(session) {
  return {
    ...session,
    sets: session.sets.map((set) => ({ ...set })),
  };
}

function assertActive(snapshot) {
  if (snapshot.value !== "active" || !snapshot.session) {
    throw new Error("Session is not active.");
  }
}

function validateSet(set) {
  if (!set.exercise) throw new Error("Exercise is required.");
  if (!Number.isFinite(set.weightKg) || set.weightKg <= 0) {
    throw new Error("Weight must be positive.");
  }
  if (!Number.isInteger(set.reps) || set.reps <= 0) {
    throw new Error("Reps must be a positive integer.");
  }
  if (!Number.isFinite(set.rir) || set.rir < 0 || set.rir > 10) {
    throw new Error("RIR must be between 0 and 10.");
  }
}

export function startSession(snapshot, { id, name, startedAt }) {
  if (snapshot.value !== "idle") {
    throw new Error("Cannot start a session while another session is active.");
  }

  return {
    value: "active",
    session: {
      id,
      name,
      startedAt,
      sets: [],
    },
  };
}

export function logSet(snapshot, set) {
  assertActive(snapshot);
  validateSet(set);

  const session = cloneSession(snapshot.session);
  const setNumber =
    session.sets.filter((item) => item.exercise === set.exercise).length + 1;

  session.sets.push({
    ...set,
    setNumber,
  });

  return {
    value: "active",
    session,
  };
}

export function finishSession(snapshot, finishedAt) {
  assertActive(snapshot);

  if (snapshot.session.sets.length === 0) {
    throw new Error("Cannot finish an empty workout.");
  }

  const completedSession = {
    ...cloneSession(snapshot.session),
    finishedAt,
  };

  return {
    snapshot: { ...initialSessionState },
    completedSession,
  };
}

export function cancelSession(snapshot) {
  assertActive(snapshot);
  return { ...initialSessionState };
}

export function restoreSession(activeSession) {
  if (!activeSession) return { ...initialSessionState };

  if (!Array.isArray(activeSession.sets)) {
    throw new Error("Stored session is invalid.");
  }

  return {
    value: "active",
    session: cloneSession(activeSession),
  };
}

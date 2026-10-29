import { decideNextSet } from "./coach.js";
import { loadAppState, requestPersistentStorage, saveAppState } from "./storage.js";
import { decideExerciseContinuation } from "./exercise-policy.js";
import {
  formatRest,
  recommendedRestSeconds,
  remainingRestSeconds,
} from "./rest.js";
import {
  initialSessionState,
  startSession,
  logSet,
  finishSession,
  cancelSession,
  restoreSession,
} from "./session-machine.js";

const state = {
  exercises: [],
  sessionMachine: { ...initialSessionState },
  history: [],
  storageMode: "initializing",
  deferredInstallPrompt: null,
};

function activeSession() {
  return state.sessionMachine.session;
}

const els = {
  homeView: document.querySelector("#homeView"),
  workoutView: document.querySelector("#workoutView"),
  startWorkoutBtn: document.querySelector("#startWorkoutBtn"),
  finishWorkoutBtn: document.querySelector("#finishWorkoutBtn"),
  cancelWorkoutBtn: document.querySelector("#cancelWorkoutBtn"),
  installBtn: document.querySelector("#installBtn"),
  exerciseSelect: document.querySelector("#exerciseSelect"),
  weightInput: document.querySelector("#weightInput"),
  repsInput: document.querySelector("#repsInput"),
  rirInput: document.querySelector("#rirInput"),
  setForm: document.querySelector("#setForm"),
  setList: document.querySelector("#setList"),
  sessionTitle: document.querySelector("#sessionTitle"),
  sessionMeta: document.querySelector("#sessionMeta"),
  coachHeadline: document.querySelector("#coachHeadline"),
  coachText: document.querySelector("#coachText"),
  coachMetrics: document.querySelector("#coachMetrics"),
  exerciseStatus: document.querySelector("#exerciseStatus"),
  restPanel: document.querySelector("#restPanel"),
  restTimer: document.querySelector("#restTimer"),
  restText: document.querySelector("#restText"),
  historyList: document.querySelector("#historyList"),
  sessionCount: document.querySelector("#sessionCount"),
  offlineBadge: document.querySelector("#offlineBadge"),
};

let restIntervalId = null;

function stopRestTimer() {
  if (restIntervalId !== null) {
    clearInterval(restIntervalId);
    restIntervalId = null;
  }
  els.restPanel.classList.add("hidden");
}

function renderRestTimer(meta, sets, policy) {
  stopRestTimer();

  if (!sets.length || policy.shouldStop) return;

  const lastSet = sets.at(-1);
  const recommendedSeconds = recommendedRestSeconds(meta);

  const update = () => {
    const remaining = remainingRestSeconds({
      loggedAt: lastSet.loggedAt,
      recommendedSeconds,
    });

    els.restTimer.textContent = remaining > 0 ? formatRest(remaining) : "Ready";
    els.restText.textContent =
      remaining > 0
        ? `Suggested recovery: ${formatRest(recommendedSeconds)}. You can override it.`
        : "Suggested recovery reached. Start when you feel ready.";
  };

  els.restPanel.classList.remove("hidden");
  update();
  restIntervalId = setInterval(update, 1000);
}

async function saveState() {
  const result = await saveAppState({
    activeSession: activeSession(),
    history: state.history,
  });
  state.storageMode = result.storageMode;
}

function nowIso() {
  return new Date().toISOString();
}

function localDateLabel(iso) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

async function createSession() {
  state.sessionMachine = startSession(state.sessionMachine, {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name: `Workout · ${localDateLabel(nowIso())}`,
    startedAt: nowIso(),
  });
  await saveState();
  render();
}

function getExerciseMeta(name) {
  return state.exercises.find((item) => item.exercise === name);
}

function currentExerciseSets(name) {
  const session = activeSession();
  if (!session) return [];
  return session.sets.filter((item) => item.exercise === name);
}

function coachDecision(exerciseName, sets) {
  return decideNextSet(getExerciseMeta(exerciseName), sets);
}

async function addSet(event) {
  event.preventDefault();
  if (state.sessionMachine.value !== "active") return;

  const exercise = els.exerciseSelect.value;
  const weightKg = Number(els.weightInput.value);
  const reps = Number(els.repsInput.value);
  const rir = Number(els.rirInput.value);

  if (
    !exercise ||
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    !Number.isInteger(reps) ||
    reps <= 0 ||
    !Number.isFinite(rir) ||
    rir < 0 ||
    rir > 10
  ) {
    return;
  }

  state.sessionMachine = logSet(state.sessionMachine, {
    exercise,
    weightKg,
    reps,
    rir,
    loggedAt: nowIso(),
  });

  const decision = coachDecision(exercise, currentExerciseSets(exercise));

  if (decision.nextWeight !== null) {
    els.weightInput.value = String(decision.nextWeight);
  }
  els.repsInput.value = "";
  els.rirInput.value = "";

  await saveState();
  renderWorkout(decision);
  els.repsInput.focus();
}

async function finishWorkout() {
  const session = activeSession();
  if (!session || session.sets.length === 0) return;

  stopRestTimer();
  const result = finishSession(state.sessionMachine, nowIso());
  state.history.unshift(result.completedSession);
  state.history = state.history.slice(0, 100);
  state.sessionMachine = result.snapshot;

  await saveState();
  render();
}

async function cancelWorkout() {
  if (state.sessionMachine.value !== "active") return;
  const confirmed = window.confirm("Discard this active session?");
  if (!confirmed) return;

  stopRestTimer();
  state.sessionMachine = cancelSession(state.sessionMachine);
  await saveState();
  render();
}

function render() {
  const active = state.sessionMachine.value === "active";
  els.homeView.classList.toggle("hidden", active);
  els.workoutView.classList.toggle("hidden", !active);

  if (active) {
    renderWorkout();
  } else {
    renderHistory();
  }
}

function renderWorkout(decision = null) {
  const session = activeSession();
  if (!session) return;

  els.sessionTitle.textContent = session.name;
  els.sessionMeta.textContent = `${session.sets.length} set${session.sets.length === 1 ? "" : "s"} logged`;

  const selectedExercise = els.exerciseSelect.value || state.exercises[0]?.exercise;
  const sets = selectedExercise ? currentExerciseSets(selectedExercise) : [];
  const currentDecision =
    decision || (selectedExercise ? coachDecision(selectedExercise, sets) : null);

  if (currentDecision) {
    els.coachHeadline.textContent = currentDecision.headline;
    els.coachText.textContent = currentDecision.text;

    const metrics = [];
    const meta = currentDecision.meta || getExerciseMeta(selectedExercise);
    if (meta) metrics.push(`Target: ${meta.repMin}–${meta.repMax} reps`);
    metrics.push("RIR: 1–3");
    metrics.push(`Confidence: ${currentDecision.confidence}`);
    if (currentDecision.nextWeight !== null) {
      metrics.push(`Next: ${currentDecision.nextWeight} kg`);
    }

    els.coachMetrics.innerHTML = metrics
      .map((item) => `<span class="metric">${item}</span>`)
      .join("");

    const policy = decideExerciseContinuation({
      coachDecision: currentDecision,
      sets,
    });

    if (policy.status === "calibrated") {
      els.exerciseStatus.textContent = "Exercise complete · working load calibrated";
      els.exerciseStatus.classList.add("complete");
    } else if (policy.status === "unresolved") {
      els.exerciseStatus.textContent = "Exercise complete · calibration unresolved";
      els.exerciseStatus.classList.add("complete");
    } else if (sets.length > 0) {
      els.exerciseStatus.textContent = `Calibrating · ${sets.length}/5 sets maximum`;
      els.exerciseStatus.classList.remove("complete");
    } else {
      els.exerciseStatus.textContent = "Cold start · you choose set 1";
      els.exerciseStatus.classList.remove("complete");
    }

    renderRestTimer(meta, sets, policy);
  }

  renderSets();
}

function renderSets() {
  const session = activeSession();
  if (!session || session.sets.length === 0) {
    els.setList.className = "set-list empty-state";
    els.setList.textContent = "Your sets will appear here.";
    return;
  }

  els.setList.className = "set-list";

  const grouped = new Map();
  for (const item of session.sets) {
    if (!grouped.has(item.exercise)) grouped.set(item.exercise, []);
    grouped.get(item.exercise).push(item);
  }

  els.setList.innerHTML = [...grouped.entries()]
    .map(
      ([exercise, sets]) => `
        <div class="exercise-block">
          <h3>${exercise}</h3>
          ${sets
            .map(
              (set) => `
                <div class="set-row">
                  <span class="set-index">S${set.setNumber}</span>
                  <span class="set-main">${set.weightKg} kg × ${set.reps}</span>
                  <span class="set-rir">RIR ${set.rir}</span>
                </div>
              `
            )
            .join("")}
        </div>
      `
    )
    .join("");
}

function renderHistory() {
  els.sessionCount.textContent = `${state.history.length} total`;

  if (state.history.length === 0) {
    els.historyList.className = "history-list empty-state";
    els.historyList.textContent = "No sessions yet.";
    return;
  }

  els.historyList.className = "history-list";
  els.historyList.innerHTML = state.history
    .slice(0, 5)
    .map((session) => {
      const exercises = new Set(session.sets.map((set) => set.exercise)).size;
      return `
        <div class="history-item">
          <div>
            <strong>${session.name}</strong>
            <div class="muted">${session.sets.length} sets · ${exercises} exercises</div>
          </div>
          <span class="muted">${localDateLabel(session.startedAt)}</span>
        </div>
      `;
    })
    .join("");
}

function populateExercises() {
  els.exerciseSelect.innerHTML = state.exercises
    .map((item) => `<option value="${item.exercise}">${item.exercise}</option>`)
    .join("");
}

function updateOnlineStatus() {
  els.offlineBadge.classList.toggle("hidden", navigator.onLine);
}

async function init() {
  const saved = await loadAppState();
  state.sessionMachine = restoreSession(saved.activeSession);
  state.history = saved.history;
  state.storageMode = saved.storageMode;

  try {
    const response = await fetch("./exercises.json");
    state.exercises = await response.json();
  } catch {
    state.exercises = [];
  }

  populateExercises();
  render();
  updateOnlineStatus();

  requestPersistentStorage();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
  }
}

els.startWorkoutBtn.addEventListener("click", createSession);
els.finishWorkoutBtn.addEventListener("click", finishWorkout);
els.cancelWorkoutBtn.addEventListener("click", cancelWorkout);
els.setForm.addEventListener("submit", addSet);

els.exerciseSelect.addEventListener("change", () => {
  const sets = currentExerciseSets(els.exerciseSelect.value);
  const decision = coachDecision(els.exerciseSelect.value, sets);
  renderWorkout(decision);

  if (sets.length > 0 && decision.nextWeight !== null) {
    els.weightInput.value = String(decision.nextWeight);
  } else {
    els.weightInput.value = "";
  }
});

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.deferredInstallPrompt = event;
  els.installBtn.classList.remove("hidden");
});

els.installBtn.addEventListener("click", async () => {
  if (!state.deferredInstallPrompt) return;
  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice;
  state.deferredInstallPrompt = null;
  els.installBtn.classList.add("hidden");
});

init();

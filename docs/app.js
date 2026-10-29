import { decideNextSet } from "./coach.js";

const ACTIVE_KEY = "gymos.activeSession.v1";
const HISTORY_KEY = "gymos.history.v1";

const state = {
  exercises: [],
  activeSession: loadJson(ACTIVE_KEY),
  history: loadJson(HISTORY_KEY) || [],
  deferredInstallPrompt: null,
};

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
  historyList: document.querySelector("#historyList"),
  sessionCount: document.querySelector("#sessionCount"),
  offlineBadge: document.querySelector("#offlineBadge"),
};

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function saveState() {
  if (state.activeSession) {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(state.activeSession));
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
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

function createSession() {
  state.activeSession = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name: `Workout · ${localDateLabel(nowIso())}`,
    startedAt: nowIso(),
    sets: [],
  };
  saveState();
  render();
}

function getExerciseMeta(name) {
  return state.exercises.find((item) => item.exercise === name);
}

function currentExerciseSets(name) {
  if (!state.activeSession) return [];
  return state.activeSession.sets.filter((item) => item.exercise === name);
}

function coachDecision(exerciseName, sets) {
  return decideNextSet(getExerciseMeta(exerciseName), sets);
}
function addSet(event) {
  event.preventDefault();
  if (!state.activeSession) return;

  const exercise = els.exerciseSelect.value;
  const weightKg = Number(els.weightInput.value);
  const reps = Number(els.repsInput.value);
  const rir = Number(els.rirInput.value);

  if (!exercise || !Number.isFinite(weightKg) || weightKg <= 0 || !Number.isFinite(reps) || reps <= 0 || !Number.isFinite(rir) || rir < 0 || rir > 10) {
    return;
  }

  const prior = currentExerciseSets(exercise);

  state.activeSession.sets.push({
    exercise,
    setNumber: prior.length + 1,
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

  saveState();
  renderWorkout(decision);
  els.repsInput.focus();
}

function finishWorkout() {
  if (!state.activeSession) return;
  if (state.activeSession.sets.length === 0) return;

  state.activeSession.finishedAt = nowIso();
  state.history.unshift(state.activeSession);
  state.history = state.history.slice(0, 100);
  state.activeSession = null;
  saveState();
  render();
}

function cancelWorkout() {
  if (!state.activeSession) return;
  const confirmed = window.confirm("Discard this active session?");
  if (!confirmed) return;
  state.activeSession = null;
  saveState();
  render();
}

function render() {
  const active = Boolean(state.activeSession);
  els.homeView.classList.toggle("hidden", active);
  els.workoutView.classList.toggle("hidden", !active);

  if (active) {
    renderWorkout();
  } else {
    renderHistory();
  }
}

function renderWorkout(decision = null) {
  const session = state.activeSession;
  if (!session) return;

  els.sessionTitle.textContent = session.name;
  els.sessionMeta.textContent = `${session.sets.length} set${session.sets.length === 1 ? "" : "s"} logged`;

  const selectedExercise = els.exerciseSelect.value || state.exercises[0]?.exercise;
  const sets = selectedExercise ? currentExerciseSets(selectedExercise) : [];
  const currentDecision = decision || (selectedExercise ? coachDecision(selectedExercise, sets) : null);

  if (currentDecision) {
    els.coachHeadline.textContent = currentDecision.headline;
    els.coachText.textContent = currentDecision.text;

    const metrics = [];
    const meta = currentDecision.meta || getExerciseMeta(selectedExercise);
    if (meta) metrics.push(`Target: ${meta.repMin}–${meta.repMax} reps`);
    metrics.push("RIR: 1–3");
    metrics.push(`Confidence: ${currentDecision.confidence}`);
    if (currentDecision.nextWeight !== null) metrics.push(`Next: ${currentDecision.nextWeight} kg`);

    els.coachMetrics.innerHTML = metrics.map((item) => `<span class="metric">${item}</span>`).join("");
  }

  renderSets();
}

function renderSets() {
  const session = state.activeSession;
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

  els.setList.innerHTML = [...grouped.entries()].map(([exercise, sets]) => `
    <div class="exercise-block">
      <h3>${exercise}</h3>
      ${sets.map((set) => `
        <div class="set-row">
          <span class="set-index">S${set.setNumber}</span>
          <span class="set-main">${set.weightKg} kg × ${set.reps}</span>
          <span class="set-rir">RIR ${set.rir}</span>
        </div>
      `).join("")}
    </div>
  `).join("");
}

function renderHistory() {
  els.sessionCount.textContent = `${state.history.length} total`;

  if (state.history.length === 0) {
    els.historyList.className = "history-list empty-state";
    els.historyList.textContent = "No sessions yet.";
    return;
  }

  els.historyList.className = "history-list";
  els.historyList.innerHTML = state.history.slice(0, 5).map((session) => {
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
  }).join("");
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
  try {
    const response = await fetch("./exercises.json");
    state.exercises = await response.json();
  } catch {
    state.exercises = [];
  }

  populateExercises();
  render();
  updateOnlineStatus();

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

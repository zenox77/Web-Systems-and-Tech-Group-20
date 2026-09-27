const STORAGE_KEY = "tiktak_state_v1";
const defaultState = {
  projects: ["Web Systems Project", "Study", "Personal"],
  entries: [],
  timer: {
    status: "idle",
    project: "Web Systems Project",
    note: "",
    startedAt: null,
    elapsedMs: 0
  }
};

const els = {
  currentDate: document.getElementById("currentDate"),
  totalToday: document.getElementById("totalToday"),
  sessionsToday: document.getElementById("sessionsToday"),
  topProject: document.getElementById("topProject"),
  timerDisplay: document.getElementById("timerDisplay"),
  timerStatus: document.getElementById("timerStatus"),
  timerProject: document.getElementById("timerProject"),
  timerNote: document.getElementById("timerNote"),
  startTimerBtn: document.getElementById("startTimerBtn"),
  pauseTimerBtn: document.getElementById("pauseTimerBtn"),
  stopTimerBtn: document.getElementById("stopTimerBtn"),
  manualForm: document.getElementById("manualForm"),
  manualDate: document.getElementById("manualDate"),
  manualProject: document.getElementById("manualProject"),
  manualStart: document.getElementById("manualStart"),
  manualEnd: document.getElementById("manualEnd"),
  manualNote: document.getElementById("manualNote"),
  manualError: document.getElementById("manualError"),
  projectForm: document.getElementById("projectForm"),
  projectName: document.getElementById("projectName"),
  projectError: document.getElementById("projectError"),
  projectChips: document.getElementById("projectChips"),
  entryFilter: document.getElementById("entryFilter"),
  entryTableBody: document.getElementById("entryTableBody"),
  emptyState: document.getElementById("emptyState"),
  clearEntriesBtn: document.getElementById("clearEntriesBtn"),
  toast: document.getElementById("toast")
};

let state = loadState();
let timerInterval = null;
let toastTimeout = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.projects) || !Array.isArray(saved.entries)) {
      return structuredClone(defaultState);
    }
    return {
      projects: saved.projects.length ? saved.projects : [...defaultState.projects],
      entries: saved.entries,
      timer: { ...defaultState.timer, ...(saved.timer || {}) }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function prettyDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

function formatDuration(totalSeconds, compact = false) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (!compact) {
    return [hours, minutes, seconds].map(v => String(v).padStart(2, "0")).join(":");
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function getTimerElapsedMs() {
  let elapsed = Number(state.timer.elapsedMs || 0);
  if (state.timer.status === "running" && state.timer.startedAt) {
    elapsed += Date.now() - Number(state.timer.startedAt);
  }
  return Math.max(0, elapsed);
}

function updateTimerDisplay() {
  const seconds = Math.floor(getTimerElapsedMs() / 1000);
  els.timerDisplay.textContent = formatDuration(seconds);
}

function setTimerUI() {
  const status = state.timer.status;
  els.timerProject.value = state.timer.project || state.projects[0];
  els.timerNote.value = state.timer.note || "";
  els.timerStatus.className = "status-badge";

  if (status === "running") {
    els.timerStatus.textContent = "Running";
    els.timerStatus.classList.add("running");
    els.startTimerBtn.textContent = "Running…";
    els.startTimerBtn.disabled = true;
    els.pauseTimerBtn.disabled = false;
    els.pauseTimerBtn.textContent = "Pause";
    els.stopTimerBtn.disabled = false;
    els.timerProject.disabled = true;
    els.timerNote.disabled = true;
  } else if (status === "paused") {
    els.timerStatus.textContent = "Paused";
    els.timerStatus.classList.add("paused");
    els.startTimerBtn.textContent = "Resume";
    els.startTimerBtn.disabled = false;
    els.pauseTimerBtn.disabled = true;
    els.pauseTimerBtn.textContent = "Pause";
    els.stopTimerBtn.disabled = false;
    els.timerProject.disabled = true;
    els.timerNote.disabled = true;
  } else {
    els.timerStatus.textContent = "Ready";
    els.startTimerBtn.textContent = "Start timer";
    els.startTimerBtn.disabled = false;
    els.pauseTimerBtn.disabled = true;
    els.stopTimerBtn.disabled = true;
    els.timerProject.disabled = false;
    els.timerNote.disabled = false;
  }

  clearInterval(timerInterval);
  if (status === "running") {
    timerInterval = setInterval(updateTimerDisplay, 500);
  }
  updateTimerDisplay();
}

function renderProjectOptions() {
  const currentTimer = state.timer.project;
  const currentManual = els.manualProject.value;
  const currentFilter = els.entryFilter.value;

  const options = state.projects.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  els.timerProject.innerHTML = options;
  els.manualProject.innerHTML = options;
  els.entryFilter.innerHTML = `<option value="all">All projects</option>${options}`;

  if (state.projects.includes(currentTimer)) els.timerProject.value = currentTimer;
  if (state.projects.includes(currentManual)) els.manualProject.value = currentManual;
  if (currentFilter === "all" || state.projects.includes(currentFilter)) els.entryFilter.value = currentFilter || "all";
}

function renderProjects() {
  els.projectChips.innerHTML = state.projects.map(project => `
    <span class="project-chip">
      ${escapeHtml(project)}
      <button type="button" aria-label="Remove ${escapeHtml(project)}" data-remove-project="${encodeURIComponent(project)}">×</button>
    </span>
  `).join("");
}

function renderEntries() {
  const filter = els.entryFilter.value || "all";
  const visible = state.entries
    .filter(entry => filter === "all" || entry.project === filter)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  els.entryTableBody.innerHTML = visible.map(entry => `
    <tr>
      <td>${escapeHtml(prettyDate(entry.date))}</td>
      <td><strong>${escapeHtml(entry.project)}</strong></td>
      <td>${escapeHtml(entry.note || "No description")}</td>
      <td class="duration">${formatDuration(entry.seconds, true)}</td>
      <td><span class="source-tag">${entry.source === "timer" ? "Timer" : "Manual"}</span></td>
      <td><button class="delete-btn" type="button" data-delete-entry="${entry.id}" aria-label="Delete time entry">Delete</button></td>
    </tr>
  `).join("");

  els.emptyState.classList.toggle("show", visible.length === 0);
  els.clearEntriesBtn.disabled = state.entries.length === 0;
}

function renderSummary() {
  const today = localDateString();
  const todaysEntries = state.entries.filter(entry => entry.date === today);
  const totalSeconds = todaysEntries.reduce((sum, entry) => sum + Number(entry.seconds || 0), 0);
  els.totalToday.textContent = formatDuration(totalSeconds, true);
  els.sessionsToday.textContent = String(todaysEntries.length);

  const totalsByProject = {};
  todaysEntries.forEach(entry => {
    totalsByProject[entry.project] = (totalsByProject[entry.project] || 0) + Number(entry.seconds || 0);
  });
  const top = Object.entries(totalsByProject).sort((a, b) => b[1] - a[1])[0];
  els.topProject.textContent = top ? top[0] : "—";
  els.topProject.title = top ? top[0] : "";
}

function renderAll() {
  renderProjectOptions();
  renderProjects();
  renderEntries();
  renderSummary();
  setTimerUI();
}

function startOrResumeTimer() {
  if (state.timer.status === "paused") {
    state.timer.status = "running";
    state.timer.startedAt = Date.now();
    saveState();
    setTimerUI();
    showToast("Timer resumed.");
    return;
  }

  state.timer = {
    status: "running",
    project: els.timerProject.value,
    note: els.timerNote.value.trim(),
    startedAt: Date.now(),
    elapsedMs: 0
  };
  saveState();
  setTimerUI();
  showToast("Timer started.");
}

function pauseTimer() {
  if (state.timer.status !== "running") return;
  state.timer.elapsedMs = getTimerElapsedMs();
  state.timer.startedAt = null;
  state.timer.status = "paused";
  saveState();
  setTimerUI();
  showToast("Timer paused.");
}

function stopTimer() {
  if (state.timer.status === "idle") return;
  const elapsedSeconds = Math.max(1, Math.round(getTimerElapsedMs() / 1000));
  const now = new Date();
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `entry-${Date.now()}`,
    date: localDateString(now),
    project: state.timer.project,
    note: state.timer.note || "Timed session",
    seconds: elapsedSeconds,
    source: "timer",
    createdAt: now.toISOString()
  };
  state.entries.push(entry);
  state.timer = { ...defaultState.timer, project: state.timer.project || state.projects[0] };
  saveState();
  renderAll();
  showToast("Time session saved.");
}

function addManualEntry(event) {
  event.preventDefault();
  els.manualError.textContent = "";

  const date = els.manualDate.value;
  const project = els.manualProject.value;
  const start = els.manualStart.value;
  const end = els.manualEnd.value;

  if (!date || !project || !start || !end) {
    els.manualError.textContent = "Please complete the date, project, start time, and end time.";
    return;
  }

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  if (endMinutes <= startMinutes) {
    els.manualError.textContent = "End time must be later than start time for the same day.";
    return;
  }

  state.entries.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `entry-${Date.now()}`,
    date,
    project,
    note: els.manualNote.value.trim() || "Manual time entry",
    seconds: (endMinutes - startMinutes) * 60,
    source: "manual",
    createdAt: new Date().toISOString()
  });

  saveState();
  els.manualForm.reset();
  els.manualDate.value = localDateString();
  renderAll();
  showToast("Manual time entry saved.");
}

function addProject(event) {
  event.preventDefault();
  els.projectError.textContent = "";
  const name = els.projectName.value.trim().replace(/\s+/g, " ");

  if (!name) {
    els.projectError.textContent = "Enter a project name.";
    return;
  }
  if (state.projects.some(p => p.toLowerCase() === name.toLowerCase())) {
    els.projectError.textContent = "That project already exists.";
    return;
  }

  state.projects.push(name);
  saveState();
  els.projectName.value = "";
  renderAll();
  els.timerProject.value = name;
  showToast(`Project “${name}” added.`);
}

function removeProject(project) {
  if (state.projects.length === 1) {
    els.projectError.textContent = "At least one project must remain.";
    return;
  }
  if (state.timer.status !== "idle" && state.timer.project === project) {
    els.projectError.textContent = "Stop the active timer before removing this project.";
    return;
  }
  if (state.entries.some(entry => entry.project === project)) {
    els.projectError.textContent = "This project has saved time entries, so it cannot be removed yet.";
    return;
  }

  state.projects = state.projects.filter(p => p !== project);
  if (state.timer.project === project) state.timer.project = state.projects[0];
  saveState();
  renderAll();
  showToast(`Project “${project}” removed.`);
}

function deleteEntry(id) {
  state.entries = state.entries.filter(entry => entry.id !== id);
  saveState();
  renderEntries();
  renderSummary();
  showToast("Time entry deleted.");
}

function clearEntries() {
  if (state.entries.length === 0) return;
  const confirmed = window.confirm("Delete all saved time entries? This cannot be undone.");
  if (!confirmed) return;
  state.entries = [];
  saveState();
  renderEntries();
  renderSummary();
  showToast("All time entries cleared.");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  clearTimeout(toastTimeout);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimeout = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

els.startTimerBtn.addEventListener("click", startOrResumeTimer);
els.pauseTimerBtn.addEventListener("click", pauseTimer);
els.stopTimerBtn.addEventListener("click", stopTimer);
els.manualForm.addEventListener("submit", addManualEntry);
els.projectForm.addEventListener("submit", addProject);
els.entryFilter.addEventListener("change", renderEntries);
els.clearEntriesBtn.addEventListener("click", clearEntries);
els.projectChips.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-project]");
  if (!button) return;
  removeProject(decodeURIComponent(button.dataset.removeProject));
});
els.entryTableBody.addEventListener("click", event => {
  const button = event.target.closest("[data-delete-entry]");
  if (!button) return;
  deleteEntry(button.dataset.deleteEntry);
});

const today = new Date();
els.currentDate.textContent = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric" }).format(today);
els.manualDate.value = localDateString(today);
renderAll();

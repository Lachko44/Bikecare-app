
"use strict";

const STORAGE_KEY = "bikecare_data_v3";

const DEFAULT_CHECKS = [
  { id: "tires", label: "Гумите са напомпани и без видими повреди" },
  { id: "brakes", label: "Предната и задната спирачка работят" },
  { id: "chain", label: "Веригата е чиста и смазана при нужда" },
  { id: "wheels", label: "Каплите са закрепени добре" },
  { id: "steering", label: "Кормилото и лапата са стабилни" },
  { id: "pedals", label: "Педалите и курбелите са стабилни" },
  { id: "helmet", label: "Каската е готова и правилно поставена" }
];

const DEFAULT_BIKE = {
  model: "Drag C1",
  wheelSize: "26",
  tireSize: "",
  tireModel: "",
  frame: "M",
  bikeType: "MTB — планински",
  fork: "",
  frontBrake: "",
  rearBrake: "",
  rotors: "",
  drivetrain: "",
  derailleur: "",
  shifters: "",
  cassette: "",
  chain: "",
  crankset: "",
  wheels: "",
  hubs: "",
  pedals: "",
  saddle: "",
  cockpit: "",
  otherParts: "",
  bikeNotes: ""
};

let data = loadData();
let toastTimeout = null;

function emptyData() {
  return {
    bike: { ...DEFAULT_BIKE },
    tasks: [],
    rides: [],
    checks: {},
    lastChecklist: null
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return emptyData();

    const parsed = JSON.parse(saved);
    const defaults = emptyData();

    return {
      bike: { ...DEFAULT_BIKE, ...(parsed.bike || {}) },
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      rides: Array.isArray(parsed.rides) ? parsed.rides : [],
      checks: parsed.checks && typeof parsed.checks === "object"
        ? parsed.checks
        : {},
      lastChecklist: parsed.lastChecklist || null
    };
  } catch (error) {
    console.error("Неуспешно зареждане на BikeCare:", error);
    return emptyData();
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Неуспешно запазване на BikeCare:", error);
    showToast("Данните не могат да бъдат запазени. Провери настройките на браузъра.");
    return false;
  }
}

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $$(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "Без зададена дата";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("bg-BG", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function showPage(pageName) {
  const page = $(`#page-${pageName}`);
  if (!page) return;

  $$(".page").forEach(item => item.classList.remove("active"));
  page.classList.add("active");

  $$(".nav-link").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });

  const titles = {
    dashboard: "Начало",
    bike: "Моето колело",
    tasks: "Поддръжка",
    rides: "Карания",
    checklist: "Проверка",
    settings: "Настройки"
  };

  document.title = `BikeCare — ${titles[pageName] || "Моето колело"}`;
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (pageName === "bike") renderBike();
  if (pageName === "tasks") renderTasks();
  if (pageName === "rides") renderRides();
  if (pageName === "checklist") renderChecklist();
  if (pageName === "dashboard") renderDashboard();
}

function taskIsDone(task) {
  return Boolean(task.done);
}

function getPendingTasks() {
  return data.tasks.filter(task => !taskIsDone(task));
}

function getCompletedTasks() {
  return data.tasks.filter(task => taskIsDone(task));
}

function getPriorityLabel(priority) {
  const labels = {
    high: "Висок приоритет",
    normal: "Нормален приоритет",
    low: "Нисък приоритет"
  };

  return labels[priority] || "Нормален приоритет";
}

function getPriorityClass(priority) {
  if (priority === "high") return "badge-red";
  if (priority === "low") return "";
  return "badge-yellow";
}

function getTaskStatus(task) {
  if (task.done) return { label: "Завършена", className: "badge-green" };

  if (task.dueDate && task.dueDate < todayISO()) {
    return { label: "Просрочена", className: "badge-red" };
  }

  if (task.dueDate === todayISO()) {
    return { label: "За днес", className: "badge-yellow" };
  }

  return { label: "Предстояща", className: "badge-green" };
}

function renderTask(task, compact = false) {
  const status = getTaskStatus(task);
  const notes = task.notes
    ? `<p class="item-description">${escapeHTML(task.notes)}</p>`
    : "";

  const dueDate = task.dueDate
    ? `<span>Срок: ${escapeHTML(formatDate(task.dueDate))}</span>`
    : "";

  const dueKm = task.dueKm !== "" && task.dueKm != null
    ? `<span>Км: ${escapeHTML(task.dueKm)}</span>`
    : "";

  const operation = task.operation
    ? `<span>${escapeHTML(task.operation)}</span>`
    : "";

  const actions = compact
    ? `<div class="item-actions">
         <button class="small-button" data-action="toggle-task" data-id="${escapeHTML(task.id)}">
           ${task.done ? "Отмени завършването" : "Отбележи като готова"}
         </button>
       </div>`
    : `<div class="item-actions">
         <button class="small-button" data-action="toggle-task" data-id="${escapeHTML(task.id)}">
           ${task.done ? "↶ Върни" : "✓ Завърши"}
         </button>
         <button class="small-button" data-action="edit-task" data-id="${escapeHTML(task.id)}">Редактирай</button>
         <button class="small-button danger" data-action="delete-task" data-id="${escapeHTML(task.id)}">Изтрий</button>
       </div>`;

  return `
    <article class="list-item">
      <div class="item-top">
        <div>
          <h3 class="item-title">${escapeHTML(task.title || "Задача без име")}</h3>
          <div class="item-meta">
            <span>${escapeHTML(task.category || "Друго")}</span>
            ${operation}
            ${dueDate}
            ${dueKm}
          </div>
        </div>
        <div class="item-meta">
          <span class="badge ${status.className}">${status.label}</span>
          ${!task.done
            ? `<span class="badge ${getPriorityClass(task.priority)}">${escapeHTML(getPriorityLabel(task.priority))}</span>`
            : ""}
        </div>
      </div>
      ${notes}
      ${actions}
    </article>
  `;
}

function renderRide(ride, compact = false) {
  const details = [
    ride.duration ? `Продължителност: ${ride.duration}` : "",
    ride.terrain || "",
    ride.conditions || "",
    ride.distance !== "" && ride.distance != null
      ? `${ride.distance} км`
      : ""
  ].filter(Boolean);

  return `
    <article class="list-item">
      <div class="item-top">
        <div>
          <h3 class="item-title">${escapeHTML(formatDate(ride.date))}</h3>
          <div class="item-meta">
            ${details.map(item => `<span>${escapeHTML(item)}</span>`).join("")}
          </div>
        </div>
      </div>
      ${ride.notes
        ? `<p class="item-description">${escapeHTML(ride.notes)}</p>`
        : ""}
      ${compact ? "" : `
        <div class="item-actions">
          <button class="small-button" data-action="edit-ride" data-id="${escapeHTML(ride.id)}">Редактирай</button>
          <button class="small-button danger" data-action="delete-ride" data-id="${escapeHTML(ride.id)}">Изтрий</button>
        </div>
      `}
    </article>
  `;
}

function renderDashboard() {
  const rideCount = $("#rideCount");
  const pendingCount = $("#pendingCount");
  const doneCount = $("#doneCount");

  if (rideCount) rideCount.textContent = String(data.rides.length);
  if (pendingCount) pendingCount.textContent = String(getPendingTasks().length);
  if (doneCount) doneCount.textContent = String(getCompletedTasks().length);

  const bike = data.bike;
  const wheelSize = bike.tireSize
    ? bike.tireSize
    : `${bike.wheelSize || "26"}″ — уточни ширината`;

  const dashboardWheelSize = $("#dashboardWheelSize");
  if (dashboardWheelSize) {
    dashboardWheelSize.textContent = `Размер на гумите: ${wheelSize}`;
  }

  const dashStatus = $("#dashStatus");
  const welcomeText = $("#welcomeText");

  if (getPendingTasks().length > 0) {
    if (dashStatus) dashStatus.textContent = "Има задачи";
    if (welcomeText) {
      welcomeText.textContent = "Прегледай предстоящата поддръжка преди следващото каране.";
    }
  } else {
    if (dashStatus) dashStatus.textContent = "Готов";
    if (welcomeText) {
      welcomeText.textContent = "Провери велосипеда си и се приготви за следващото приключение.";
    }
  }

  const dashboardTasks = $("#dashboardTasks");
  if (dashboardTasks) {
    const pending = getPendingTasks().slice().sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }).slice(0, 4);

    dashboardTasks.innerHTML = pending.length
      ? pending.map(task => renderTask(task, true)).join("")
      : `<div class="empty-state">Няма предстоящи задачи. Добави задача от „Поддръжка“.</div>`;
  }

  const dashboardRides = $("#dashboardRides");
  if (dashboardRides) {
    const rides = data.rides.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 3);
    dashboardRides.innerHTML = rides.length
      ? rides.map(ride => renderRide(ride, true)).join("")
      : `<div class="empty-state">Все още няма записани карания.</div>`;
  }
}

function renderTasks() {
  const container = $("#tasksList");
  if (!container) return;

  const search = ($("#taskSearch")?.value || "").trim().toLocaleLowerCase("bg");
  const filter = $("#taskFilter")?.value || "all";

  const tasks = data.tasks.filter(task => {
    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && !task.done) ||
      (filter === "done" && task.done);

    const searchable = [
      task.title,
      task.category,
      task.operation,
      task.notes
    ].join(" ").toLocaleLowerCase("bg");

    return matchesFilter && searchable.includes(search);
  }).slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  container.innerHTML = tasks.length
    ? tasks.map(task => renderTask(task)).join("")
    : `<div class="empty-state">${
        data.tasks.length
          ? "Няма задачи, които да отговарят на филтъра."
          : "Все още няма добавени задачи. Натисни „Нова задача“, за да създадеш първата."
      }</div>`;

  renderDashboard();
}

function renderRides() {
  const container = $("#ridesList");
  if (!container) return;

  const rides = data.rides.slice().sort((a, b) => {
    return (b.date || "").localeCompare(a.date || "");
  });

  container.innerHTML = rides.length
    ? rides.map(ride => renderRide(ride)).join("")
    : `<div class="empty-state">Все още няма записани карания. Натисни „Ново каране“, за да добавиш запис.</div>`;

  renderDashboard();
}

function renderBike() {
  const form = $("#bikeForm");
  if (!form) return;

  for (const [key, value] of Object.entries(data.bike)) {
    const input = form.elements.namedItem(key);
    if (input && document.activeElement !== input) {
      input.value = value ?? "";
    }
  }

  const profileTitle = $(".bike-profile h2");
  if (profileTitle) profileTitle.textContent = data.bike.model || "Drag C1";

  const wheelTag = $(".bike-tag");
  if (wheelTag) {
    wheelTag.textContent = `${data.bike.wheelSize || "26"}-инчови капли`;
  }

  const heroTitle = $(".bike-hero h2");
  if (heroTitle) heroTitle.textContent = data.bike.model || "Drag C1";

  renderDashboard();
}

function renderChecklist() {
  const container = $("#checklistItems");
  if (!container) return;

  container.innerHTML = DEFAULT_CHECKS.map(check => `
    <label class="check-item">
      <input type="checkbox" data-check="${escapeHTML(check.id)}" ${data.checks[check.id] ? "checked" : ""}>
      <span>${escapeHTML(check.label)}</span>
    </label>
  `).join("");

  updateChecklistProgress();
}

function updateChecklistProgress() {
  const total = DEFAULT_CHECKS.length;
  const completed = DEFAULT_CHECKS.filter(check => data.checks[check.id]).length;
  const percent = Math.round((completed / total) * 100);

  const bar = $("#progressBar");
  const text = $("#progressText");

  if (bar) bar.style.width = `${percent}%`;
  if (text) text.textContent = `${percent}%`;
}

function openTaskEditor(task = null) {
  const form = $("#taskForm");
  if (!form) return;

  form.reset();
  form.classList.remove("hidden");

  const title = $("#taskEditorTitle");
  if (title) title.textContent = task ? "Редактиране на задача" : "Нова задача";

  form.elements.namedItem("taskId").value = task?.id || "";
  form.elements.namedItem("title").value = task?.title || "";
  form.elements.namedItem("category").value = task?.category || "Верига и трансмисия";
  form.elements.namedItem("operation").value = task?.operation || "Проверка";
  form.elements.namedItem("dueDate").value = task?.dueDate || "";
  form.elements.namedItem("priority").value = task?.priority || "normal";
  form.elements.namedItem("dueKm").value = task?.dueKm ?? "";
  form.elements.namedItem("notes").value = task?.notes || "";

  form.scrollIntoView({ behavior: "smooth", block: "start" });
  form.elements.namedItem("title").focus();
}

function closeTaskEditor() {
  const form = $("#taskForm");
  if (!form) return;

  form.reset();
  form.classList.add("hidden");
}

function saveTaskFromForm(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const taskId = form.elements.namedItem("taskId").value;
  const title = form.elements.namedItem("title").value.trim();

  if (!title) {
    showToast("Въведи име на задачата.");
    return;
  }

  const previous = data.tasks.find(task => task.id === taskId);

  const task = {
    id: taskId || makeId(),
    title,
    category: form.elements.namedItem("category").value,
    operation: form.elements.namedItem("operation").value,
    dueDate: form.elements.namedItem("dueDate").value,
    priority: form.elements.namedItem("priority").value,
    dueKm: form.elements.namedItem("dueKm").value,
    notes: form.elements.namedItem("notes").value.trim(),
    done: previous ? previous.done : false,
    createdAt: previous ? previous.createdAt : new Date().toISOString(),
    completedAt: previous ? previous.completedAt || null : null
  };

  if (previous) {
    data.tasks = data.tasks.map(item => item.id === taskId ? task : item);
  } else {
    data.tasks.unshift(task);
  }

  saveData();
  closeTaskEditor();
  renderTasks();
  showToast(previous ? "Задачата е обновена." : "Задачата е добавена.");
}

function toggleTask(taskId) {
  const task = data.tasks.find(item => item.id === taskId);
  if (!task) return;

  task.done = !task.done;
  task.completedAt = task.done ? new Date().toISOString() : null;

  saveData();
  renderTasks();
  showToast(task.done ? "Задачата е отбелязана като завършена." : "Задачата е върната в предстоящите.");
}

function deleteTask(taskId) {
  const task = data.tasks.find(item => item.id === taskId);
  if (!task) return;

  if (!confirm(`Да изтрия ли задачата „${task.title}“?`)) return;

  data.tasks = data.tasks.filter(item => item.id !== taskId);
  saveData();
  renderTasks();
  showToast("Задачата е изтрита.");
}

function openRideEditor(ride = null) {
  const form = $("#rideForm");
  if (!form) return;

  form.reset();
  form.classList.remove("hidden");

  const title = $("#rideEditorTitle");
  if (title) title.textContent = ride ? "Редактиране на каране" : "Ново каране";

  form.elements.namedItem("rideId").value = ride?.id || "";
  form.elements.namedItem("date").value = ride?.date || todayISO();
  form.elements.namedItem("duration").value = ride?.duration || "";
  form.elements.namedItem("terrain").value = ride?.terrain || "Гора";
  form.elements.namedItem("conditions").value = ride?.conditions || "Сухо";
  form.elements.namedItem("distance").value = ride?.distance ?? "";
  form.elements.namedItem("notes").value = ride?.notes || "";

  form.scrollIntoView({ behavior: "smooth", block: "start" });
  form.elements.namedItem("date").focus();
}

function closeRideEditor() {
  const form = $("#rideForm");
  if (!form) return;

  form.reset();
  form.classList.add("hidden");
}

function saveRideFromForm(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const rideId = form.elements.namedItem("rideId").value;
  const date = form.elements.namedItem("date").value;

  if (!date) {
    showToast("Избери дата на карането.");
    return;
  }

  const previous = data.rides.find(ride => ride.id === rideId);
  const distanceValue = form.elements.namedItem("distance").value;

  const ride = {
    id: rideId || makeId(),
    date,
    duration: form.elements.namedItem("duration").value.trim(),
    terrain: form.elements.namedItem("terrain").value,
    conditions: form.elements.namedItem("conditions").value,
    distance: distanceValue === "" ? "" : Number(distanceValue),
    notes: form.elements.namedItem("notes").value.trim(),
    createdAt: previous ? previous.createdAt : new Date().toISOString()
  };

  if (previous) {
    data.rides = data.rides.map(item => item.id === rideId ? ride : item);
  } else {
    data.rides.unshift(ride);
  }

  saveData();
  closeRideEditor();
  renderRides();
  showToast(previous ? "Карането е обновено." : "Карането е записано.");
}

function deleteRide(rideId) {
  const ride = data.rides.find(item => item.id === rideId);
  if (!ride) return;

  if (!confirm("Да изтрия ли този запис за каране?")) return;

  data.rides = data.rides.filter(item => item.id !== rideId);
  saveData();
  renderRides();
  showToast("Записът е изтрит.");
}

function saveBikeFromForm(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const updated = { ...DEFAULT_BIKE };

  for (const key of Object.keys(DEFAULT_BIKE)) {
    const field = form.elements.namedItem(key);
    if (field) updated[key] = field.value.trim();
  }

  updated.model = updated.model || "Drag C1";
  updated.wheelSize = updated.wheelSize || "26";

  data.bike = updated;
  saveData();
  renderBike();
  showToast("Информацията за Drag C1 е запазена.");
}

function finishChecklist() {
  const unchecked = DEFAULT_CHECKS.filter(check => !data.checks[check.id]);

  if (unchecked.length) {
    showToast(`Остават ${unchecked.length} непроверени елемента.`);
    return;
  }

  data.lastChecklist = new Date().toISOString();
  saveData();
  showToast("Проверката е завършена. Карането може да започне!");
}

function resetChecklist() {
  if (!confirm("Да нулирам ли проверката за следващото каране?")) return;

  data.checks = {};
  saveData();
  renderChecklist();
  showToast("Проверката е нулирана.");
}

function exportData() {
  const payload = {
    app: "BikeCare",
    version: 3,
    exportedAt: new Date().toISOString(),
    data
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bikecare-archive-${todayISO()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Архивът е подготвен.");
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const imported = parsed.data || parsed;

      if (!imported || typeof imported !== "object") {
        throw new Error("Невалиден архив");
      }

      if (!confirm("Импортирането ще замени текущите данни. Продължаваме ли?")) {
        event.target.value = "";
        return;
      }

      data = {
        bike: { ...DEFAULT_BIKE, ...(imported.bike || {}) },
        tasks: Array.isArray(imported.tasks) ? imported.tasks : [],
        rides: Array.isArray(imported.rides) ? imported.rides : [],
        checks: imported.checks && typeof imported.checks === "object"
          ? imported.checks
          : {},
        lastChecklist: imported.lastChecklist || null
      };

      saveData();
      renderAll();
      showToast("Архивът е импортиран.");
    } catch (error) {
      console.error(error);
      showToast("Архивът не е валиден BikeCare JSON файл.");
    } finally {
      event.target.value = "";
    }
  };

  reader.onerror = () => {
    showToast("Файлът не може да бъде прочетен.");
    event.target.value = "";
  };

  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm("Сигурен ли си? Ще бъдат изтрити задачите, каранията и данните за колелото.")) {
    return;
  }

  data = emptyData();
  saveData();
  renderAll();
  showToast("Данните са изтрити.");
}

function renderAll() {
  renderBike();
  renderTasks();
  renderRides();
  renderChecklist();
  renderDashboard();
}

function handleNavigation(event) {
  const button = event.target.closest("[data-page], [data-goto]");
  if (!button) return;

  event.preventDefault();
  const pageName = button.dataset.page || button.dataset.goto;
  showPage(pageName);
}

function handleListActions(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "toggle-task") toggleTask(id);

  if (action === "edit-task") {
    const task = data.tasks.find(item => item.id === id);
    if (task) openTaskEditor(task);
  }

  if (action === "delete-task") deleteTask(id);

  if (action === "edit-ride") {
    const ride = data.rides.find(item => item.id === id);
    if (ride) openRideEditor(ride);
  }

  if (action === "delete-ride") deleteRide(id);
}

function attachEvents() {
  document.addEventListener("click", event => {
    handleNavigation(event);
    handleListActions(event);
  });

  $("#bikeForm")?.addEventListener("submit", saveBikeFromForm);

  $("#taskForm")?.addEventListener("submit", saveTaskFromForm);
  $("#addTask")?.addEventListener("click", () => openTaskEditor());
  $("#cancelTask")?.addEventListener("click", closeTaskEditor);
  $("#taskSearch")?.addEventListener("input", renderTasks);
  $("#taskFilter")?.addEventListener("change", renderTasks);

  $("#rideForm")?.addEventListener("submit", saveRideFromForm);
  $("#addRide")?.addEventListener("click", () => openRideEditor());
  $("#cancelRide")?.addEventListener("click", closeRideEditor);

  $("#checklistItems")?.addEventListener("change", event => {
    const checkbox = event.target.closest("[data-check]");
    if (!checkbox) return;

    data.checks[checkbox.dataset.check] = checkbox.checked;

    if (!checkbox.checked) {
      data.lastChecklist = null;
    }

    saveData();
    updateChecklistProgress();
  });

  $("#finishChecklist")?.addEventListener("click", finishChecklist);
  $("#resetChecklist")?.addEventListener("click", resetChecklist);

  $("#exportData")?.addEventListener("click", exportData);
  $("#importData")?.addEventListener("change", importData);
  $("#clearData")?.addEventListener("click", clearAllData);
}

function init() {
  attachEvents();
  renderAll();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(error => {
        console.warn("Service worker не е регистриран:", error);
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", init);

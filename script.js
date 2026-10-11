
"use strict";

const KEY = "bikecare_public_v1";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function id() {
  return crypto.randomUUID ? crypto.randomUUID() :
    Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function clean(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function blankData() {
  return {
    bike: {
      name: "", brand: "", model: "", type: "",
      wheel: "", frame: "", year: "", notes: ""
    },
    parts: [],
    tasks: [],
    rides: []
  };
}

function load() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    if (!value || typeof value !== "object") return blankData();
    const defaults = blankData();
    return {
      bike: { ...defaults.bike, ...(value.bike || {}) },
      parts: Array.isArray(value.parts) ? value.parts : [],
      tasks: Array.isArray(value.tasks) ? value.tasks : [],
      rides: Array.isArray(value.rides) ? value.rides : []
    };
  } catch {
    return blankData();
  }
}

let data = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    $("#save-status").textContent = "✓ Запазено на това устройство";
  } catch {
    alert("Не успях да запазя данните. Провери настройките на браузъра.");
  }
}

function message(text) {
  let el = $("#notice");
  if (!el) {
    el = document.createElement("div");
    el.id = "notice";
    Object.assign(el.style, {
      position: "fixed", bottom: "20px", left: "50%",
      transform: "translateX(-50%)", zIndex: "99",
      background: "#203523", color: "white",
      padding: "12px 18px", border: "1px solid #5bea78",
      borderRadius: "9px", maxWidth: "90%", fontSize: "13px"
    });
    document.body.appendChild(el);
  }
  el.textContent = text;
  clearTimeout(message.timer);
  message.timer = setTimeout(() => el.remove(), 2500);
}

function showPage(name) {
  $$("[id^='page-']").forEach(page => {
    page.hidden = page.id !== "page-" + name;
  });
  $$(".sidebar button[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === name);
  });
  history.replaceState(null, "", "#" + name);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$(".sidebar button[data-page]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

$$("[data-go]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function dateText(value) {
  if (!value) return "Без дата";
  const date = new Date(value + "T00:00:00");
  return Number.isNaN(date.getTime()) ? clean(value) :
    date.toLocaleDateString("bg-BG");
}

function bikeName() {
  return data.bike.name ||
    [data.bike.brand, data.bike.model].filter(Boolean).join(" ");
}

function renderHome() {
  const name = bikeName();
  $("#stat-bike").textContent = name || "Не е добавен";
  $("#stat-parts").textContent = data.parts.length;
  $("#stat-tasks").textContent = data.tasks.filter(task => !task.done).length;

  const km = data.rides.reduce((total, ride) =>
    total + (Number(ride.distance) || 0), 0);
  $("#stat-km").textContent =
    km.toLocaleString("bg-BG", { maximumFractionDigits: 1 }) + " км";

  $("#home-bike").hidden = Boolean(name);
  $("#home-bike-info").innerHTML = name
    ? `<div class="list-item"><div class="content">
        <strong>${clean(name)}</strong>
        <p>${clean(data.bike.type)} ${data.bike.wheel ? " · " + clean(data.bike.wheel) + " инча" : ""}</p>
        <p>${clean(data.bike.notes)}</p>
       </div><button class="secondary" data-edit-bike>Редактирай</button></div>`
    : "";

  $("#home-bike-info").querySelector("[data-edit-bike]")?.addEventListener(
    "click", () => showPage("bike")
  );

  const tasks = data.tasks.filter(task => !task.done).slice(0, 4);
  $("#home-tasks").innerHTML = tasks.length ? tasks.map(task =>
    `<div class="list-item"><div class="content"><strong>${clean(task.title)}</strong>
    <p>${clean(task.category)} ${task.due ? " · " + dateText(task.due) : ""}</p></div></div>`
  ).join("") : `<p class="empty">Няма чакащи задачи.</p>`;

  const rides = [...data.rides].sort((a, b) =>
    String(b.date).localeCompare(String(a.date))).slice(0, 3);
  $("#home-rides").innerHTML = rides.length ? rides.map(ride =>
    `<div class="list-item"><div class="content"><strong>${clean(ride.title || "Каране")}</strong>
    <p>${dateText(ride.date)} · ${Number(ride.distance) || 0} км
    ${ride.location ? " · " + clean(ride.location) : ""}</p></div></div>`
  ).join("") : `<p class="empty">Още няма записани карания.</p>`;
}

function setupBike() {
  const form = $("#bike-form");

  Object.entries(data.bike).forEach(([name, value]) => {
    if (form.elements.namedItem(name)) {
      form.elements.namedItem(name).value = value || "";
    }
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    data.bike = { ...blankData().bike, ...formValues(form) };
    save();
    renderAll();
    message("Профилът на велосипеда е запазен.");
  });

  $("#clear-bike-form").addEventListener("click", () => {
    form.reset();
  });
}

function setupParts() {
  $("#part-form").addEventListener("submit", event => {
    event.preventDefault();
    const values = formValues(event.currentTarget);
    if (!String(values.name || "").trim()) return;

    data.parts.push({
      id: id(),
      name: String(values.name).trim(),
      brand: String(values.brand || "").trim(),
      model: String(values.model || "").trim(),
      notes: String(values.notes || "").trim()
    });

    event.currentTarget.reset();
    save();
    renderAll();
    message("Компонентът е добавен.");
  });

  $("#parts-list").addEventListener("click", event => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    const part = data.parts.find(item => item.id === button.dataset.delete);
    if (!part || !confirm("Да изтрия ли компонента " + part.name + "?")) return;
    data.parts = data.parts.filter(item => item.id !== part.id);
    save();
    renderAll();
  });
}

function renderParts() {
  $("#parts-empty").hidden = data.parts.length > 0;
  $("#parts-list").innerHTML = data.parts.map(part => `
    <div class="list-item">
      <div class="content">
        <strong>${clean(part.name)}</strong>
        <p>${clean(part.brand)} ${clean(part.model)}</p>
        <p>${clean(part.notes)}</p>
      </div>
      <div class="item-actions">
        <button class="delete" data-delete="${clean(part.id)}">Изтрий</button>
      </div>
    </div>
  `).join("");
}

function setupTasks() {
  $("#task-form").addEventListener("submit", event => {
    event.preventDefault();
    const values = formValues(event.currentTarget);
    if (!String(values.title || "").trim()) return;

    data.tasks.push({
      id: id(),
      title: String(values.title).trim(),
      category: values.category || "",
      due: values.due || "",
      notes: String(values.notes || "").trim(),
      done: false
    });

    event.currentTarget.reset();
    save();
    renderAll();
    message("Задачата е добавена.");
  });

  $("#tasks-list").addEventListener("change", event => {
    const checkbox = event.target.closest("[data-toggle]");
    if (!checkbox) return;
    const task = data.tasks.find(item => item.id === checkbox.dataset.toggle);
    if (!task) return;
    task.done = checkbox.checked;
    save();
    renderAll();
  });

  $("#tasks-list").addEventListener("click", event => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    if (!confirm("Да изтрия ли тази задача?")) return;
    data.tasks = data.tasks.filter(item => item.id !== button.dataset.delete);
    save();
    renderAll();
  });
}

function renderTasks() {
  $("#tasks-empty").hidden = data.tasks.length > 0;
  $("#tasks-list").innerHTML = data.tasks.map(task => `
    <div class="list-item ${task.done ? "done" : ""}">
      <div class="content">
        <label style="flex-direction:row;align-items:center">
          <input style="width:17px" type="checkbox" data-toggle="${clean(task.id)}" ${task.done ? "checked" : ""}>
          <strong class="title">${clean(task.title)}</strong>
        </label>
        <p>${clean(task.category)} ${task.due ? " · Срок: " + dateText(task.due) : ""}</p>
        <p>${clean(task.notes)}</p>
      </div>
      <div class="item-actions"><button class="delete" data-delete="${clean(task.id)}">Изтрий</button></div>
    </div>
  `).join("");
}

function setupRides() {
  const form = $("#ride-form");
  const dateField = form.elements.namedItem("date");
  dateField.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);

  form.addEventListener("submit", event => {
    event.preventDefault();
    const values = formValues(form);
    const distance = Number(values.distance);
    if (!Number.isFinite(distance) || distance < 0) {
      message("Въведи валидно разстояние.");
      return;
    }

    data.rides.push({
      id: id(),
      title: String(values.title || "").trim() || "Каране",
      date: values.date,
      distance,
      duration: String(values.duration || "").trim(),
      location: String(values.location || "").trim(),
      notes: String(values.notes || "").trim()
    });

    form.reset();
    dateField.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
    save();
    renderAll();
    message("Карането е записано.");
  });

  $("#rides-list").addEventListener("click", event => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    if (!confirm("Да изтрия ли това каране?")) return;
    data.rides = data.rides.filter(item => item.id !== button.dataset.delete);
    save();
    renderAll();
  });
}

function renderRides() {
  $("#rides-empty").hidden = data.rides.length > 0;
  $("#rides-list").innerHTML = [...data.rides]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(ride => `
      <div class="list-item">
        <div class="content">
          <strong>${clean(ride.title || "Каране")}</strong>
          <p>${dateText(ride.date)} · ${Number(ride.distance) || 0} км
          ${ride.duration ? " · " + clean(ride.duration) : ""}</p>
          <p>${clean(ride.location)}</p><p>${clean(ride.notes)}</p>
        </div>
        <div class="item-actions"><button class="delete" data-delete="${clean(ride.id)}">Изтрий</button></div>
      </div>
    `).join("");
}

function setupBackup() {
  $("#export-button").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bikecare-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  $("#import-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported || typeof imported !== "object") throw new Error("Invalid file");
      if (!confirm("Архивът ще замени данните в този браузър. Продължаваме ли?")) return;

      const defaults = blankData();
      data = {
        bike: { ...defaults.bike, ...(imported.bike || {}) },
        parts: Array.isArray(imported.parts) ? imported.parts : [],
        tasks: Array.isArray(imported.tasks) ? imported.tasks : [],
        rides: Array.isArray(imported.rides) ? imported.rides : []
      };

      $("#bike-form").reset();
      Object.entries(data.bike).forEach(([key, value]) => {
        if ($("#bike-form").elements.namedItem(key)) {
          $("#bike-form").elements.namedItem(key).value = value || "";
        }
      });
      save();
      renderAll();
      message("Архивът е възстановен.");
    } catch {
      alert("Файлът не е валиден BikeCare архив.");
    } finally {
      event.target.value = "";
    }
  });

  $("#reset-button").addEventListener("click", () => {
    if (!confirm("Това ще изтрие всички BikeCare данни от този браузър. Сигурен ли си?")) return;
    data = blankData();
    save();
    $("#bike-form").reset();
    renderAll();
    showPage("home");
    message("Данните са изтрити.");
  });
}

function renderAll() {
  renderHome();
  renderParts();
  renderTasks();
  renderRides();
}

let installEvent = null;

function setupApp() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(console.error);
    });
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installEvent = event;
    $("#install-button").hidden = false;
  });

  $("#install-button").addEventListener("click", async () => {
    if (!installEvent) {
      alert("На iPhone отвори сайта в Safari, натисни Споделяне и избери „Добавяне към началния екран“.");
      return;
    }
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    $("#install-button").hidden = true;
  });
}

function init() {
  const page = location.hash.slice(1);
  showPage(["home", "bike", "parts", "maintenance", "rides", "backup"].includes(page) ? page : "home");
  setupBike();
  setupParts();
  setupTasks();
  setupRides();
  setupBackup();
  setupApp();
  renderAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

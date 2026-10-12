
"use strict";

/* =========================================================
   BIKECARE — Supabase authentication + cloud data storage
   ========================================================= */

const SUPABASE_URL = "https://dvdjpwjyjorxyhcsaeew.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nD5xgrAV8xfqaX5JgYQbng_jXRDkPr_";

const KEY = "bikecare_public_v1";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const CONFIGURED =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_URL.includes(".supabase.co") &&
  SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");

const supabase = CONFIGURED
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

let session = null;
let data = blankData();
let saving = false;
let saveTimer = null;
let saveVersion = 0;
let installEvent = null;
let authBusy = false;

/* =========================
   DATA
   ========================= */

function id() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function clean(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function blankData() {
  return {
    bike: {
      name: "",
      brand: "",
      model: "",
      type: "",
      wheel: "",
      frame: "",
      year: "",
      notes: ""
    },
    parts: [],
    tasks: [],
    rides: []
  };
}

function normalizeData(value) {
  const defaults = blankData();

  if (!value || typeof value !== "object") {
    return defaults;
  }

  return {
    bike: { ...defaults.bike, ...(value.bike || {}) },
    parts: Array.isArray(value.parts) ? value.parts : [],
    tasks: Array.isArray(value.tasks) ? value.tasks : [],
    rides: Array.isArray(value.rides) ? value.rides : []
  };
}

function loadLocal() {
  try {
    return normalizeData(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return blankData();
  }
}

function setStatus(text) {
  const el = $("#save-status");
  if (el) el.textContent = text;
}

function message(text) {
  let el = $("#notice");

  if (!el) {
    el = document.createElement("div");
    el.id = "notice";

    Object.assign(el.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "99",
      background: "#203523",
      color: "white",
      padding: "12px 18px",
      border: "1px solid #5bea78",
      borderRadius: "9px",
      maxWidth: "90%",
      fontSize: "13px"
    });

    document.body.appendChild(el);
  }

  el.textContent = text;
  clearTimeout(message.timer);
  message.timer = setTimeout(() => el.remove(), 3000);
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function dateText(value) {
  if (!value) return "Без дата";

  const date = new Date(value + "T00:00:00");

  return Number.isNaN(date.getTime())
    ? clean(value)
    : date.toLocaleDateString("bg-BG");
}

function bikeName() {
  return data.bike.name ||
    [data.bike.brand, data.bike.model].filter(Boolean).join(" ");
}

/* =========================
   CLOUD STORAGE
   ========================= */

async function saveCloud() {
  if (!session || !supabase || saving) return;

  saving = true;
  const versionBeingSaved = saveVersion;
  const snapshot = JSON.parse(JSON.stringify(data));

  setStatus("Запазване в облака...");

  try {
    const { error } = await supabase
      .from("bikecare_data")
      .upsert({
        user_id: session.user.id,
        bike: snapshot.bike,
        parts: snapshot.parts,
        tasks: snapshot.tasks,
        rides: snapshot.rides,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "user_id"
      });

    if (error) throw error;

    if (versionBeingSaved === saveVersion) {
      setStatus("✓ Запазено в облака");
    }
  } catch (error) {
    console.error("BikeCare cloud save:", error);
    setStatus("Грешка при облачното запазване");
    message("Данните са запазени локално, но не и в облака.");
  } finally {
    saving = false;

    if (versionBeingSaved !== saveVersion && session) {
      scheduleCloudSave();
    }
  }
}

function scheduleCloudSave() {
  clearTimeout(saveTimer);

  if (!session) return;

  saveTimer = setTimeout(() => {
    saveCloud();
  }, 500);
}

function save() {
  saveVersion++;

  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (error) {
    console.error("BikeCare local save:", error);
  }

  if (session) {
    setStatus("Промените се запазват...");
    scheduleCloudSave();
  } else {
    setStatus("Запазено на това устройство");
  }
}

async function loadCloud() {
  if (!session || !supabase) return;

  setStatus("Зареждане от облака...");

  const { data: row, error } = await supabase
    .from("bikecare_data")
    .select("bike, parts, tasks, rides")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("BikeCare cloud load:", error);
    setStatus("Грешка при зареждането");
    message("Не успях да заредя облачните данни.");
    return;
  }

  if (row) {
    data = normalizeData(row);
    localStorage.setItem(KEY, JSON.stringify(data));
  } else {
    // Запазва съществуващите локални данни при първия вход.
    data = loadLocal();
    saveVersion++;
    await saveCloud();
  }

  renderAll();
  fillBikeForm();
  setStatus("✓ Заредено от облака");
}

function fillBikeForm() {
  const form = $("#bike-form");
  if (!form) return;

  Object.entries(data.bike).forEach(([name, value]) => {
    const field = form.elements.namedItem(name);
    if (field) field.value = value ?? "";
  });
}

/* =========================
   AUTHENTICATION
   ========================= */

function showAuth(show) {
  const authPage = $("#page-auth");
  const appContent = $("#app-content");

  if (authPage) authPage.hidden = !show;
  if (appContent) appContent.hidden = show;

  if (show) {
    $$("[id^='page-']").forEach(page => {
      if (page.id !== "page-auth") page.hidden = true;
    });
  }
}

function setAuthStatus(text) {
  const el = $("#auth-status");
  if (el) el.textContent = text;
}

function setAuthBusy(busy) {
  authBusy = busy;

  const login = $("#login-button");
  const register = $("#register-button");

  if (login) login.disabled = busy;
  if (register) register.disabled = busy;
}

function setupAuth() {
  if (!CONFIGURED || !supabase) {
    showAuth(true);
    setAuthStatus(
      "Първо попълни SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY в началото на script.js."
    );
    setStatus("Нужни са настройки на Supabase");
    return;
  }

  $("#auth-form").addEventListener("submit", async event => {
    event.preventDefault();

    if (authBusy) return;

    const values = formValues(event.currentTarget);
    const email = String(values.email || "").trim();
    const password = String(values.password || "");

    if (!email || !password) {
      setAuthStatus("Въведи имейл и парола.");
      return;
    }

    setAuthBusy(true);
    setAuthStatus("Влизане...");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      setAuthStatus("Влизането е успешно.");
    } catch (error) {
      setAuthStatus(error.message || "Неуспешен вход.");
    } finally {
      setAuthBusy(false);
    }
  });

  $("#register-button").addEventListener("click", async () => {
    if (authBusy) return;

    const form = $("#auth-form");
    const values = formValues(form);
    const email = String(values.email || "").trim();
    const password = String(values.password || "");

    if (!email || password.length < 6) {
      setAuthStatus("Въведи имейл и парола с поне 6 символа.");
      return;
    }

    setAuthBusy(true);
    setAuthStatus("Създаване на профил...");

    try {
      const { data: result, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      if (result.session) {
        setAuthStatus("Профилът е създаден успешно.");
      } else {
        setAuthStatus(
          "Профилът е създаден. Провери имейла си за потвърждение, ако е необходимо."
        );
      }
    } catch (error) {
      setAuthStatus(error.message || "Неуспешна регистрация.");
    } finally {
      setAuthBusy(false);
    }
  });

  $("#logout-button").addEventListener("click", async () => {
    if (!confirm("Сигурен ли си, че искаш да излезеш от профила?")) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      message("Неуспешен изход.");
      return;
    }

    message("Излезе от профила.");
  });
}

async function applySession(nextSession) {
  clearTimeout(saveTimer);

  session = nextSession;

  if (!session) {
    data = blankData();
    showAuth(true);
    setStatus("Не си влязъл");
    return;
  }

  $("#account-email").textContent = session.user.email || "Влязъл потребител";
  $("#logout-button").hidden = false;

  showAuth(false);

  const currentPage = location.hash.slice(1);
  showPage(
    ["home", "bike", "parts", "maintenance", "rides", "backup"].includes(currentPage)
      ? currentPage
      : "home"
  );

  await loadCloud();
}

/* =========================
   NAVIGATION
   ========================= */

function showPage(name) {
  if (!session && CONFIGURED && name !== "auth") {
    showAuth(true);
    return;
  }

  $$("[id^='page-']").forEach(page => {
    page.hidden = page.id !== "page-" + name;
  });

  $$(".sidebar button[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === name);
  });

  if (name !== "auth") {
    history.replaceState(null, "", "#" + name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

$$(".sidebar button[data-page]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

$$("[data-go]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});

/* =========================
   HOME
   ========================= */

function renderHome() {
  $("#stat-bike").textContent = bikeName() || "Не е добавен";
  $("#stat-parts").textContent = data.parts.length;
  $("#stat-tasks").textContent =
    data.tasks.filter(task => !task.done).length;

  const km = data.rides.reduce(
    (total, ride) => total + (Number(ride.distance) || 0),
    0
  );

  $("#stat-km").textContent =
    km.toLocaleString("bg-BG", { maximumFractionDigits: 1 }) + " км";

  const name = bikeName();
  $("#home-bike").hidden = Boolean(name);

  $("#home-bike-info").innerHTML = name
    ? `<div class="list-item">
         <div class="content">
           <strong>${clean(name)}</strong>
           <p>${clean(data.bike.type)} ${
             data.bike.wheel
               ? " · " + clean(data.bike.wheel) + " инча"
               : ""
           }</p>
           <p>${clean(data.bike.notes)}</p>
         </div>
         <button class="secondary" data-edit-bike>Редактирай</button>
       </div>`
    : "";

  $("#home-bike-info")
    .querySelector("[data-edit-bike]")
    ?.addEventListener("click", () => showPage("bike"));

  const tasks = data.tasks.filter(task => !task.done).slice(0, 4);

  $("#home-tasks").innerHTML = tasks.length
    ? tasks.map(task => `
        <div class="list-item">
          <div class="content">
            <strong>${clean(task.title)}</strong>
            <p>${clean(task.category)} ${
              task.due ? " · " + dateText(task.due) : ""
            }</p>
          </div>
        </div>
      `).join("")
    : `<p class="empty">Няма чакащи задачи.</p>`;

  const rides = [...data.rides]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 3);

  $("#home-rides").innerHTML = rides.length
    ? rides.map(ride => `
        <div class="list-item">
          <div class="content">
            <strong>${clean(ride.title || "Каране")}</strong>
            <p>${dateText(ride.date)} · ${Number(ride.distance) || 0} км ${
              ride.location ? " · " + clean(ride.location) : ""
            }</p>
          </div>
        </div>
      `).join("")
    : `<p class="empty">Още няма записани карания.</p>`;
}

/* =========================
   BICYCLE
   ========================= */

function setupBike() {
  const form = $("#bike-form");

  form.addEventListener("submit", event => {
    event.preventDefault();

    data.bike = {
      ...blankData().bike,
      ...formValues(form)
    };

    save();
    renderAll();
    message("Профилът на велосипеда е запазен.");
  });

  $("#clear-bike-form").addEventListener("click", () => {
    form.reset();
  });
}

/* =========================
   PARTS
   ========================= */

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

    if (!part || !confirm("Да изтрия ли компонента " + part.name + "?")) {
      return;
    }

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

/* =========================
   MAINTENANCE TASKS
   ========================= */

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
          <input style="width:17px" type="checkbox"
            data-toggle="${clean(task.id)}" ${task.done ? "checked" : ""}>
          <strong class="title">${clean(task.title)}</strong>
        </label>
        <p>${clean(task.category)} ${
          task.due ? " · Срок: " + dateText(task.due) : ""
        }</p>
        <p>${clean(task.notes)}</p>
      </div>
      <div class="item-actions">
        <button class="delete" data-delete="${clean(task.id)}">Изтрий</button>
      </div>
    </div>
  `).join("");
}

/* =========================
   RIDES
   ========================= */

function setupRides() {
  const form = $("#ride-form");
  const dateField = form.elements.namedItem("date");

  function setToday() {
    dateField.value = new Date(
      Date.now() - new Date().getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);
  }

  setToday();

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
    setToday();
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
          <p>${dateText(ride.date)} · ${Number(ride.distance) || 0} км ${
            ride.duration ? " · " + clean(ride.duration) : ""
          }</p>
          <p>${clean(ride.location)}</p>
          <p>${clean(ride.notes)}</p>
        </div>
        <div class="item-actions">
          <button class="delete" data-delete="${clean(ride.id)}">Изтрий</button>
        </div>
      </div>
    `).join("");
}

/* =========================
   BACKUP / RESTORE
   ========================= */

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

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $("#import-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const imported = JSON.parse(await file.text());

      if (!imported || typeof imported !== "object") {
        throw new Error("Невалиден архив");
      }

      if (!confirm("Архивът ще замени данните в този профил. Продължаваме ли?")) {
        return;
      }

      data = normalizeData(imported);
      fillBikeForm();
      save();
      renderAll();
      message("Архивът е възстановен.");
    } catch {
      alert("Файлът не е валиден BikeCare архив.");
    } finally {
      event.target.value = "";
    }
  });

  $("#reset-button").addEventListener("click", async () => {
    if (!confirm("Това ще изтрие всички данни от текущия профил. Сигурен ли си?")) {
      return;
    }

    data = blankData();
    fillBikeForm();
    save();
    renderAll();

    if (session) {
      await saveCloud();
    }

    showPage("home");
    message("Данните са изчистени.");
  });
}

/* =========================
   RENDER
   ========================= */

function renderAll() {
  renderHome();
  renderParts();
  renderTasks();
  renderRides();
}

/* =========================
   APP INSTALLATION
   ========================= */

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

/* =========================
   INITIALIZATION
   ========================= */

async function init() {
  setupBike();
  setupParts();
  setupTasks();
  setupRides();
  setupBackup();
  setupApp();
  setupAuth();

  data = loadLocal();
  fillBikeForm();
  renderAll();

  if (!CONFIGURED || !supabase) {
    showAuth(true);
    return;
  }

  try {
    const { data: result, error } = await supabase.auth.getSession();

    if (error) throw error;

    await applySession(result.session);
  } catch (error) {
    console.error("BikeCare authentication:", error);
    showAuth(true);
    setAuthStatus("Не успях да се свържа със Supabase. Провери настройките и връзката.");
  }

  supabase.auth.onAuthStateChange((_event, nextSession) => {
    // Изпълнява се след приключване на текущия callback.
    setTimeout(() => {
      if (nextSession?.user?.id !== session?.user?.id) {
        applySession(nextSession);
      }
    }, 0);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

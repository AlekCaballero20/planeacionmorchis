/* app.js
   Ritual - Alek & Cata
   - Diarias: check por día
   - Complementarias: rotación semanal (ciclo)
   - Vista Hoy: Pendientes + Hechas (con filtros + chips)
   - Vista Semana: % por día y por categoría (diarias)
   - Manage: agregar/editar/borrar + búsqueda + filtro tipo
   - Backup: export/import
*/

const LS_KEY = "ritual_v2_db";
const LS_STATE = "ritual_v2_state";

const $ = (sel) => document.querySelector(sel);

const els = {
  // Titles / KPIs
  dateTitle: $("#dateTitle"),
  kpiDaily: $("#kpiDaily"),
  kpiDailyHelp: $("#kpiDailyHelp"),
  kpiCount: $("#kpiCount"),
  kpiError: $("#kpiError"),

  // Filters
  search: $("#search"),
  categoryFilter: $("#categoryFilter"),
  modeFilter: $("#modeFilter"),

  // Chips / toggles
  chipPending: $("#chipPending"),
  chipShowDone: $("#chipShowDone"),
  btnResetFilters: $("#btnResetFilters"),
  btnCollapseDone: $("#btnCollapseDone"),

  // Notes
  dayNotes: $("#dayNotes"),
  noteSaved: $("#noteSaved"),

  // Views nav
  btnToday: $("#btnToday"),
  btnWeek: $("#btnWeek"),
  btnManage: $("#btnManage"),

  // Views
  viewToday: $("#viewToday"),
  viewWeek: $("#viewWeek"),
  viewManage: $("#viewManage"),

  // Day nav
  prevDay: $("#prevDay"),
  nextDay: $("#nextDay"),

  // Today lists
  todaySub: $("#todaySub"),
  pendingList: $("#pendingList"),
  doneList: $("#doneList"),
  pendingCount: $("#pendingCount"),
  doneCount: $("#doneCount"),
  doneBucket: $("#doneBucket"),

  // Bulk
  btnCheckAll: $("#btnCheckAll"),
  btnUncheckAll: $("#btnUncheckAll"),

  // Week
  prevWeek: $("#prevWeek"),
  nextWeek: $("#nextWeek"),
  weekGrid: $("#weekGrid"),
  weekByDay: $("#weekByDay"),
  weekByCategory: $("#weekByCategory"),
  weekSub: $("#weekSub"),

  // Manage
  btnAdd: $("#btnAdd"),
  manageForm: $("#manageForm"),
  mName: $("#mName"),
  mCategory: $("#mCategory"),
  mType: $("#mType"),
  mSub: $("#mSub"),
  btnCancelEdit: $("#btnCancelEdit"),
  btnSaveActivity: $("#btnSaveActivity"),
  manageList: $("#manageList"),
  manageSearch: $("#manageSearch"),
  manageFilterType: $("#manageFilterType"),

  // Export/Import
  btnExport: $("#btnExport"),
  importFile: $("#importFile"),
};

const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function todayISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function isoToDate(iso) {
  return new Date(iso + "T00:00:00");
}

function addDays(iso, delta) {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + delta);
  return todayISO(d);
}

function startOfWeekISO(iso) {
  const d = isoToDate(iso);
  const dow = d.getDay(); // 0..6 (domingo..sábado)
  d.setDate(d.getDate() - dow);
  return todayISO(d);
}

function fmtDateLong(iso) {
  const d = isoToDate(iso);
  return d.toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeHTML(s) {
  return (s || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[ch]));
}

// ---------- Data model ----------
// db = {
//   activities: [{id,name,category,subcategory,type}],
//   logs: { [isoDate]: { checksDaily: { [activityId]: true }, notes: "" } },
//   cycle: { weekStartISO: "YYYY-MM-DD", done: { [activityId]: true } } // complement weekly rotation
// }
function seedDB() {
  const seed = (window.RITUAL_SEED || []).map((a) => ({
    id: uid(),
    name: (a.name || "").trim(),
    category: (a.category || "").trim() || "General",
    subcategory: (a.subcategory || "").trim(),
    type: a.type === "daily" ? "daily" : "complement",
  }));

  return {
    activities: seed,
    logs: {},
    cycle: { weekStartISO: startOfWeekISO(todayISO()), done: {} },
  };
}

function migrateDB(db) {
  // Ensure structure
  if (!db || typeof db !== "object") return seedDB();
  if (!Array.isArray(db.activities)) db.activities = [];
  if (!db.logs || typeof db.logs !== "object") db.logs = {};

  // Migrate legacy logs: checks -> checksDaily
  Object.keys(db.logs).forEach((iso) => {
    const day = db.logs[iso];
    if (!day) return;
    if (day.checks && !day.checksDaily) {
      day.checksDaily = day.checks;
      delete day.checks;
    }
    if (!day.checksDaily) day.checksDaily = {};
    if (typeof day.notes !== "string") day.notes = day.notes || "";
  });

  // Ensure cycle
  if (!db.cycle || typeof db.cycle !== "object") {
    db.cycle = { weekStartISO: startOfWeekISO(todayISO()), done: {} };
  }
  if (!db.cycle.weekStartISO) db.cycle.weekStartISO = startOfWeekISO(todayISO());
  if (!db.cycle.done || typeof db.cycle.done !== "object") db.cycle.done = {};

  // Ensure each activity has required fields
  db.activities = db.activities
    .filter((a) => a && typeof a === "object")
    .map((a) => ({
      id: a.id || uid(),
      name: (a.name || "").trim() || "Sin nombre",
      category: (a.category || "").trim() || "General",
      subcategory: (a.subcategory || "").trim(),
      type: a.type === "daily" ? "daily" : "complement",
    }));

  return db;
}

function loadDB() {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateDB(parsed);
      localStorage.setItem(LS_KEY, JSON.stringify(migrated));
      return migrated;
    } catch (e) {
      // fall through to seed
    }
  }
  const db = seedDB();
  saveDB(db);
  return db;
}

function saveDB(db) {
  localStorage.setItem(LS_KEY, JSON.stringify(db));
}

function loadState() {
  const raw = localStorage.getItem(LS_STATE);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        view: parsed.view || "today",
        dateISO: parsed.dateISO || todayISO(),
        weekStartISO: parsed.weekStartISO || startOfWeekISO(todayISO()),
        editId: parsed.editId || null,
        showDone: parsed.showDone !== false,
        collapseDone: parsed.collapseDone === true ? true : false,
        pendingFirst: parsed.pendingFirst !== false,
      };
    } catch (e) {}
  }
  return {
    view: "today",
    dateISO: todayISO(),
    weekStartISO: startOfWeekISO(todayISO()),
    editId: null,
    showDone: true,
    collapseDone: false,
    pendingFirst: true,
  };
}

function saveState(st) {
  localStorage.setItem(LS_STATE, JSON.stringify(st));
}

let db = loadDB();
let state = loadState();

// ---------- Helpers ----------
function ensureDay(iso) {
  if (!db.logs[iso]) db.logs[iso] = { checksDaily: {}, notes: "" };
  if (!db.logs[iso].checksDaily) db.logs[iso].checksDaily = {};
  if (typeof db.logs[iso].notes !== "string") db.logs[iso].notes = db.logs[iso].notes || "";
}

function ensureCycle() {
  const currentWeek = startOfWeekISO(todayISO());
  if (!db.cycle) db.cycle = { weekStartISO: currentWeek, done: {} };
  if (!db.cycle.weekStartISO) db.cycle.weekStartISO = currentWeek;
  if (!db.cycle.done) db.cycle.done = {};

  // If week changed, reset rotation
  if (db.cycle.weekStartISO !== currentWeek) {
    db.cycle.weekStartISO = currentWeek;
    db.cycle.done = {};
    saveDB(db);
  }
}

function aById(id) {
  return db.activities.find((x) => x.id === id);
}

function getChipPressed(el) {
  return el && el.getAttribute("aria-pressed") === "true";
}

function setChipPressed(el, pressed) {
  if (!el) return;
  el.setAttribute("aria-pressed", String(pressed));
  el.classList.toggle("chipOff", !pressed);
}

function rebuildCategoryFilter() {
  const cats = [...new Set(db.activities.map((a) => a.category))].sort((a, b) =>
    a.localeCompare(b)
  );
  const current = els.categoryFilter?.value || "__all__";

  if (!els.categoryFilter) return;
  els.categoryFilter.innerHTML =
    `<option value="__all__">Todas las categorías</option>` +
    cats.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");

  els.categoryFilter.value = cats.includes(current) ? current : "__all__";
}

function getFilteredActivities(forManage = false) {
  const q = ((forManage ? els.manageSearch?.value : els.search?.value) || "")
    .trim()
    .toLowerCase();

  const cat = els.categoryFilter?.value || "__all__";
  const mode = (forManage ? els.manageFilterType?.value : els.modeFilter?.value) || "all";

  return db.activities
    .filter((a) => {
      const hay = `${a.name} ${a.category} ${a.subcategory}`.toLowerCase();
      if (q && !hay.includes(q)) return false;

      if (!forManage) {
        if (cat !== "__all__" && a.category !== cat) return false;
        if (mode === "daily" && a.type !== "daily") return false;
        if (mode === "complement" && a.type !== "complement") return false;
      } else {
        if (mode !== "__all__" && a.type !== mode) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // daily first, then category, then name
      if (a.type !== b.type) return a.type === "daily" ? -1 : 1;
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });
}

function isDoneFor(iso, activity) {
  ensureDay(iso);
  ensureCycle();
  if (activity.type === "daily") {
    return !!db.logs[iso].checksDaily[activity.id];
  }
  return !!db.cycle.done[activity.id];
}

function setDoneFor(iso, activity, v) {
  ensureDay(iso);
  ensureCycle();
  if (activity.type === "daily") {
    if (v) db.logs[iso].checksDaily[activity.id] = true;
    else delete db.logs[iso].checksDaily[activity.id];
  } else {
    if (v) db.cycle.done[activity.id] = true;
    else delete db.cycle.done[activity.id];
  }
  saveDB(db);
}

// ---------- View switching ----------
function setView(view) {
  state.view = view;
  saveState(state);

  els.viewToday?.classList.toggle("hidden", view !== "today");
  els.viewWeek?.classList.toggle("hidden", view !== "week");
  els.viewManage?.classList.toggle("hidden", view !== "manage");

  if (view === "today") renderToday();
  if (view === "week") renderWeek();
  if (view === "manage") renderManage();
}

// ---------- Notes autosave ----------
let notesTimer = null;
function bindNotesAutosave(iso) {
  if (!els.dayNotes) return;
  els.dayNotes.oninput = () => {
    if (!els.noteSaved) return;
    els.noteSaved.textContent = "escribiendo...";
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => {
      ensureDay(iso);
      db.logs[iso].notes = els.dayNotes.value || "";
      saveDB(db);
      els.noteSaved.textContent = "guardado";
    }, 420);
  };
}

// ---------- Render Today ----------
function renderToday() {
  const iso = state.dateISO;
  ensureDay(iso);
  ensureCycle();
  rebuildCategoryFilter();

  // Sync chips from state (if any)
  if (els.chipPending) setChipPressed(els.chipPending, state.pendingFirst);
  if (els.chipShowDone) setChipPressed(els.chipShowDone, state.showDone);

  // Title
  if (els.dateTitle) els.dateTitle.textContent = fmtDateLong(iso);

  // Notes
  if (els.dayNotes) els.dayNotes.value = db.logs[iso].notes || "";
  bindNotesAutosave(iso);

  const activities = getFilteredActivities(false);

  // Split pending/done
  const pending = [];
  const done = [];
  for (const a of activities) {
    (isDoneFor(iso, a) ? done : pending).push(a);
  }

  // Pending-first toggle affects rendering order only (not logic)
  const renderPendingFirst = state.pendingFirst !== false;
  const showDone = state.showDone !== false;

  // Subtext
  if (els.todaySub) {
    const mf = els.modeFilter?.value || "all";
    const modeLabel =
      mf === "daily" ? "Diarias" : mf === "complement" ? "Rotación" : "Todo";
    els.todaySub.textContent = `${modeLabel} · ${renderPendingFirst ? "Pendientes primero" : "Orden normal"} · ${
      showDone ? "Mostrando hechas" : "Ocultando hechas"
    }`;
  }

  // Counts
  if (els.pendingCount) els.pendingCount.textContent = pending.length;
  if (els.doneCount) els.doneCount.textContent = done.length;

  // Collapse done bucket
  if (els.doneBucket) {
    const collapse = state.collapseDone === true;
    els.doneBucket.classList.toggle("hidden", collapse || !showDone);
    if (els.btnCollapseDone) {
      els.btnCollapseDone.textContent = showDone ? `Hechas: ${collapse ? "OFF" : "ON"}` : "Hechas: OFF";
    }
  }

  // Render lists
  const targetPending = els.pendingList;
  const targetDone = els.doneList;

  if (targetPending) {
    targetPending.innerHTML = renderActivityCards(pending, iso);
  }
  if (targetDone) {
    targetDone.innerHTML = showDone ? renderActivityCards(done, iso) : "";
  }

  // If not pending-first, you might want done above (optional). For now keep buckets fixed.
  // (Because UX: "qué falta" arriba siempre es lo más útil.)

  // Bind checkbox events (both lists)
  bindCheckboxesIn(targetPending, iso);
  bindCheckboxesIn(targetDone, iso);

  // KPIs
  renderKPIs(iso);
}

function renderActivityCards(list, iso) {
  if (!list.length) {
    return `<div class="hint tiny" style="padding:10px 2px;">Nada por acá ✅</div>`;
  }

  return list
    .map((a) => {
      const checked = isDoneFor(iso, a);
      const typeLabel = a.type === "daily" ? "Diaria" : "Rotación semanal";
      return `
        <div class="item">
          <input class="chk" type="checkbox" data-id="${a.id}" ${checked ? "checked" : ""} />
          <div class="itemMain">
            <p class="itemTitle">${escapeHTML(a.name)}</p>
            <div class="itemMeta">
              <span class="tag">${escapeHTML(a.category)}</span>
              ${a.subcategory ? `<span class="tag">${escapeHTML(a.subcategory)}</span>` : ""}
              <span class="tag">${typeLabel}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function bindCheckboxesIn(container, iso) {
  if (!container) return;
  container.querySelectorAll(".chk").forEach((chk) => {
    chk.addEventListener("change", (e) => {
      const id = e.target.dataset.id;
      const a = aById(id);
      if (!a) return;

      setDoneFor(iso, a, e.target.checked);
      renderToday(); // refresh stats and move between buckets
    });
  });
}

function renderKPIs(iso) {
  // KPI 1: Daily completion based on DAILY activities (always)
  const dailyActs = db.activities.filter((a) => a.type === "daily");
  const totalDaily = dailyActs.length;
  const doneDaily = dailyActs.reduce((acc, a) => acc + (isDoneFor(iso, a) ? 1 : 0), 0);
  const pctDaily = totalDaily ? Math.round((doneDaily / totalDaily) * 100) : 0;

  if (els.kpiDaily) els.kpiDaily.textContent = `${pctDaily}%`;
  if (els.kpiDailyHelp) els.kpiDailyHelp.textContent = `diarias hoy (${doneDaily}/${totalDaily})`;

  // KPI 2: visible done/total based on current filters/mode
  const visible = getFilteredActivities(false);
  const doneVisible = visible.reduce((acc, a) => acc + (isDoneFor(iso, a) ? 1 : 0), 0);
  if (els.kpiCount) els.kpiCount.textContent = `${doneVisible}/${visible.length}`;

  // KPI 3: Tiempo de error (si existe en actividades)
  const errAct = db.activities.find((a) => a.name.toLowerCase() === "tiempo de error");
  let errVal = 0;
  if (errAct) errVal = isDoneFor(iso, errAct) ? 1 : 0;
  if (els.kpiError) els.kpiError.textContent = String(errVal);
}

// ---------- Bulk toggles (diarias visibles) ----------
function bulkToggle(mode) {
  const iso = state.dateISO;
  ensureDay(iso);

  const visible = getFilteredActivities(false).filter((a) => a.type === "daily");
  visible.forEach((a) => {
    if (mode === "check") setDoneFor(iso, a, true);
    if (mode === "uncheck") setDoneFor(iso, a, false);
  });

  renderToday();
}

// ---------- Render Week ----------
function renderWeek() {
  // Keep weekStart aligned with state
  const w0 = state.weekStartISO || startOfWeekISO(todayISO());
  state.weekStartISO = w0;
  saveState(state);

  const days = Array.from({ length: 7 }, (_, i) => addDays(w0, i));
  const dailyActs = db.activities.filter((a) => a.type === "daily");
  const totalDaily = dailyActs.length;

  if (els.weekSub) {
    const d0 = isoToDate(w0);
    const d6 = isoToDate(addDays(w0, 6));
    const range = `${d0.toLocaleDateString("es-CO", { month: "short", day: "numeric" })} - ${d6.toLocaleDateString("es-CO", { month: "short", day: "numeric" })}`;
    els.weekSub.textContent = `Semana ${range} · basado en diarias`;
  }

  // Week grid cards
  if (els.weekGrid) {
    els.weekGrid.innerHTML = days
      .map((iso) => {
        ensureDay(iso);
        const done = dailyActs.reduce((acc, a) => acc + (isDoneFor(iso, a) ? 1 : 0), 0);
        const pct = totalDaily ? Math.round((done / totalDaily) * 100) : 0;

        const d = isoToDate(iso);
        const name = dayNames[d.getDay()];
        const shortDate = d.toLocaleDateString("es-CO", { month: "short", day: "numeric" });

        return `
          <div class="dayCard" data-iso="${iso}">
            <div class="dayName">${name}</div>
            <div class="dayDate">${shortDate}</div>
            <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
            <div class="dayStats">${pct}% · ${done}/${totalDaily}</div>
          </div>
        `;
      })
      .join("");

    els.weekGrid.querySelectorAll(".dayCard").forEach((card) => {
      card.addEventListener("click", () => {
        state.dateISO = card.dataset.iso;
        saveState(state);
        setView("today");
      });
    });
  }

  // Week by day table
  if (els.weekByDay) {
    els.weekByDay.innerHTML = days
      .map((iso) => {
        ensureDay(iso);
        const done = dailyActs.reduce((acc, a) => acc + (isDoneFor(iso, a) ? 1 : 0), 0);
        const pct = totalDaily ? Math.round((done / totalDaily) * 100) : 0;
        return `
          <div class="row">
            <div>${escapeHTML(fmtDateLong(iso).replace(/^\w+,\s*/,""))}</div>
            <div><b>${pct}%</b> <span class="muted">(${done}/${totalDaily})</span></div>
          </div>
        `;
      })
      .join("");
  }

  // Week by category (daily)
  if (els.weekByCategory) {
    const cats = [...new Set(dailyActs.map((a) => a.category))].sort((a, b) =>
      a.localeCompare(b)
    );

    const stats = cats
      .map((cat) => {
        const acts = dailyActs.filter((a) => a.category === cat);
        const denom = acts.length * 7;
        let num = 0;

        for (const iso of days) {
          for (const a of acts) {
            if (isDoneFor(iso, a)) num++;
          }
        }

        const pct = denom ? Math.round((num / denom) * 100) : 0;
        return { cat, pct, num, denom };
      })
      .sort((a, b) => b.pct - a.pct);

    els.weekByCategory.innerHTML = stats
      .map(
        (s) => `
        <div class="row">
          <div>${escapeHTML(s.cat)}</div>
          <div><b>${s.pct}%</b> <span class="muted">(${s.num}/${s.denom})</span></div>
        </div>
      `
      )
      .join("");
  }
}

// ---------- Manage ----------
function openAdd() {
  state.editId = null;
  saveState(state);
  if (els.manageForm) els.manageForm.classList.remove("hidden");

  if (els.mName) els.mName.value = "";
  if (els.mCategory) els.mCategory.value = "";
  if (els.mType) els.mType.value = "daily";
  if (els.mSub) els.mSub.value = "";
  els.mName?.focus();
}

function openEdit(id) {
  const a = aById(id);
  if (!a) return;
  state.editId = id;
  saveState(state);

  if (els.manageForm) els.manageForm.classList.remove("hidden");
  if (els.mName) els.mName.value = a.name;
  if (els.mCategory) els.mCategory.value = a.category;
  if (els.mType) els.mType.value = a.type;
  if (els.mSub) els.mSub.value = a.subcategory || "";
}

function closeForm() {
  if (els.manageForm) els.manageForm.classList.add("hidden");
  state.editId = null;
  saveState(state);
}

function saveActivityFromForm() {
  const name = (els.mName?.value || "").trim();
  const category = (els.mCategory?.value || "").trim();
  const type = els.mType?.value === "daily" ? "daily" : "complement";
  const sub = (els.mSub?.value || "").trim();

  if (!name || !category) {
    alert("Pon nombre y categoría. El caos no se administra solo.");
    return;
  }

  if (state.editId) {
    const a = aById(state.editId);
    if (!a) return;
    a.name = name;
    a.category = category;
    a.type = type;
    a.subcategory = sub;
  } else {
    db.activities.push({
      id: uid(),
      name,
      category,
      type,
      subcategory: sub,
    });
  }

  saveDB(db);
  rebuildCategoryFilter();
  closeForm();
  renderManage();
  renderToday();
}

function deleteActivity(id) {
  const a = aById(id);
  if (!a) return;

  const ok = confirm(`¿Borrar "${a.name}"?\nEsto borra su historial asociado en los checks.`);
  if (!ok) return;

  // remove from activities
  db.activities = db.activities.filter((x) => x.id !== id);

  // remove from daily logs
  for (const iso of Object.keys(db.logs)) {
    if (db.logs[iso]?.checksDaily?.[id]) delete db.logs[iso].checksDaily[id];
  }

  // remove from weekly cycle done
  if (db.cycle?.done?.[id]) delete db.cycle.done[id];

  saveDB(db);
  rebuildCategoryFilter();
  renderManage();
  renderToday();
}

function renderManage() {
  rebuildCategoryFilter();

  const list = getFilteredActivities(true);

  if (els.manageList) {
    els.manageList.innerHTML = list
      .slice()
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
      .map((a) => {
        const t = a.type === "daily" ? "Diaria" : "Rotación semanal";
        const sub = a.subcategory ? ` · ${a.subcategory}` : "";
        return `
          <div class="manageItem">
            <div>
              <div class="manageName">${escapeHTML(a.name)}</div>
              <div class="manageMeta">${escapeHTML(a.category)}${escapeHTML(sub)} · ${t}</div>
            </div>
            <div class="smallBtns">
              <button class="small" data-edit="${a.id}" type="button">Editar</button>
              <button class="small danger" data-del="${a.id}" type="button">Borrar</button>
            </div>
          </div>
        `;
      })
      .join("");

    els.manageList.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openEdit(btn.dataset.edit));
    });
    els.manageList.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => deleteActivity(btn.dataset.del));
    });
  }
}

// ---------- Export/Import ----------
function exportJSON() {
  const payload = {
    meta: { exportedAt: new Date().toISOString(), version: 2 },
    db,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `ritual_backup_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const obj = JSON.parse(fr.result);
      if (!obj?.db?.activities || !obj?.db?.logs) {
        alert("Ese JSON no parece un backup de Ritual.");
        return;
      }
      db = migrateDB(obj.db);
      saveDB(db);
      rebuildCategoryFilter();
      renderToday();
      renderWeek();
      renderManage();
      alert("Importado. Tus datos sobrevivieron a la realidad ✅");
    } catch (e) {
      alert("JSON inválido.");
    }
  };
  fr.readAsText(file);
}

// ---------- PWA ----------
function initPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

// ---------- Bind events ----------
function bind() {
  // Nav
  els.btnToday && (els.btnToday.onclick = () => setView("today"));
  els.btnWeek && (els.btnWeek.onclick = () => {
    state.weekStartISO = startOfWeekISO(state.dateISO);
    saveState(state);
    setView("week");
  });
  els.btnManage && (els.btnManage.onclick = () => setView("manage"));

  // Day nav
  els.prevDay && (els.prevDay.onclick = () => {
    state.dateISO = addDays(state.dateISO, -1);
    saveState(state);
    renderToday();
  });
  els.nextDay && (els.nextDay.onclick = () => {
    state.dateISO = addDays(state.dateISO, +1);
    saveState(state);
    renderToday();
  });

  // Week nav
  els.prevWeek && (els.prevWeek.onclick = () => {
    state.weekStartISO = addDays(state.weekStartISO, -7);
    saveState(state);
    renderWeek();
  });
  els.nextWeek && (els.nextWeek.onclick = () => {
    state.weekStartISO = addDays(state.weekStartISO, +7);
    saveState(state);
    renderWeek();
  });

  // Filters
  els.search && (els.search.oninput = () => renderToday());
  els.categoryFilter && (els.categoryFilter.onchange = () => renderToday());
  els.modeFilter && (els.modeFilter.onchange = () => renderToday());

  // Chips
  if (els.chipPending) {
    els.chipPending.addEventListener("click", () => {
      state.pendingFirst = !getChipPressed(els.chipPending);
      saveState(state);
      renderToday();
    });
  }

  if (els.chipShowDone) {
    els.chipShowDone.addEventListener("click", () => {
      state.showDone = !getChipPressed(els.chipShowDone);
      saveState(state);
      renderToday();
    });
  }

  // Collapse done bucket
  if (els.btnCollapseDone) {
    els.btnCollapseDone.addEventListener("click", () => {
      state.collapseDone = !state.collapseDone;
      saveState(state);
      renderToday();
    });
  }

  // Reset filters
  if (els.btnResetFilters) {
    els.btnResetFilters.addEventListener("click", () => {
      if (els.search) els.search.value = "";
      if (els.categoryFilter) els.categoryFilter.value = "__all__";
      if (els.modeFilter) els.modeFilter.value = "all";
      state.pendingFirst = true;
      state.showDone = true;
      state.collapseDone = false;
      saveState(state);
      renderToday();
    });
  }

  // Bulk
  els.btnCheckAll && (els.btnCheckAll.onclick = () => bulkToggle("check"));
  els.btnUncheckAll && (els.btnUncheckAll.onclick = () => bulkToggle("uncheck"));

  // Manage
  els.btnAdd && (els.btnAdd.onclick = () => openAdd());
  els.btnCancelEdit && (els.btnCancelEdit.onclick = () => closeForm());
  els.btnSaveActivity && (els.btnSaveActivity.onclick = () => saveActivityFromForm());

  els.manageSearch && (els.manageSearch.oninput = () => renderManage());
  els.manageFilterType && (els.manageFilterType.onchange = () => renderManage());

  // Export/Import
  els.btnExport && (els.btnExport.onclick = () => exportJSON());
  els.importFile &&
    (els.importFile.onchange = (e) => {
      const f = e.target.files?.[0];
      if (f) importJSON(f);
      e.target.value = "";
    });
}

// ---------- Boot ----------
function boot() {
  ensureCycle();
  rebuildCategoryFilter();
  bind();
  initPWA();
  setView(state.view || "today");
}

boot();

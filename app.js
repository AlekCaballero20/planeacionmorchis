/* app.js
   Ritual - Alek & Cata (PRO upgrade)
   ------------------------------------------------------------
   ✅ Diarias: check por día
   ✅ Complementarias: rotación semanal (ciclo)
   ✅ Vista Hoy: Pendientes + Hechas (con filtros + chips)
   ✅ Vista Semana: % por día y por categoría (diarias)
   ✅ Manage: agregar/editar/borrar + búsqueda + filtro tipo
   ✅ Backup: export/import (incluye state)
   ✅ NUEVO: Tabs accesibles + nuevas vistas (Dashboard/Stats/Settings)
   ✅ NUEVO: Export CSV + wipe data
   ✅ NUEVO: energía + duración (opcional)
   ✅ NUEVO: toast + modal overlay (si existe en HTML)
   ✅ NUEVO: balance pill + charts canvas básicos
   ❌ NO PWA
*/

(() => {
  "use strict";

  // ---------------- Constants ----------------
  const LS_KEY = "ritual_v3_db";
  const LS_STATE = "ritual_v3_state";
  const DB_SCHEMA = 3;

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  // ---------------- DOM helpers ----------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function on(el, evt, fn, opts) {
    if (!el) return;
    el.addEventListener(evt, fn, opts);
  }

  // ---------------- Elements ----------------
  const els = {
    // Titles / KPIs
    dateTitle: $("#dateTitle"),
    kpiDaily: $("#kpiDaily"),
    kpiDailyHelp: $("#kpiDailyHelp"),
    kpiCount: $("#kpiCount"),
    kpiError: $("#kpiError"),

    balancePill: $("#balancePill"),

    // Filters
    search: $("#search"),
    categoryFilter: $("#categoryFilter"),
    modeFilter: $("#modeFilter"),
    energyFilter: $("#energyFilter"),

    // Chips / toggles
    chipPending: $("#chipPending"),
    chipShowDone: $("#chipShowDone"),
    btnResetFilters: $("#btnResetFilters"),
    btnCollapseDone: $("#btnCollapseDone"),

    // Notes
    dayNotes: $("#dayNotes"),
    noteSaved: $("#noteSaved"),

    // Tabs (Nav)
    btnToday: $("#btnToday"),
    btnWeek: $("#btnWeek"),
    btnManage: $("#btnManage"),
    btnDashboard: $("#btnDashboard"),
    btnStats: $("#btnStats"),
    btnSettings: $("#btnSettings"),

    // Views
    viewToday: $("#viewToday"),
    viewWeek: $("#viewWeek"),
    viewManage: $("#viewManage"),
    viewDashboard: $("#viewDashboard"),
    viewStats: $("#viewStats"),
    viewSettings: $("#viewSettings"),

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
    mDuration: $("#mDuration"),
    mEnergy: $("#mEnergy"),
    btnCancelEdit: $("#btnCancelEdit"),
    btnSaveActivity: $("#btnSaveActivity"),
    manageList: $("#manageList"),
    manageSearch: $("#manageSearch"),
    manageFilterType: $("#manageFilterType"),

    // Export/Import (Topbar)
    btnExport: $("#btnExport"),
    importFile: $("#importFile"),
    btnExportCSV: $("#btnExportCSV"),

    // Export/Import (Settings view duplicates)
    btnExport2: $("#btnExport2"),
    importFile2: $("#importFile2"),
    btnExportCSV2: $("#btnExportCSV2"),
    btnWipeAll: $("#btnWipeAll"),

    // Dashboard
    btnRefreshDashboard: $("#btnRefreshDashboard"),
    dashKpis: $("#dashKpis"),
    dashTopCategories: $("#dashTopCategories"),
    chartBalance: $("#chartBalance"),
    chartEnergy: $("#chartEnergy"),
    chartBalanceHint: $("#chartBalanceHint"),
    chartEnergyHint: $("#chartEnergyHint"),

    // Stats
    statsRange: $("#statsRange"),
    statsConsistency: $("#statsConsistency"),
    chartDone: $("#chartDone"),
    statsByCategory: $("#statsByCategory"),
    statsAvoided: $("#statsAvoided"),

    // Toast/Modal
    toastRegion: $("#toastRegion"),
    modalOverlay: $("#modalOverlay"),
    modalClose: $("#modalClose"),
    modalTitle: $("#modalTitle"),
    modalDesc: $("#modalDesc"),
    modalContent: $("#modalContent"),
    modalActions: $("#modalActions"),
  };

  // ---------------- Utils ----------------
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
    const dow = d.getDay(); // domingo..sábado
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
    return (s || "").replace(/[&<>"']/g, (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[ch])
    );
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function csvEscape(v) {
    const s = String(v ?? "");
    if (/[,"\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  // ---------------- Toast ----------------
  let toastTimer = null;

  function toast(msg, type = "info") {
    if (!els.toastRegion) return;

    // simple queue: replace content
    clearTimeout(toastTimer);
    els.toastRegion.innerHTML = `
      <div class="toast ${escapeHTML(type)}" role="status">
        <div class="toastMsg">${escapeHTML(msg)}</div>
      </div>
    `;
    toastTimer = setTimeout(() => {
      if (els.toastRegion) els.toastRegion.innerHTML = "";
    }, 2400);
  }

  // ---------------- Modal ----------------
  function modalOpen({ title = "Modal", desc = "", contentHTML = "", actions = [] } = {}) {
    if (!els.modalOverlay) return;

    els.modalTitle && (els.modalTitle.textContent = title);
    els.modalDesc && (els.modalDesc.textContent = desc);
    if (els.modalContent) els.modalContent.innerHTML = contentHTML;
    if (els.modalActions) {
      els.modalActions.innerHTML = actions
        .map((a, i) => {
          const cls = a.kind === "danger" ? "btn danger" : a.kind === "ghost" ? "btn ghost" : "btn";
          return `<button class="${cls}" data-modal-action="${i}" type="button">${escapeHTML(a.label || "OK")}</button>`;
        })
        .join("");
      // bind actions
      $$("[data-modal-action]").forEach((btn) => {
        on(btn, "click", () => {
          const idx = Number(btn.dataset.modalAction);
          const fn = actions?.[idx]?.onClick;
          if (typeof fn === "function") fn();
        });
      });
    }

    els.modalOverlay.classList.remove("hidden");
    els.modalOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modalOpen");
  }

  function modalClose() {
    if (!els.modalOverlay) return;
    els.modalOverlay.classList.add("hidden");
    els.modalOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modalOpen");
  }

  // Click outside to close (optional)
  on(els.modalOverlay, "click", (e) => {
    if (e.target === els.modalOverlay) modalClose();
  });
  on(els.modalClose, "click", modalClose);
  on(document, "keydown", (e) => {
    if (e.key === "Escape" && els.modalOverlay && !els.modalOverlay.classList.contains("hidden")) {
      modalClose();
    }
  });

  // ---------------- Data model ----------------
  // db = {
  //   schemaVersion: 3,
  //   activities: [{id,name,category,subcategory,type,energy?,duration?}],
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
      // new optional fields
      energy: a.energy === "low" || a.energy === "mid" || a.energy === "high" ? a.energy : undefined,
      duration: Number.isFinite(Number(a.duration)) ? clamp(Number(a.duration), 0, 600) : undefined,
    }));

    return {
      schemaVersion: DB_SCHEMA,
      activities: seed,
      logs: {},
      cycle: { weekStartISO: startOfWeekISO(todayISO()), done: {} },
    };
  }

  function normalizeActivity(a) {
    const energy = a.energy;
    const normEnergy = energy === "low" || energy === "mid" || energy === "high" ? energy : undefined;

    const durNum = a.duration === 0 ? 0 : Number(a.duration);
    const normDuration = Number.isFinite(durNum) ? clamp(durNum, 0, 600) : undefined;

    return {
      id: a.id || uid(),
      name: (a.name || "").trim() || "Sin nombre",
      category: (a.category || "").trim() || "General",
      subcategory: (a.subcategory || "").trim(),
      type: a.type === "daily" ? "daily" : "complement",
      energy: normEnergy,
      duration: normDuration,
    };
  }

  function migrateDB(db) {
    if (!db || typeof db !== "object") return seedDB();

    // schema
    if (!db.schemaVersion) db.schemaVersion = 1;

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

    // Normalize activities
    db.activities = db.activities
      .filter((a) => a && typeof a === "object")
      .map(normalizeActivity);

    // upgrade schema to v3
    db.schemaVersion = DB_SCHEMA;

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
        // fall through
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
          weekStartISO: parsed.weekStartISO || startOfWeekISO(parsed.dateISO || todayISO()),
          editId: parsed.editId || null,

          // UI prefs
          showDone: parsed.showDone !== false,
          collapseDone: parsed.collapseDone === true,
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

  // ---------------- Helpers ----------------
  function ensureDay(iso) {
    if (!db.logs[iso]) db.logs[iso] = { checksDaily: {}, notes: "" };
    if (!db.logs[iso].checksDaily) db.logs[iso].checksDaily = {};
    if (typeof db.logs[iso].notes !== "string") db.logs[iso].notes = db.logs[iso].notes || "";
  }

  function ensureCycleFor(refISO) {
    const week = startOfWeekISO(refISO || todayISO());
    if (!db.cycle || typeof db.cycle !== "object") db.cycle = { weekStartISO: week, done: {} };
    if (!db.cycle.weekStartISO) db.cycle.weekStartISO = week;
    if (!db.cycle.done || typeof db.cycle.done !== "object") db.cycle.done = {};

    if (db.cycle.weekStartISO !== week) {
      db.cycle.weekStartISO = week;
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

  function energyLabel(v) {
    if (v === "low") return "Energía baja";
    if (v === "mid") return "Energía media";
    if (v === "high") return "Energía alta";
    return "Energía —";
  }

  // categories caching
  let categoriesCacheKey = "";
  function categoriesFingerprint() {
    const cats = db.activities.map((a) => a.category).join("|");
    return `${db.activities.length}::${cats}`;
  }

  function rebuildCategoryFilterIfNeeded() {
    if (!els.categoryFilter) return;
    const fp = categoriesFingerprint();
    if (fp === categoriesCacheKey) return;
    categoriesCacheKey = fp;

    const cats = [...new Set(db.activities.map((a) => a.category).filter(Boolean))]
      .map((c) => c.trim() || "General")
      .sort((a, b) => a.localeCompare(b));

    const current = els.categoryFilter.value || "__all__";
    els.categoryFilter.innerHTML =
      `<option value="__all__">Todas las categorías</option>` +
      cats.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");

    els.categoryFilter.value = cats.includes(current) ? current : "__all__";
  }

  function getFilteredActivities({ forManage = false } = {}) {
    const q = ((forManage ? els.manageSearch?.value : els.search?.value) || "").trim().toLowerCase();

    const cat = els.categoryFilter?.value || "__all__";
    const mode =
      (forManage ? els.manageFilterType?.value : els.modeFilter?.value) || (forManage ? "__all__" : "all");

    const energy = els.energyFilter?.value || "__all__";

    return db.activities
      .filter((a) => {
        const hay = `${a.name} ${a.category} ${a.subcategory || ""}`.toLowerCase();
        if (q && !hay.includes(q)) return false;

        if (!forManage) {
          if (cat !== "__all__" && a.category !== cat) return false;
          if (mode === "daily" && a.type !== "daily") return false;
          if (mode === "complement" && a.type !== "complement") return false;

          if (energy !== "__all__") {
            // if activity has no energy, it doesn't match a strict energy filter
            if ((a.energy || "__none__") !== energy) return false;
          }
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
    ensureCycleFor(iso);
    if (activity.type === "daily") return !!db.logs[iso].checksDaily[activity.id];
    return !!db.cycle.done[activity.id];
  }

  function setDoneFor(iso, activity, v) {
    ensureDay(iso);
    ensureCycleFor(iso);

    if (activity.type === "daily") {
      if (v) db.logs[iso].checksDaily[activity.id] = true;
      else delete db.logs[iso].checksDaily[activity.id];
    } else {
      if (v) db.cycle.done[activity.id] = true;
      else delete db.cycle.done[activity.id];
    }
    saveDB(db);
  }

  // ---------------- Tabs / View switching ----------------
  const TAB_MAP = {
    today: { btn: els.btnToday, view: els.viewToday },
    week: { btn: els.btnWeek, view: els.viewWeek },
    manage: { btn: els.btnManage, view: els.viewManage },
    dashboard: { btn: els.btnDashboard, view: els.viewDashboard },
    stats: { btn: els.btnStats, view: els.viewStats },
    settings: { btn: els.btnSettings, view: els.viewSettings },
  };

  function updateTabsUI(activeView) {
    Object.entries(TAB_MAP).forEach(([key, obj]) => {
      const isActive = key === activeView;
      obj.view?.classList.toggle("hidden", !isActive);
      if (obj.btn) {
        obj.btn.classList.toggle("isActive", isActive);
        // a11y tabs if HTML uses role=tab
        if (obj.btn.getAttribute("role") === "tab") {
          obj.btn.setAttribute("aria-selected", String(isActive));
          obj.btn.tabIndex = isActive ? 0 : -1;
        }
      }
    });
  }

  function setView(view) {
    state.view = view;
    saveState(state);

    updateTabsUI(view);

    // render current view
    if (view === "today") renderToday();
    if (view === "week") renderWeek();
    if (view === "manage") renderManage();
    if (view === "dashboard") renderDashboard();
    if (view === "stats") renderStats();
    if (view === "settings") renderSettings();
  }

  // ---------------- Notes autosave ----------------
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

  // ---------------- Render Today ----------------
  function renderToday() {
    const iso = state.dateISO;

    ensureDay(iso);
    ensureCycleFor(iso);
    rebuildCategoryFilterIfNeeded();

    // Sync chips from state
    setChipPressed(els.chipPending, state.pendingFirst !== false);
    setChipPressed(els.chipShowDone, state.showDone !== false);

    if (els.dateTitle) els.dateTitle.textContent = fmtDateLong(iso);

    // Notes
    if (els.dayNotes) els.dayNotes.value = db.logs[iso].notes || "";
    bindNotesAutosave(iso);

    const activities = getFilteredActivities({ forManage: false });

    const pending = [];
    const done = [];
    for (const a of activities) (isDoneFor(iso, a) ? done : pending).push(a);

    const renderPendingFirst = state.pendingFirst !== false;
    const showDone = state.showDone !== false;

    if (els.todaySub) {
      const mf = els.modeFilter?.value || "all";
      const ef = els.energyFilter?.value || "__all__";
      const modeLabel = mf === "daily" ? "Diarias" : mf === "complement" ? "Rotación" : "Todo";
      const energyTxt = ef === "__all__" ? "" : ` · ${energyLabel(ef)}`;
      els.todaySub.textContent =
        `${modeLabel}${energyTxt} · ${renderPendingFirst ? "Pendientes primero" : "Orden normal"} · ` +
        `${showDone ? "Mostrando hechas" : "Ocultando hechas"}`;
    }

    // Counts
    if (els.pendingCount) els.pendingCount.textContent = String(pending.length);
    if (els.doneCount) els.doneCount.textContent = String(done.length);

    // Done bucket visibility
    if (els.doneBucket) {
      const collapse = state.collapseDone === true;
      const shouldHide = collapse || !showDone;
      els.doneBucket.classList.toggle("hidden", shouldHide);

      if (els.btnCollapseDone) {
        if (!showDone) els.btnCollapseDone.textContent = "Hechas: OFF";
        else els.btnCollapseDone.textContent = `Hechas: ${collapse ? "OFF" : "ON"}`;
      }
    }

    // Render lists
    const pendingHTML = renderActivityCards(renderPendingFirst ? pending : pending, iso);
    const doneHTML = showDone ? renderActivityCards(done, iso) : "";

    if (els.pendingList) els.pendingList.innerHTML = pendingHTML;
    if (els.doneList) els.doneList.innerHTML = doneHTML;

    bindCheckboxDelegation(els.pendingList);
    bindCheckboxDelegation(els.doneList);

    renderKPIs(iso);
    renderBalancePill(iso);

    // keep dashboard/stats fresh-ish if user stays there later
    // (lightweight, won't do anything heavy)
  }

  function renderActivityCards(list, iso) {
    if (!list.length) {
      return `<div class="hint tiny" style="padding:10px 2px;">Nada por acá ✅</div>`;
    }

    return list
      .map((a) => {
        const checked = isDoneFor(iso, a);
        const typeLabel = a.type === "daily" ? "Diaria" : "Rotación semanal";

        const energyTag = a.energy ? `<span class="tag">${escapeHTML(a.energy)}</span>` : "";
        const durTag = Number.isFinite(a.duration) ? `<span class="tag">${escapeHTML(a.duration)} min</span>` : "";

        return `
          <div class="item">
            <input class="chk" type="checkbox" data-id="${escapeHTML(a.id)}" ${checked ? "checked" : ""} />
            <div class="itemMain">
              <p class="itemTitle">${escapeHTML(a.name)}</p>
              <div class="itemMeta">
                <span class="tag">${escapeHTML(a.category)}</span>
                ${a.subcategory ? `<span class="tag">${escapeHTML(a.subcategory)}</span>` : ""}
                <span class="tag">${escapeHTML(typeLabel)}</span>
                ${energyTag}
                ${durTag}
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function bindCheckboxDelegation(container) {
    if (!container) return;
    if (container.__ritualBound) return;
    container.__ritualBound = true;

    on(container, "change", (e) => {
      const target = e.target;
      if (!target || !target.classList || !target.classList.contains("chk")) return;

      const id = target.dataset.id;
      const a = aById(id);
      if (!a) return;

      setDoneFor(state.dateISO, a, target.checked);
      renderToday(); // refresh: moves buckets + KPIs
    });
  }

  function renderKPIs(iso) {
    // KPI 1: Daily completion based on DAILY activities (always)
    const dailyActs = db.activities.filter((a) => a.type === "daily");
    const totalDaily = dailyActs.length;
    let doneDaily = 0;

    for (const a of dailyActs) if (isDoneFor(iso, a)) doneDaily++;

    const pctDaily = totalDaily ? Math.round((doneDaily / totalDaily) * 100) : 0;

    if (els.kpiDaily) els.kpiDaily.textContent = `${pctDaily}%`;
    if (els.kpiDailyHelp) els.kpiDailyHelp.textContent = `diarias hoy (${doneDaily}/${totalDaily})`;

    // KPI 2: visible done/total based on current filters/mode
    const visible = getFilteredActivities({ forManage: false });
    let doneVisible = 0;
    for (const a of visible) if (isDoneFor(iso, a)) doneVisible++;
    if (els.kpiCount) els.kpiCount.textContent = `${doneVisible}/${visible.length}`;

    // KPI 3: Tiempo de error (robusto)
    const errAct = db.activities.find((a) => (a.name || "").toLowerCase().includes("tiempo de error"));
    const errVal = errAct ? (isDoneFor(iso, errAct) ? 1 : 0) : 0;
    if (els.kpiError) els.kpiError.textContent = String(errVal);
  }

  function renderBalancePill(iso) {
    if (!els.balancePill) return;

    // Heurística: "descanso" vs "carga" por palabras clave + energía
    const visible = getFilteredActivities({ forManage: false });

    let carga = 0;
    let descanso = 0;

    for (const a of visible) {
      const name = (a.name || "").toLowerCase();
      const cat = (a.category || "").toLowerCase();
      const hay = `${name} ${cat}`;

      const isRestish =
        hay.includes("descanso") ||
        hay.includes("pausa") ||
        hay.includes("respir") ||
        hay.includes("medit") ||
        hay.includes("relaj") ||
        hay.includes("caminar") ||
        hay.includes("natur") ||
        hay.includes("jugar") ||
        hay.includes("dorm");

      const isWorkish =
        hay.includes("finan") ||
        hay.includes("admin") ||
        hay.includes("program") ||
        hay.includes("ventas") ||
        hay.includes("clase") ||
        hay.includes("factur") ||
        hay.includes("deuda") ||
        hay.includes("planea") ||
        hay.includes("revisión") ||
        hay.includes("report");

      // scoring
      let score = 1;
      if (a.energy === "high") score = 2;
      if (a.energy === "low") score = 0.75;

      if (isRestish && !isWorkish) descanso += score;
      else if (isWorkish && !isRestish) carga += score;
      else {
        // ambiguous defaults to "carga" slightly
        carga += score * 0.6;
        descanso += score * 0.4;
      }
    }

    const total = carga + descanso;
    const ratio = total ? descanso / total : 0.5;

    // text and class
    let label = "—";
    let cls = "neutral";
    if (ratio >= 0.58) {
      label = "🟢 Balance suave";
      cls = "good";
    } else if (ratio >= 0.45) {
      label = "🟡 Balance medio";
      cls = "mid";
    } else {
      label = "🔴 Mucha carga";
      cls = "bad";
    }

    els.balancePill.textContent = label;
    els.balancePill.classList.remove("good", "mid", "bad", "neutral");
    els.balancePill.classList.add(cls);
  }

  // ---------------- Bulk toggles (diarias visibles) ----------------
  function bulkToggle(mode) {
    const iso = state.dateISO;
    ensureDay(iso);

    const visibleDaily = getFilteredActivities({ forManage: false }).filter((a) => a.type === "daily");
    for (const a of visibleDaily) setDoneFor(iso, a, mode === "check");
    renderToday();
    toast(mode === "check" ? "Diarias marcadas ✅" : "Diarias desmarcadas 🧼");
  }

  // ---------------- Render Week ----------------
  function renderWeek() {
    const w0 = state.weekStartISO || startOfWeekISO(state.dateISO || todayISO());
    state.weekStartISO = w0;
    saveState(state);

    const days = Array.from({ length: 7 }, (_, i) => addDays(w0, i));
    const dailyActs = db.activities.filter((a) => a.type === "daily");
    const totalDaily = dailyActs.length;

    if (els.weekSub) {
      const d0 = isoToDate(w0);
      const d6 = isoToDate(addDays(w0, 6));
      const range =
        `${d0.toLocaleDateString("es-CO", { month: "short", day: "numeric" })} - ` +
        `${d6.toLocaleDateString("es-CO", { month: "short", day: "numeric" })}`;
      els.weekSub.textContent = `Semana ${range} · basado en diarias`;
    }

    // Week grid cards
    if (els.weekGrid) {
      els.weekGrid.innerHTML = days
        .map((iso) => {
          ensureDay(iso);

          let done = 0;
          for (const a of dailyActs) if (isDoneFor(iso, a)) done++;

          const pct = totalDaily ? Math.round((done / totalDaily) * 100) : 0;

          const d = isoToDate(iso);
          const name = dayNames[d.getDay()];
          const shortDate = d.toLocaleDateString("es-CO", { month: "short", day: "numeric" });

          return `
            <div class="dayCard" data-iso="${escapeHTML(iso)}" role="button" tabindex="0" aria-label="Ir al día ${escapeHTML(shortDate)}">
              <div class="dayName">${escapeHTML(name)}</div>
              <div class="dayDate">${escapeHTML(shortDate)}</div>
              <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
              <div class="dayStats">${pct}% · ${done}/${totalDaily}</div>
            </div>
          `;
        })
        .join("");

      // Click + keyboard (Enter/Space)
      $$(".dayCard").forEach((card) => {
        const go = () => {
          state.dateISO = card.dataset.iso;
          saveState(state);
          setView("today");
        };
        on(card, "click", go);
        on(card, "keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            go();
          }
        });
      });
    }

    // Week by day
    if (els.weekByDay) {
      els.weekByDay.innerHTML = days
        .map((iso) => {
          ensureDay(iso);
          let done = 0;
          for (const a of dailyActs) if (isDoneFor(iso, a)) done++;
          const pct = totalDaily ? Math.round((done / totalDaily) * 100) : 0;

          const pretty = fmtDateLong(iso).replace(/^\w+,\s*/, ""); // quita "lunes, "
          return `
            <div class="row">
              <div>${escapeHTML(pretty)}</div>
              <div><b>${pct}%</b> <span class="muted">(${done}/${totalDaily})</span></div>
            </div>
          `;
        })
        .join("");
    }

    // Week by category (daily)
    if (els.weekByCategory) {
      const cats = [...new Set(dailyActs.map((a) => a.category))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      const stats = cats
        .map((cat) => {
          const acts = dailyActs.filter((a) => a.category === cat);
          const denom = acts.length * 7;
          let num = 0;

          for (const iso of days) for (const a of acts) if (isDoneFor(iso, a)) num++;

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

  // ---------------- Manage ----------------
  function openAdd() {
    state.editId = null;
    saveState(state);

    els.manageForm?.classList.remove("hidden");
    if (els.mName) els.mName.value = "";
    if (els.mCategory) els.mCategory.value = "";
    if (els.mType) els.mType.value = "daily";
    if (els.mSub) els.mSub.value = "";
    if (els.mDuration) els.mDuration.value = "";
    if (els.mEnergy) els.mEnergy.value = "__none__";

    els.mName?.focus();
  }

  function openEdit(id) {
    const a = aById(id);
    if (!a) return;

    state.editId = id;
    saveState(state);

    els.manageForm?.classList.remove("hidden");
    if (els.mName) els.mName.value = a.name;
    if (els.mCategory) els.mCategory.value = a.category;
    if (els.mType) els.mType.value = a.type;
    if (els.mSub) els.mSub.value = a.subcategory || "";
    if (els.mDuration) els.mDuration.value = Number.isFinite(a.duration) ? String(a.duration) : "";
    if (els.mEnergy) els.mEnergy.value = a.energy || "__none__";
  }

  function closeForm() {
    els.manageForm?.classList.add("hidden");
    state.editId = null;
    saveState(state);
  }

  function saveActivityFromForm() {
    const name = (els.mName?.value || "").trim();
    const category = (els.mCategory?.value || "").trim();
    const type = els.mType?.value === "daily" ? "daily" : "complement";
    const sub = (els.mSub?.value || "").trim();

    const durRaw = (els.mDuration?.value || "").trim();
    const dur = durRaw === "" ? undefined : clamp(Number(durRaw), 0, 600);
    const energyRaw = els.mEnergy?.value || "__none__";
    const energy = energyRaw === "low" || energyRaw === "mid" || energyRaw === "high" ? energyRaw : undefined;

    if (!name || !category) {
      toast("Pon nombre y categoría. El caos no se administra solo 😌", "warn");
      return;
    }

    if (durRaw !== "" && !Number.isFinite(Number(durRaw))) {
      toast("Duración inválida. Debe ser un número.", "warn");
      return;
    }

    if (state.editId) {
      const a = aById(state.editId);
      if (!a) return;
      a.name = name;
      a.category = category;
      a.type = type;
      a.subcategory = sub;
      a.duration = dur;
      a.energy = energy;
    } else {
      db.activities.push({
        id: uid(),
        name,
        category,
        type,
        subcategory: sub,
        duration: dur,
        energy,
      });
    }

    saveDB(db);
    categoriesCacheKey = ""; // force rebuild
    closeForm();
    renderManage();
    renderToday();
    toast("Actividad guardada ✅", "ok");
  }

  function deleteActivity(id) {
    const a = aById(id);
    if (!a) return;

    // Pro: modal si existe, fallback confirm()
    const doDelete = () => {
      db.activities = db.activities.filter((x) => x.id !== id);

      // remove from daily logs
      for (const iso of Object.keys(db.logs)) {
        if (db.logs[iso]?.checksDaily?.[id]) delete db.logs[iso].checksDaily[id];
      }

      // remove from weekly cycle done
      if (db.cycle?.done?.[id]) delete db.cycle.done[id];

      saveDB(db);
      categoriesCacheKey = ""; // force rebuild
      renderManage();
      renderToday();
      toast("Actividad borrada 🗑️", "warn");
      modalClose();
    };

    if (els.modalOverlay) {
      modalOpen({
        title: "Borrar actividad",
        desc: "Esto borra también su historial (checks).",
        contentHTML: `<div class="hint">¿Borrar <b>${escapeHTML(a.name)}</b>?</div>`,
        actions: [
          { label: "Cancelar", kind: "ghost", onClick: modalClose },
          { label: "Borrar", kind: "danger", onClick: doDelete },
        ],
      });
    } else {
      const ok = confirm(`¿Borrar "${a.name}"?\nEsto borra su historial asociado en los checks.`);
      if (ok) doDelete();
    }
  }

  function renderManage() {
    rebuildCategoryFilterIfNeeded();

    const list = getFilteredActivities({ forManage: true });

    if (els.manageList) {
      els.manageList.innerHTML = list
        .slice()
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
        .map((a) => {
          const t = a.type === "daily" ? "Diaria" : "Rotación semanal";
          const sub = a.subcategory ? ` · ${a.subcategory}` : "";
          const energy = a.energy ? ` · ${a.energy}` : "";
          const dur = Number.isFinite(a.duration) ? ` · ${a.duration} min` : "";

          return `
            <div class="manageItem">
              <div>
                <div class="manageName">${escapeHTML(a.name)}</div>
                <div class="manageMeta">${escapeHTML(a.category)}${escapeHTML(sub)} · ${escapeHTML(t)}${escapeHTML(energy)}${escapeHTML(dur)}</div>
              </div>
              <div class="smallBtns">
                <button class="small" data-edit="${escapeHTML(a.id)}" type="button">Editar</button>
                <button class="small danger" data-del="${escapeHTML(a.id)}" type="button">Borrar</button>
              </div>
            </div>
          `;
        })
        .join("");

      $$("[data-edit]").forEach((btn) => on(btn, "click", () => openEdit(btn.dataset.edit)));
      $$("[data-del]").forEach((btn) => on(btn, "click", () => deleteActivity(btn.dataset.del)));
    }
  }

  // ---------------- Export / Import ----------------
  function exportJSON() {
    const payload = {
      meta: { exportedAt: new Date().toISOString(), version: DB_SCHEMA },
      db,
      state,
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

    toast("Backup exportado ✅", "ok");
  }

  function importJSON(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const obj = JSON.parse(fr.result);

        if (!obj?.db?.activities || !obj?.db?.logs) {
          toast("Ese JSON no parece un backup de Ritual.", "warn");
          return;
        }

        db = migrateDB(obj.db);
        saveDB(db);

        if (obj.state && typeof obj.state === "object") {
          state = {
            ...state,
            ...obj.state,
            dateISO: obj.state.dateISO || state.dateISO || todayISO(),
            weekStartISO:
              obj.state.weekStartISO ||
              startOfWeekISO(obj.state.dateISO || state.dateISO || todayISO()),
            view: obj.state.view || state.view || "today",
          };
          saveState(state);
        }

        categoriesCacheKey = "";
        // render current view only (more pro)
        setView(state.view || "today");

        toast("Importado. Tus datos sobrevivieron a la realidad ✅", "ok");
      } catch (e) {
        toast("JSON inválido.", "warn");
      }
    };
    fr.readAsText(file);
  }

  function exportCSV() {
    // exports: activities + done statuses for last 30 days
    const daysBack = 30;
    const end = todayISO();
    const start = addDays(end, -daysBack + 1);
    const days = Array.from({ length: daysBack }, (_, i) => addDays(start, i));

    const header = ["id", "name", "category", "subcategory", "type", "energy", "duration"].concat(days);
    const rows = db.activities.map((a) => {
      const base = [
        a.id,
        a.name,
        a.category,
        a.subcategory || "",
        a.type,
        a.energy || "",
        Number.isFinite(a.duration) ? a.duration : "",
      ];

      const marks = days.map((iso) => {
        // only daily is day-specific; complement is week cycle, so mark by that week's done status
        return isDoneFor(iso, a) ? 1 : 0;
      });

      return base.concat(marks);
    });

    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `ritual_export_${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    toast("CSV exportado 📄", "ok");
  }

  function wipeAll() {
    const doWipe = () => {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_STATE);
      db = seedDB();
      state = loadState(); // default
      saveDB(db);
      saveState(state);
      categoriesCacheKey = "";
      setView("today");
      toast("Datos locales borrados. Renaciste 🔥", "warn");
      modalClose();
    };

    if (els.modalOverlay) {
      modalOpen({
        title: "Borrar datos locales",
        desc: "Esto elimina TODO lo guardado en este dispositivo.",
        contentHTML: `<div class="hint">¿Seguro? Esto no tiene Ctrl+Z.</div>`,
        actions: [
          { label: "Cancelar", kind: "ghost", onClick: modalClose },
          { label: "Borrar todo", kind: "danger", onClick: doWipe },
        ],
      });
    } else {
      const ok = confirm("¿Borrar TODOS los datos locales? Esto no se puede deshacer.");
      if (ok) doWipe();
    }
  }

  // ---------------- Dashboard + Stats ----------------
  function computeMetrics({ rangeDays = 30 } = {}) {
    const end = todayISO();
    const start = addDays(end, -(rangeDays - 1));
    const days = Array.from({ length: rangeDays }, (_, i) => addDays(start, i));

    const daily = db.activities.filter((a) => a.type === "daily");
    const complement = db.activities.filter((a) => a.type === "complement");

    // done counts per day (daily only)
    const byDay = days.map((iso) => {
      ensureDay(iso);
      let done = 0;
      for (const a of daily) if (isDoneFor(iso, a)) done++;
      return { iso, done, total: daily.length, pct: daily.length ? done / daily.length : 0 };
    });

    // by category (daily only)
    const cats = [...new Set(daily.map((a) => a.category))].filter(Boolean);
    const byCat = cats
      .map((cat) => {
        const acts = daily.filter((a) => a.category === cat);
        let done = 0;
        let total = acts.length * rangeDays;
        for (const iso of days) for (const a of acts) if (isDoneFor(iso, a)) done++;
        return { cat, done, total, pct: total ? done / total : 0 };
      })
      .sort((a, b) => b.pct - a.pct);

    // energy distribution (all types, based on activities with energy set)
    const energy = { low: 0, mid: 0, high: 0, none: 0 };
    for (const a of db.activities) {
      if (a.energy === "low") energy.low++;
      else if (a.energy === "mid") energy.mid++;
      else if (a.energy === "high") energy.high++;
      else energy.none++;
    }

    // avoided: lowest done rate (daily)
    const avoided = daily
      .map((a) => {
        let done = 0;
        for (const iso of days) if (isDoneFor(iso, a)) done++;
        return { id: a.id, name: a.name, cat: a.category, done, total: rangeDays, pct: rangeDays ? done / rangeDays : 0 };
      })
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 8);

    // consistency: days with >= 60% completion (daily)
    const consistentDays = byDay.filter((d) => d.pct >= 0.6).length;

    return { rangeDays, days, dailyCount: daily.length, complementCount: complement.length, byDay, byCat, energy, avoided, consistentDays };
  }

  function renderDashboard() {
    // lightweight summary of last 7 days
    const m = computeMetrics({ rangeDays: 7 });

    if (els.dashKpis) {
      const avg = m.byDay.length ? Math.round((m.byDay.reduce((s, x) => s + x.pct, 0) / m.byDay.length) * 100) : 0;
      els.dashKpis.innerHTML = `
        <div class="kpi">
          <div class="kpiLabel">Promedio semanal</div>
          <div class="kpiValue">${avg}%</div>
          <div class="kpiHelp">diarias (7 días)</div>
        </div>
        <div class="kpi">
          <div class="kpiLabel">Días consistentes</div>
          <div class="kpiValue">${m.consistentDays}/${m.rangeDays}</div>
          <div class="kpiHelp">≥ 60%</div>
        </div>
        <div class="kpi">
          <div class="kpiLabel">Actividades</div>
          <div class="kpiValue">${m.dailyCount}+${m.complementCount}</div>
          <div class="kpiHelp">diarias + rotación</div>
        </div>
      `;
    }

    if (els.dashTopCategories) {
      els.dashTopCategories.innerHTML = (m.byCat.slice(0, 6).length ? m.byCat.slice(0, 6) : []).map((c) => {
        const pct = Math.round(c.pct * 100);
        return `
          <div class="row">
            <div>${escapeHTML(c.cat)}</div>
            <div><b>${pct}%</b> <span class="muted">(${c.done}/${c.total})</span></div>
          </div>
        `;
      }).join("") || `<div class="hint tiny">Sin datos aún. Empieza por sobrevivir la semana 😌</div>`;
    }

    drawBars(els.chartBalance, m.byDay.map(x => Math.round(x.pct * 100)));
    if (els.chartBalanceHint) els.chartBalanceHint.textContent = `Promedio: ${Math.round((m.byDay.reduce((s,x)=>s+x.pct,0)/Math.max(1,m.byDay.length))*100)}%`;

    // energy distribution chart: counts
    const e = m.energy;
    const values = [e.low, e.mid, e.high, e.none];
    drawBars(els.chartEnergy, values);
    if (els.chartEnergyHint) els.chartEnergyHint.textContent = `Actividades con energía marcada: ${e.low + e.mid + e.high} · sin marcar: ${e.none}`;
  }

  function renderStats() {
    const range = Number(els.statsRange?.value || 30);
    const r = Number.isFinite(range) ? clamp(range, 7, 365) : 30;

    const m = computeMetrics({ rangeDays: r });

    // consistency
    if (els.statsConsistency) {
      const avg = m.byDay.length ? Math.round((m.byDay.reduce((s, x) => s + x.pct, 0) / m.byDay.length) * 100) : 0;
      els.statsConsistency.innerHTML = `
        <div class="row">
          <div>Promedio</div>
          <div><b>${avg}%</b> <span class="muted">(diarias)</span></div>
        </div>
        <div class="row">
          <div>Días ≥ 60%</div>
          <div><b>${m.consistentDays}/${m.rangeDays}</b></div>
        </div>
      `;
    }

    // chartDone: done ratio per day
    drawBars(els.chartDone, m.byDay.map((x) => Math.round(x.pct * 100)));

    // by category
    if (els.statsByCategory) {
      els.statsByCategory.innerHTML = (m.byCat.length ? m.byCat : [])
        .map((c) => {
          const pct = Math.round(c.pct * 100);
          return `
            <div class="row">
              <div>${escapeHTML(c.cat)}</div>
              <div><b>${pct}%</b> <span class="muted">(${c.done}/${c.total})</span></div>
            </div>
          `;
        })
        .join("") || `<div class="hint tiny">No hay categorías aún.</div>`;
    }

    // avoided
    if (els.statsAvoided) {
      els.statsAvoided.innerHTML = m.avoided
        .map((a) => {
          const pct = Math.round(a.pct * 100);
          return `
            <div class="row">
              <div>${escapeHTML(a.name)} <span class="muted">(${escapeHTML(a.cat)})</span></div>
              <div><b>${pct}%</b> <span class="muted">(${a.done}/${a.total})</span></div>
            </div>
          `;
        })
        .join("") || `<div class="hint tiny">Sin datos para “evitadas”.</div>`;
    }
  }

  function renderSettings() {
    // optional: could show storage info if you want
    // Keep it simple for now.
  }

  // ---------------- Simple canvas charts ----------------
  function drawBars(canvas, values = []) {
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // clear
    ctx.clearRect(0, 0, w, h);

    const pad = 20;
    const maxV = Math.max(1, ...values);
    const n = Math.max(1, values.length);
    const gap = 10;
    const barW = Math.max(6, (w - pad * 2 - gap * (n - 1)) / n);

    // background grid
    ctx.globalAlpha = 0.12;
    for (let i = 0; i <= 4; i++) {
      const y = pad + ((h - pad * 2) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(w - pad, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // bars
    values.forEach((v, i) => {
      const x = pad + i * (barW + gap);
      const bh = ((h - pad * 2) * (v / maxV)) || 0;
      const y = h - pad - bh;

      ctx.fillRect(x, y, barW, bh);
    });
  }

  // ---------------- Bind events ----------------
  function bindTabsKeyboard() {
    const tabs = [els.btnToday, els.btnWeek, els.btnManage, els.btnDashboard, els.btnStats, els.btnSettings].filter(Boolean);
    if (!tabs.length) return;

    tabs.forEach((t, idx) => {
      on(t, "keydown", (e) => {
        if (t.getAttribute("role") !== "tab") return;

        const key = e.key;
        if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") return;
        e.preventDefault();

        let next = idx;
        if (key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
        if (key === "ArrowRight") next = (idx + 1) % tabs.length;
        if (key === "Home") next = 0;
        if (key === "End") next = tabs.length - 1;

        tabs[next].focus();
      });
    });
  }

  function bind() {
    // Tabs
    on(els.btnToday, "click", () => setView("today"));
    on(els.btnWeek, "click", () => {
      state.weekStartISO = startOfWeekISO(state.dateISO);
      saveState(state);
      setView("week");
    });
    on(els.btnManage, "click", () => setView("manage"));
    on(els.btnDashboard, "click", () => setView("dashboard"));
    on(els.btnStats, "click", () => setView("stats"));
    on(els.btnSettings, "click", () => setView("settings"));

    bindTabsKeyboard();

    // Day nav
    on(els.prevDay, "click", () => {
      state.dateISO = addDays(state.dateISO, -1);
      saveState(state);
      renderToday();
    });
    on(els.nextDay, "click", () => {
      state.dateISO = addDays(state.dateISO, +1);
      saveState(state);
      renderToday();
    });

    // Week nav
    on(els.prevWeek, "click", () => {
      state.weekStartISO = addDays(state.weekStartISO, -7);
      saveState(state);
      renderWeek();
    });
    on(els.nextWeek, "click", () => {
      state.weekStartISO = addDays(state.weekStartISO, +7);
      saveState(state);
      renderWeek();
    });

    // Filters (Today)
    on(els.search, "input", renderToday);
    on(els.categoryFilter, "change", renderToday);
    on(els.modeFilter, "change", renderToday);
    on(els.energyFilter, "change", renderToday);

    // Chips
    on(els.chipPending, "click", () => {
      state.pendingFirst = !getChipPressed(els.chipPending);
      saveState(state);
      renderToday();
    });

    on(els.chipShowDone, "click", () => {
      state.showDone = !getChipPressed(els.chipShowDone);
      saveState(state);
      renderToday();
    });

    // Collapse done bucket
    on(els.btnCollapseDone, "click", () => {
      state.collapseDone = !state.collapseDone;
      saveState(state);
      renderToday();
    });

    // Reset filters
    on(els.btnResetFilters, "click", () => {
      if (els.search) els.search.value = "";
      if (els.categoryFilter) els.categoryFilter.value = "__all__";
      if (els.modeFilter) els.modeFilter.value = "all";
      if (els.energyFilter) els.energyFilter.value = "__all__";

      state.pendingFirst = true;
      state.showDone = true;
      state.collapseDone = false;
      saveState(state);

      renderToday();
      toast("Filtros reseteados 🧼", "ok");
    });

    // Bulk
    on(els.btnCheckAll, "click", () => bulkToggle("check"));
    on(els.btnUncheckAll, "click", () => bulkToggle("uncheck"));

    // Manage
    on(els.btnAdd, "click", openAdd);
    on(els.btnCancelEdit, "click", closeForm);
    on(els.btnSaveActivity, "click", saveActivityFromForm);
    on(els.manageSearch, "input", renderManage);
    on(els.manageFilterType, "change", renderManage);

    // Export/Import
    on(els.btnExport, "click", exportJSON);
    on(els.btnExport2, "click", exportJSON);

    on(els.btnExportCSV, "click", exportCSV);
    on(els.btnExportCSV2, "click", exportCSV);

    on(els.importFile, "change", (e) => {
      const f = e.target.files?.[0];
      if (f) importJSON(f);
      e.target.value = "";
    });
    on(els.importFile2, "change", (e) => {
      const f = e.target.files?.[0];
      if (f) importJSON(f);
      e.target.value = "";
    });

    on(els.btnWipeAll, "click", wipeAll);

    // Dashboard refresh
    on(els.btnRefreshDashboard, "click", () => {
      renderDashboard();
      toast("Dashboard actualizado 📊", "ok");
    });

    // Stats range change
    on(els.statsRange, "change", renderStats);
  }

  // ---------------- Boot ----------------
  function boot() {
    ensureCycleFor(state.dateISO || todayISO());
    rebuildCategoryFilterIfNeeded();

    bind();
    setView(state.view || "today");

    // First-time gentle hint if energy filter exists
    if (els.energyFilter && (els.energyFilter.value || "__all__") === "__all__") {
      // no toast spam; only if user is new-ish
    }
  }

  boot();
})();
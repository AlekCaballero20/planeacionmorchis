/* app.js
   Bitácora - Alek & Cata (v4)
   ------------------------------------------------------------
   ✅ Diarias: check por día
   ✅ Complementarias: rotación semanal
   ✅ Hoy: pendientes + hechas + filtros + chips
   ✅ Semana: % por día y por categoría
   ✅ Histórico: resumen, tendencia, heatmap, timeline, destacados
   ✅ Estadísticas: consistencia, top/olvidadas, narrativa, categorías
   ✅ Manage: agregar/editar/borrar + búsqueda + filtro tipo
   ✅ Backup: export/import JSON (incluye state)
   ✅ Export CSV útil
   ✅ Energía + duración opcional
   ✅ Toast + modal
   ✅ Tabs accesibles
   ❌ Sin PWA
*/

(() => {
  "use strict";

  /* =========================================================
     Storage / constants
  ========================================================= */
  const LS_KEY = "bitacora_v4_db";
  const LS_STATE = "bitacora_v4_state";
  const DB_SCHEMA = 4;

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const monthNamesShort = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  /* =========================================================
     DOM helpers
  ========================================================= */
  const $ = (sel, scope = document) => scope?.querySelector?.(sel) || null;
  const $$ = (sel, scope = document) => Array.from(scope?.querySelectorAll?.(sel) || []);

  function on(el, evt, fn, opts) {
    if (!el) return;
    el.addEventListener(evt, fn, opts);
  }

  function off(el, evt, fn, opts) {
    if (!el) return;
    el.removeEventListener(evt, fn, opts);
  }

  /* =========================================================
     Elements
  ========================================================= */
  const els = {
    // Global / layout
    toastRegion: $("#toastRegion"),
    modalOverlay: $("#modalOverlay"),
    modalClose: $("#modalClose"),
    modalTitle: $("#modalTitle"),
    modalDesc: $("#modalDesc"),
    modalContent: $("#modalContent"),
    modalActions: $("#modalActions"),
    appInfo: $("#appInfo"),

    // Top / today sidebar
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
    chipPending: $("#chipPending"),
    chipShowDone: $("#chipShowDone"),
    btnResetFilters: $("#btnResetFilters"),
    btnCollapseDone: $("#btnCollapseDone"),

    // Notes
    dayNotes: $("#dayNotes"),
    noteSaved: $("#noteSaved"),

    // Tabs
    btnToday: $("#btnToday"),
    btnWeek: $("#btnWeek"),
    btnHistory: $("#btnHistory"),
    btnStats: $("#btnStats"),
    btnManage: $("#btnManage"),
    btnSettings: $("#btnSettings"),

    // Views
    viewToday: $("#viewToday"),
    viewWeek: $("#viewWeek"),
    viewHistory: $("#viewHistory"),
    viewStats: $("#viewStats"),
    viewManage: $("#viewManage"),
    viewSettings: $("#viewSettings"),

    // Day nav
    prevDay: $("#prevDay"),
    nextDay: $("#nextDay"),

    // Today
    todaySub: $("#todaySub"),
    pendingList: $("#pendingList"),
    doneList: $("#doneList"),
    pendingCount: $("#pendingCount"),
    doneCount: $("#doneCount"),
    doneBucket: $("#doneBucket"),
    btnCheckAll: $("#btnCheckAll"),
    btnUncheckAll: $("#btnUncheckAll"),

    // Week
    prevWeek: $("#prevWeek"),
    nextWeek: $("#nextWeek"),
    weekGrid: $("#weekGrid"),
    weekByDay: $("#weekByDay"),
    weekByCategory: $("#weekByCategory"),
    weekSub: $("#weekSub"),
    weekInsight: $("#weekInsight"),

    // History
    historyRange: $("#historyRange"),
    historySummary: $("#historySummary"),
    chartHistoryTrend: $("#chartHistoryTrend"),
    historyTrendHint: $("#historyTrendHint"),
    historyCalendar: $("#historyCalendar"),
    historyHighlights: $("#historyHighlights"),
    historyTimeline: $("#historyTimeline"),
    historyTopActivities: $("#historyTopActivities"),

    // Stats
    statsRange: $("#statsRange"),
    statsConsistency: $("#statsConsistency"),
    chartDone: $("#chartDone"),
    statsByCategory: $("#statsByCategory"),
    chartBalance: $("#chartBalance"),
    chartBalanceHint: $("#chartBalanceHint"),
    chartEnergy: $("#chartEnergy"),
    chartEnergyHint: $("#chartEnergyHint"),
    statsAvoided: $("#statsAvoided"),
    statsTopActivities: $("#statsTopActivities"),
    statsNarrative: $("#statsNarrative"),

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

    // Import/export/settings
    btnExport: $("#btnExport"),
    importFile: $("#importFile"),
    btnExportCSV: $("#btnExportCSV"),
    btnExport2: $("#btnExport2"),
    importFile2: $("#importFile2"),
    btnExportCSV2: $("#btnExportCSV2"),
    btnWipeAll: $("#btnWipeAll"),
  };

  /* =========================================================
     Generic utils
  ========================================================= */
  function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function safeNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function todayISO(d = new Date()) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
  }

  function isoToDate(iso) {
    return new Date(`${iso}T00:00:00`);
  }

  function addDays(iso, delta) {
    const d = isoToDate(iso);
    d.setDate(d.getDate() + delta);
    return todayISO(d);
  }

  function startOfWeekISO(iso) {
    const d = isoToDate(iso);
    const dow = d.getDay();
    d.setDate(d.getDate() - dow);
    return todayISO(d);
  }

  function diffDays(aISO, bISO) {
    const a = isoToDate(aISO).getTime();
    const b = isoToDate(bISO).getTime();
    return Math.round((b - a) / 86400000);
  }

  function fmtDateLong(iso) {
    return isoToDate(iso).toLocaleDateString("es-CO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function fmtDateShort(iso) {
    const d = isoToDate(iso);
    return `${d.getDate()} ${monthNamesShort[d.getMonth()]}`;
  }

  function fmtMonthLabel(iso) {
    const d = isoToDate(iso);
    return `${monthNamesShort[d.getMonth()]} ${d.getFullYear()}`;
  }

  function escapeHTML(s) {
    return String(s ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[ch]));
  }

  function csvEscape(v) {
    const s = String(v ?? "");
    return /[,"\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function fmtPct01(v) {
    return `${Math.round((v || 0) * 100)}%`;
  }

  function fmtDurationMin(mins) {
    const n = safeNumber(mins, 0);
    if (!n) return "0 min";
    if (n < 60) return `${n} min`;
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  function energyLabel(v) {
    if (v === "low") return "Energía baja";
    if (v === "mid") return "Energía media";
    if (v === "high") return "Energía alta";
    return "Sin energía";
  }

  function unique(arr) {
    return [...new Set(arr)];
  }

  function sum(arr) {
    return arr.reduce((acc, x) => acc + x, 0);
  }

  function avg(arr) {
    return arr.length ? sum(arr) / arr.length : 0;
  }

  function sortByLocale(a, b) {
    return String(a).localeCompare(String(b), "es");
  }

  /* =========================================================
     Toast
  ========================================================= */
  let toastTimer = null;

  function toast(msg, type = "info") {
    if (!els.toastRegion) return;

    clearTimeout(toastTimer);

    const cls =
      type === "ok" ? "toastOk" :
      type === "warn" ? "toastWarn" :
      type === "err" ? "toastErr" :
      "";

    els.toastRegion.innerHTML = `
      <div class="toast ${cls}" role="status">
        <div>
          <div class="toastTitle">${escapeHTML(
            type === "ok" ? "Listo" :
            type === "warn" ? "Ojo" :
            type === "err" ? "Ups" : "Aviso"
          )}</div>
          <div class="toastMsg">${escapeHTML(msg)}</div>
        </div>
      </div>
    `;

    toastTimer = setTimeout(() => {
      if (els.toastRegion) els.toastRegion.innerHTML = "";
    }, 2600);
  }

  /* =========================================================
     Modal
  ========================================================= */
  function modalOpen({ title = "Modal", desc = "", contentHTML = "", actions = [] } = {}) {
    if (!els.modalOverlay) return;

    if (els.modalTitle) els.modalTitle.textContent = title;
    if (els.modalDesc) els.modalDesc.textContent = desc;
    if (els.modalContent) els.modalContent.innerHTML = contentHTML;

    if (els.modalActions) {
      els.modalActions.innerHTML = actions.map((a, i) => {
        const cls = a.kind === "danger" ? "btn danger" : a.kind === "ghost" ? "btn ghost" : "btn";
        return `<button class="${cls}" data-modal-action="${i}" type="button">${escapeHTML(a.label || "OK")}</button>`;
      }).join("");

      $$("[data-modal-action]", els.modalActions).forEach((btn) => {
        on(btn, "click", () => {
          const idx = Number(btn.dataset.modalAction);
          const fn = actions?.[idx]?.onClick;
          if (typeof fn === "function") fn();
        });
      });
    }

    els.modalOverlay.classList.remove("hidden");
    els.modalOverlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function modalClose() {
    if (!els.modalOverlay) return;
    els.modalOverlay.classList.add("hidden");
    els.modalOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  on(els.modalClose, "click", modalClose);
  on(els.modalOverlay, "click", (e) => {
    if (e.target === els.modalOverlay) modalClose();
  });
  on(document, "keydown", (e) => {
    if (e.key === "Escape" && els.modalOverlay && !els.modalOverlay.classList.contains("hidden")) {
      modalClose();
    }
  });

  /* =========================================================
     Data model
  =========================================================
     db = {
       schemaVersion: 4,
       activities: [{id,name,category,subcategory,type,energy?,duration?}],
       logs: {
         [iso]: {
           checksDaily:{ [id]:true },
           notes:""
         }
       },
       cycle:{
         weekStartISO:"YYYY-MM-DD",
         done:{ [id]:true }
       }
     }
  ========================================================= */

  function getSeedArray() {
    return window.BITACORA_SEED || window.RITUAL_SEED || [];
  }

  function normalizeActivity(a) {
    const energy = ["low", "mid", "high"].includes(a?.energy) ? a.energy : undefined;

    let duration = undefined;
    if (a?.duration !== undefined && a?.duration !== null && a?.duration !== "") {
      const n = Number(a.duration);
      duration = Number.isFinite(n) ? clamp(Math.round(n), 0, 960) : undefined;
    }

    return {
      id: a?.id || uid(),
      name: String(a?.name || "").trim() || "Sin nombre",
      category: String(a?.category || "").trim() || "General",
      subcategory: String(a?.subcategory || "").trim(),
      type: a?.type === "daily" ? "daily" : "complement",
      energy,
      duration,
    };
  }

  function seedDB() {
    const activities = getSeedArray().map(normalizeActivity);
    return {
      schemaVersion: DB_SCHEMA,
      activities,
      logs: {},
      cycle: {
        weekStartISO: startOfWeekISO(todayISO()),
        done: {},
      },
    };
  }

  function migrateDB(db) {
    if (!db || typeof db !== "object") return seedDB();

    if (!Array.isArray(db.activities)) db.activities = [];
    if (!db.logs || typeof db.logs !== "object") db.logs = {};
    if (!db.cycle || typeof db.cycle !== "object") db.cycle = { weekStartISO: startOfWeekISO(todayISO()), done: {} };
    if (!db.cycle.weekStartISO) db.cycle.weekStartISO = startOfWeekISO(todayISO());
    if (!db.cycle.done || typeof db.cycle.done !== "object") db.cycle.done = {};

    Object.keys(db.logs).forEach((iso) => {
      const day = db.logs[iso];
      if (!day || typeof day !== "object") {
        db.logs[iso] = { checksDaily: {}, notes: "" };
        return;
      }
      if (day.checks && !day.checksDaily) {
        day.checksDaily = day.checks;
        delete day.checks;
      }
      if (!day.checksDaily || typeof day.checksDaily !== "object") day.checksDaily = {};
      if (typeof day.notes !== "string") day.notes = String(day.notes || "");
    });

    db.activities = db.activities.filter(Boolean).map(normalizeActivity);
    db.schemaVersion = DB_SCHEMA;
    return db;
  }

  function saveDB() {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  }

  function loadDB() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      const fresh = seedDB();
      localStorage.setItem(LS_KEY, JSON.stringify(fresh));
      return fresh;
    }
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateDB(parsed);
      localStorage.setItem(LS_KEY, JSON.stringify(migrated));
      return migrated;
    } catch {
      const fresh = seedDB();
      localStorage.setItem(LS_KEY, JSON.stringify(fresh));
      return fresh;
    }
  }

  function loadState() {
    const fallback = {
      view: "today",
      dateISO: todayISO(),
      weekStartISO: startOfWeekISO(todayISO()),
      editId: null,
      showDone: true,
      collapseDone: false,
      pendingFirst: true,
    };

    const raw = localStorage.getItem(LS_STATE);
    if (!raw) return fallback;

    try {
      const s = JSON.parse(raw);
      return {
        view: s.view || fallback.view,
        dateISO: s.dateISO || fallback.dateISO,
        weekStartISO: s.weekStartISO || startOfWeekISO(s.dateISO || fallback.dateISO),
        editId: s.editId || null,
        showDone: s.showDone !== false,
        collapseDone: s.collapseDone === true,
        pendingFirst: s.pendingFirst !== false,
      };
    } catch {
      return fallback;
    }
  }

  function saveState() {
    localStorage.setItem(LS_STATE, JSON.stringify(state));
  }

  let db = loadDB();
  let state = loadState();

  /* =========================================================
     Helpers on data
  ========================================================= */
  function ensureDay(iso) {
    if (!db.logs[iso]) db.logs[iso] = { checksDaily: {}, notes: "" };
    if (!db.logs[iso].checksDaily || typeof db.logs[iso].checksDaily !== "object") {
      db.logs[iso].checksDaily = {};
    }
    if (typeof db.logs[iso].notes !== "string") db.logs[iso].notes = String(db.logs[iso].notes || "");
  }

  function ensureCycleFor(refISO) {
    const week = startOfWeekISO(refISO || todayISO());
    if (!db.cycle) db.cycle = { weekStartISO: week, done: {} };
    if (!db.cycle.done || typeof db.cycle.done !== "object") db.cycle.done = {};
    if (!db.cycle.weekStartISO) db.cycle.weekStartISO = week;

    if (db.cycle.weekStartISO !== week) {
      db.cycle.weekStartISO = week;
      db.cycle.done = {};
      saveDB();
    }
  }

  function aById(id) {
    return db.activities.find((x) => x.id === id);
  }

  function allCategories() {
    return unique(db.activities.map((a) => a.category).filter(Boolean)).sort(sortByLocale);
  }

  function getChipPressed(el) {
    return !!el && el.getAttribute("aria-pressed") === "true";
  }

  function setChipPressed(el, pressed) {
    if (!el) return;
    el.setAttribute("aria-pressed", String(pressed));
    el.classList.toggle("chipOff", !pressed);
  }

  function isDoneFor(iso, activity) {
    ensureDay(iso);
    ensureCycleFor(iso);
    if (activity.type === "daily") return !!db.logs[iso].checksDaily[activity.id];
    return !!db.cycle.done[activity.id];
  }

  function setDoneFor(iso, activity, done) {
    ensureDay(iso);
    ensureCycleFor(iso);

    if (activity.type === "daily") {
      if (done) db.logs[iso].checksDaily[activity.id] = true;
      else delete db.logs[iso].checksDaily[activity.id];
    } else {
      if (done) db.cycle.done[activity.id] = true;
      else delete db.cycle.done[activity.id];
    }

    saveDB();
  }

  function getFilteredActivities({ forManage = false } = {}) {
    const q = ((forManage ? els.manageSearch?.value : els.search?.value) || "").trim().toLowerCase();
    const cat = els.categoryFilter?.value || "__all__";
    const mode = (forManage ? els.manageFilterType?.value : els.modeFilter?.value) || (forManage ? "__all__" : "all");
    const energy = els.energyFilter?.value || "__all__";

    return db.activities
      .filter((a) => {
        const hay = `${a.name} ${a.category} ${a.subcategory || ""}`.toLowerCase();

        if (q && !hay.includes(q)) return false;

        if (!forManage) {
          if (cat !== "__all__" && a.category !== cat) return false;
          if (mode === "daily" && a.type !== "daily") return false;
          if (mode === "complement" && a.type !== "complement") return false;
          if (energy !== "__all__" && (a.energy || "__none__") !== energy) return false;
        } else {
          if (mode !== "__all__" && a.type !== mode) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "daily" ? -1 : 1;
        if (a.category !== b.category) return a.category.localeCompare(b.category, "es");
        return a.name.localeCompare(b.name, "es");
      });
  }

  function rebuildCategoryFilter() {
    if (!els.categoryFilter) return;
    const cats = allCategories();
    const current = els.categoryFilter.value || "__all__";

    els.categoryFilter.innerHTML =
      `<option value="__all__">Todas las categorías</option>` +
      cats.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");

    els.categoryFilter.value = cats.includes(current) ? current : "__all__";
  }

  function getAllLogDatesSortedDesc() {
    return Object.keys(db.logs).sort((a, b) => b.localeCompare(a));
  }

  function getDateRangeArray(endISO, rangeDays) {
    const startISO = addDays(endISO, -(rangeDays - 1));
    return Array.from({ length: rangeDays }, (_, i) => addDays(startISO, i));
  }

  function getDayMetrics(iso) {
    ensureDay(iso);

    const dailyActs = db.activities.filter((a) => a.type === "daily");
    const allActs = db.activities;

    let doneDaily = 0;
    let doneAll = 0;
    let visibleCount = 0;
    let totalDurationDone = 0;

    for (const a of dailyActs) {
      if (isDoneFor(iso, a)) doneDaily++;
    }

    for (const a of allActs) {
      visibleCount++;
      if (isDoneFor(iso, a)) {
        doneAll++;
        if (Number.isFinite(a.duration)) totalDurationDone += a.duration;
      }
    }

    const pctDaily = dailyActs.length ? doneDaily / dailyActs.length : 0;
    const pctAll = visibleCount ? doneAll / visibleCount : 0;

    return {
      iso,
      doneDaily,
      totalDaily: dailyActs.length,
      doneAll,
      totalAll: visibleCount,
      pctDaily,
      pctAll,
      totalDurationDone,
      notes: db.logs[iso]?.notes || "",
    };
  }

  function computeBalanceForRange(days) {
    let carga = 0;
    let descanso = 0;

    const doneById = new Map();

    for (const iso of days) {
      for (const a of db.activities) {
        if (!isDoneFor(iso, a)) continue;
        doneById.set(a.id, (doneById.get(a.id) || 0) + 1);
      }
    }

    for (const a of db.activities) {
      const times = doneById.get(a.id) || 0;
      if (!times) continue;

      const hay = `${(a.name || "").toLowerCase()} ${(a.category || "").toLowerCase()} ${(a.subcategory || "").toLowerCase()}`;

      const isRestish =
        hay.includes("descanso") ||
        hay.includes("medit") ||
        hay.includes("pausa") ||
        hay.includes("respir") ||
        hay.includes("caminar") ||
        hay.includes("jugar") ||
        hay.includes("natur") ||
        hay.includes("compartir") ||
        hay.includes("mascota") ||
        hay.includes("serie") ||
        hay.includes("película");

      const isWorkish =
        hay.includes("trabajo") ||
        hay.includes("admin") ||
        hay.includes("program") ||
        hay.includes("pedagog") ||
        hay.includes("música") ||
        hay.includes("dibujo") ||
        hay.includes("arte") ||
        hay.includes("francés") ||
        hay.includes("inglés") ||
        hay.includes("italiano") ||
        hay.includes("finanza") ||
        hay.includes("planea");

      let score = 1;
      if (a.energy === "high") score = 1.6;
      if (a.energy === "mid") score = 1.15;
      if (a.energy === "low") score = 0.8;

      const weighted = score * times;

      if (isRestish && !isWorkish) descanso += weighted;
      else if (isWorkish && !isRestish) carga += weighted;
      else {
        carga += weighted * 0.6;
        descanso += weighted * 0.4;
      }
    }

    const total = carga + descanso;
    const restRatio = total ? descanso / total : 0.5;

    return { carga, descanso, restRatio };
  }

  function computeMetrics({ rangeDays = 30 } = {}) {
    const endISO = todayISO();
    const days = getDateRangeArray(endISO, rangeDays);

    const dailyActs = db.activities.filter((a) => a.type === "daily");
    const cats = unique(db.activities.map((a) => a.category).filter(Boolean)).sort(sortByLocale);

    const byDay = days.map((iso) => {
      const m = getDayMetrics(iso);
      return {
        iso,
        pctDaily: m.pctDaily,
        pctAll: m.pctAll,
        doneDaily: m.doneDaily,
        totalDaily: m.totalDaily,
        doneAll: m.doneAll,
        totalAll: m.totalAll,
        duration: m.totalDurationDone,
        notes: m.notes,
      };
    });

    const byCategory = cats.map((cat) => {
      const acts = db.activities.filter((a) => a.category === cat);
      let done = 0;
      let total = 0;

      for (const iso of days) {
        for (const a of acts) {
          total++;
          if (isDoneFor(iso, a)) done++;
        }
      }

      return {
        cat,
        done,
        total,
        pct: total ? done / total : 0,
      };
    }).sort((a, b) => b.pct - a.pct);

    const topActivities = db.activities.map((a) => {
      let done = 0;
      for (const iso of days) {
        if (isDoneFor(iso, a)) done++;
      }
      return {
        id: a.id,
        name: a.name,
        cat: a.category,
        type: a.type,
        done,
        total: rangeDays,
        pct: rangeDays ? done / rangeDays : 0,
      };
    }).sort((a, b) => b.done - a.done || b.pct - a.pct);

    const avoidedActivities = [...topActivities]
      .filter((a) => a.done < a.total)
      .sort((a, b) => a.pct - b.pct || a.done - b.done);

    const avgDaily = avg(byDay.map((x) => x.pctDaily));
    const avgAll = avg(byDay.map((x) => x.pctAll));
    const bestDay = [...byDay].sort((a, b) => b.pctDaily - a.pctDaily || b.doneDaily - a.doneDaily)[0] || null;
    const worstDay = [...byDay].sort((a, b) => a.pctDaily - b.pctDaily || a.doneDaily - b.doneDaily)[0] || null;

    let streakCurrent = 0;
    let streakBest = 0;
    let working = 0;
    for (const day of byDay) {
      if (day.pctDaily >= 0.6) {
        working++;
        streakBest = Math.max(streakBest, working);
      } else {
        working = 0;
      }
    }

    for (let i = byDay.length - 1; i >= 0; i--) {
      if (byDay[i].pctDaily >= 0.6) streakCurrent++;
      else break;
    }

    const activeDays = byDay.filter((d) => d.doneAll > 0).length;
    const emptyDays = byDay.filter((d) => d.doneAll === 0).length;
    const noteDays = byDay.filter((d) => (d.notes || "").trim()).length;
    const totalDuration = sum(byDay.map((d) => d.duration || 0));

    const energy = { low: 0, mid: 0, high: 0, none: 0 };
    for (const a of db.activities) {
      if (a.energy === "low") energy.low++;
      else if (a.energy === "mid") energy.mid++;
      else if (a.energy === "high") energy.high++;
      else energy.none++;
    }

    const balance = computeBalanceForRange(days);

    return {
      rangeDays,
      days,
      byDay,
      byCategory,
      topActivities,
      avoidedActivities,
      avgDaily,
      avgAll,
      bestDay,
      worstDay,
      streakCurrent,
      streakBest,
      activeDays,
      emptyDays,
      noteDays,
      totalDuration,
      dailyCount: dailyActs.length,
      allCount: db.activities.length,
      energy,
      balance,
    };
  }

  /* =========================================================
     View switching / tabs
  ========================================================= */
  const TAB_MAP = {
    today: { btn: els.btnToday, view: els.viewToday },
    week: { btn: els.btnWeek, view: els.viewWeek },
    history: { btn: els.btnHistory, view: els.viewHistory },
    stats: { btn: els.btnStats, view: els.viewStats },
    manage: { btn: els.btnManage, view: els.viewManage },
    settings: { btn: els.btnSettings, view: els.viewSettings },
  };

  function updateTabsUI(activeView) {
    Object.entries(TAB_MAP).forEach(([key, obj]) => {
      const active = key === activeView;
      obj.view?.classList.toggle("hidden", !active);
      if (obj.btn) {
        obj.btn.classList.toggle("isActive", active);
        if (obj.btn.getAttribute("role") === "tab") {
          obj.btn.setAttribute("aria-selected", String(active));
          obj.btn.tabIndex = active ? 0 : -1;
        }
      }
    });
  }

  function setView(view) {
    state.view = view;
    saveState();
    updateTabsUI(view);

    if (view === "today") renderToday();
    if (view === "week") renderWeek();
    if (view === "history") renderHistory();
    if (view === "stats") renderStats();
    if (view === "manage") renderManage();
    if (view === "settings") renderSettings();
  }

  function bindTabsKeyboard() {
    const tabs = Object.values(TAB_MAP).map((x) => x.btn).filter(Boolean);
    tabs.forEach((tab, idx) => {
      on(tab, "keydown", (e) => {
        if (tab.getAttribute("role") !== "tab") return;
        const key = e.key;
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
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

  /* =========================================================
     Notes autosave
  ========================================================= */
  let notesTimer = null;

  function bindNotesAutosave(iso) {
    if (!els.dayNotes) return;

    els.dayNotes.oninput = () => {
      if (els.noteSaved) els.noteSaved.textContent = "escribiendo...";
      clearTimeout(notesTimer);

      notesTimer = setTimeout(() => {
        ensureDay(iso);
        db.logs[iso].notes = els.dayNotes.value || "";
        saveDB();
        if (els.noteSaved) els.noteSaved.textContent = "guardado";
      }, 420);
    };
  }

  /* =========================================================
     Today
  ========================================================= */
  function renderActivityCards(list, iso) {
    if (!list.length) {
      return `<div class="emptyState">Nada por acá. Milagro administrativo, supongo ✅</div>`;
    }

    return list.map((a) => {
      const checked = isDoneFor(iso, a);
      const typeLabel = a.type === "daily" ? "Diaria" : "Rotación semanal";

      return `
        <div class="item ${checked ? "isDone" : ""}">
          <input class="chk" type="checkbox" data-id="${escapeHTML(a.id)}" ${checked ? "checked" : ""} />
          <div class="itemMain">
            <p class="itemTitle">${escapeHTML(a.name)}</p>
            <div class="itemMeta">
              <span class="tag">${escapeHTML(a.category)}</span>
              ${a.subcategory ? `<span class="tag">${escapeHTML(a.subcategory)}</span>` : ""}
              <span class="tag">${escapeHTML(typeLabel)}</span>
              ${a.energy ? `<span class="tag">${escapeHTML(energyLabel(a.energy))}</span>` : ""}
              ${Number.isFinite(a.duration) ? `<span class="tag">${escapeHTML(fmtDurationMin(a.duration))}</span>` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function bindCheckboxDelegation(container) {
    if (!container || container.__boundBitacoraCheckbox) return;
    container.__boundBitacoraCheckbox = true;

    on(container, "change", (e) => {
      const target = e.target;
      if (!target?.classList?.contains("chk")) return;
      const id = target.dataset.id;
      const a = aById(id);
      if (!a) return;

      setDoneFor(state.dateISO, a, target.checked);
      renderToday();

      if (state.view === "week") renderWeek();
      if (state.view === "history") renderHistory();
      if (state.view === "stats") renderStats();
    });
  }

  function renderKPIs(iso) {
    const visible = getFilteredActivities({ forManage: false });
    const dailyActs = db.activities.filter((a) => a.type === "daily");

    const doneDaily = dailyActs.filter((a) => isDoneFor(iso, a)).length;
    const doneVisible = visible.filter((a) => isDoneFor(iso, a)).length;
    const errAct = db.activities.find((a) => (a.name || "").toLowerCase().includes("tiempo de error"));
    const errVal = errAct ? (isDoneFor(iso, errAct) ? 1 : 0) : 0;

    if (els.kpiDaily) els.kpiDaily.textContent = dailyActs.length ? `${Math.round((doneDaily / dailyActs.length) * 100)}%` : "0%";
    if (els.kpiDailyHelp) els.kpiDailyHelp.textContent = `diarias hoy (${doneDaily}/${dailyActs.length})`;
    if (els.kpiCount) els.kpiCount.textContent = `${doneVisible}/${visible.length}`;
    if (els.kpiError) els.kpiError.textContent = String(errVal);
  }

  function renderBalancePill(iso) {
    if (!els.balancePill) return;

    const doneActs = db.activities.filter((a) => isDoneFor(iso, a));
    let carga = 0;
    let descanso = 0;

    for (const a of doneActs) {
      const hay = `${a.name} ${a.category} ${a.subcategory || ""}`.toLowerCase();

      const isRestish =
        hay.includes("descanso") ||
        hay.includes("medit") ||
        hay.includes("compartir") ||
        hay.includes("mascota") ||
        hay.includes("juego") ||
        hay.includes("película") ||
        hay.includes("serie") ||
        hay.includes("respir") ||
        hay.includes("natur");

      const isWorkish =
        hay.includes("trabajo") ||
        hay.includes("admin") ||
        hay.includes("program") ||
        hay.includes("pedagog") ||
        hay.includes("finan") ||
        hay.includes("planea") ||
        hay.includes("idioma") ||
        hay.includes("arte") ||
        hay.includes("música");

      let score = 1;
      if (a.energy === "high") score = 1.5;
      if (a.energy === "low") score = 0.8;

      if (isRestish && !isWorkish) descanso += score;
      else if (isWorkish && !isRestish) carga += score;
      else {
        carga += score * 0.6;
        descanso += score * 0.4;
      }
    }

    const total = carga + descanso;
    const ratio = total ? descanso / total : 0.5;

    let label = "—";
    if (!doneActs.length) label = "Sin lectura";
    else if (ratio >= 0.58) label = "🟢 Balance suave";
    else if (ratio >= 0.45) label = "🟡 Balance medio";
    else label = "🔴 Mucha carga";

    els.balancePill.textContent = label;
  }

  function renderToday() {
    const iso = state.dateISO;
    ensureDay(iso);
    ensureCycleFor(iso);
    rebuildCategoryFilter();

    setChipPressed(els.chipPending, state.pendingFirst !== false);
    setChipPressed(els.chipShowDone, state.showDone !== false);

    if (els.dateTitle) els.dateTitle.textContent = fmtDateLong(iso);
    if (els.dayNotes) els.dayNotes.value = db.logs[iso]?.notes || "";
    bindNotesAutosave(iso);

    const activities = getFilteredActivities({ forManage: false });
    const pending = activities.filter((a) => !isDoneFor(iso, a));
    const done = activities.filter((a) => isDoneFor(iso, a));

    if (els.todaySub) {
      const mf = els.modeFilter?.value || "all";
      const ef = els.energyFilter?.value || "__all__";
      const modeLabel = mf === "daily" ? "Diarias" : mf === "complement" ? "Rotación" : "Todo";
      const energyTxt = ef === "__all__" ? "" : ` · ${energyLabel(ef)}`;
      els.todaySub.textContent = `${modeLabel}${energyTxt} · ${state.showDone ? "mostrando hechas" : "ocultando hechas"}`;
    }

    if (els.pendingCount) els.pendingCount.textContent = String(pending.length);
    if (els.doneCount) els.doneCount.textContent = String(done.length);

    if (els.doneBucket) {
      const collapse = state.collapseDone === true;
      const hidden = collapse || state.showDone === false;
      els.doneBucket.classList.toggle("hidden", hidden);

      if (els.btnCollapseDone) {
        if (state.showDone === false) els.btnCollapseDone.textContent = "Hechas: OFF";
        else els.btnCollapseDone.textContent = `Hechas: ${collapse ? "OFF" : "ON"}`;
      }
    }

    if (els.pendingList) els.pendingList.innerHTML = renderActivityCards(pending, iso);
    if (els.doneList) els.doneList.innerHTML = state.showDone ? renderActivityCards(done, iso) : "";

    bindCheckboxDelegation(els.pendingList);
    bindCheckboxDelegation(els.doneList);

    renderKPIs(iso);
    renderBalancePill(iso);
  }

  function bulkToggle(mode) {
    const iso = state.dateISO;
    const visibleDaily = getFilteredActivities({ forManage: false }).filter((a) => a.type === "daily");
    visibleDaily.forEach((a) => setDoneFor(iso, a, mode === "check"));
    renderToday();
    toast(mode === "check" ? "Diarias marcadas ✅" : "Diarias desmarcadas 🧼", "ok");
  }

  /* =========================================================
     Week
  ========================================================= */
  function weekInsightText(byDay, byCategory) {
    const avgPct = avg(byDay.map((d) => d.pctDaily));
    const bestCat = byCategory[0];
    const worstCat = byCategory[byCategory.length - 1];

    if (!byDay.length) return "Sin datos todavía.";
    if (avgPct >= 0.75) {
      return `Semana fuerte. Sostuvieron bastante bien el ritmo${bestCat ? `, especialmente en ${bestCat.cat}` : ""}.`;
    }
    if (avgPct >= 0.5) {
      return `Semana decente. Hubo movimiento real, aunque todavía hay margen para cuidar mejor${worstCat ? ` lo relacionado con ${worstCat.cat}` : ""}.`;
    }
    return `Semana flojita. No pasa nada, pero sí conviene revisar qué se está quedando siempre para después${worstCat ? `, sobre todo en ${worstCat.cat}` : ""}.`;
  }

  function renderWeek() {
    const w0 = state.weekStartISO || startOfWeekISO(state.dateISO || todayISO());
    state.weekStartISO = w0;
    saveState();

    const days = Array.from({ length: 7 }, (_, i) => addDays(w0, i));
    const dailyActs = db.activities.filter((a) => a.type === "daily");

    if (els.weekSub) {
      const d0 = isoToDate(w0);
      const d6 = isoToDate(addDays(w0, 6));
      els.weekSub.textContent =
        `Semana ${d0.toLocaleDateString("es-CO", { month: "short", day: "numeric" })} - ` +
        `${d6.toLocaleDateString("es-CO", { month: "short", day: "numeric" })}`;
    }

    const byDay = days.map((iso) => {
      const done = dailyActs.filter((a) => isDoneFor(iso, a)).length;
      const total = dailyActs.length;
      const pct = total ? done / total : 0;
      return { iso, done, total, pct };
    });

    if (els.weekGrid) {
      els.weekGrid.innerHTML = byDay.map((d) => {
        const dateObj = isoToDate(d.iso);
        return `
          <div class="dayCard" data-iso="${escapeHTML(d.iso)}" role="button" tabindex="0" aria-label="Ir al día ${escapeHTML(fmtDateShort(d.iso))}">
            <div class="dayName">${escapeHTML(dayNames[dateObj.getDay()])}</div>
            <div class="dayDate">${escapeHTML(fmtDateShort(d.iso))}</div>
            <div class="progress"><div class="bar" style="width:${Math.round(d.pct * 100)}%"></div></div>
            <div class="dayStats">${Math.round(d.pct * 100)}% · ${d.done}/${d.total}</div>
          </div>
        `;
      }).join("");

      $$(".dayCard", els.weekGrid).forEach((card) => {
        const go = () => {
          state.dateISO = card.dataset.iso;
          saveState();
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

    if (els.weekByDay) {
      els.weekByDay.innerHTML = byDay.map((d) => `
        <div class="row">
          <div>${escapeHTML(fmtDateShort(d.iso))}</div>
          <div><b>${Math.round(d.pct * 100)}%</b> <span class="muted">(${d.done}/${d.total})</span></div>
        </div>
      `).join("");
    }

    const cats = unique(dailyActs.map((a) => a.category).filter(Boolean)).sort(sortByLocale);
    const byCategory = cats.map((cat) => {
      const acts = dailyActs.filter((a) => a.category === cat);
      let done = 0;
      let total = acts.length * 7;

      for (const iso of days) {
        for (const a of acts) {
          if (isDoneFor(iso, a)) done++;
        }
      }

      return { cat, done, total, pct: total ? done / total : 0 };
    }).sort((a, b) => b.pct - a.pct);

    if (els.weekByCategory) {
      els.weekByCategory.innerHTML = byCategory.length
        ? byCategory.map((c) => `
          <div class="row">
            <div>${escapeHTML(c.cat)}</div>
            <div><b>${Math.round(c.pct * 100)}%</b> <span class="muted">(${c.done}/${c.total})</span></div>
          </div>
        `).join("")
        : `<div class="emptyState">No hay categorías diarias para analizar todavía.</div>`;
    }

    if (els.weekInsight) {
      els.weekInsight.textContent = weekInsightText(byDay, byCategory);
    }
  }

  /* =========================================================
     History
  ========================================================= */
  function renderHistorySummary(m) {
    if (!els.historySummary) return;

    const cards = [
      {
        label: "Promedio diario",
        value: fmtPct01(m.avgDaily),
        help: "sobre actividades diarias",
      },
      {
        label: "Días activos",
        value: `${m.activeDays}/${m.rangeDays}`,
        help: "con al menos una actividad hecha",
      },
      {
        label: "Tiempo acumulado",
        value: fmtDurationMin(m.totalDuration),
        help: "según duración marcada",
      },
      {
        label: "Días con nota",
        value: `${m.noteDays}`,
        help: "bitácora escrita",
      },
    ];

    els.historySummary.innerHTML = cards.map((c) => `
      <div class="summaryCard">
        <div class="muted">${escapeHTML(c.label)}</div>
        <div class="dashKpiValue">${escapeHTML(c.value)}</div>
        <div class="tiny">${escapeHTML(c.help)}</div>
      </div>
    `).join("");
  }

  function renderHistoryHighlights(m) {
    if (!els.historyHighlights) return;

    const best = m.bestDay;
    const worst = m.worstDay;
    const balance = m.balance;

    const items = [
      {
        cls: "good",
        title: "Mejor día",
        text: best ? `${fmtDateShort(best.iso)} · ${fmtPct01(best.pctDaily)} (${best.doneDaily}/${best.totalDaily})` : "—",
      },
      {
        cls: "bad",
        title: "Día más flojo",
        text: worst ? `${fmtDateShort(worst.iso)} · ${fmtPct01(worst.pctDaily)} (${worst.doneDaily}/${worst.totalDaily})` : "—",
      },
      {
        cls: "warn",
        title: "Días vacíos",
        text: `${m.emptyDays} de ${m.rangeDays}`,
      },
      {
        cls: "good",
        title: "Balance general",
        text:
          balance.restRatio >= 0.58 ? "Más descanso/cuidado" :
          balance.restRatio >= 0.45 ? "Equilibrio medio" :
          "Más carga que descanso",
      },
    ];

    els.historyHighlights.innerHTML = items.map((x) => `
      <div class="highlightItem ${escapeHTML(x.cls)}">
        <div class="muted">${escapeHTML(x.title)}</div>
        <div><strong>${escapeHTML(x.text)}</strong></div>
      </div>
    `).join("");
  }

  function renderHistoryTimeline(m) {
    if (!els.historyTimeline) return;

    const interesting = [...m.byDay]
      .filter((d) => d.doneAll > 0 || (d.notes || "").trim())
      .sort((a, b) => b.iso.localeCompare(a.iso))
      .slice(0, 18);

    if (!interesting.length) {
      els.historyTimeline.innerHTML = `<div class="emptyState">Todavía no hay suficiente rastro. Apenas empiecen a usar esto, aquí aparecerá la historia.</div>`;
      return;
    }

    els.historyTimeline.innerHTML = interesting.map((d) => `
      <div class="timelineItem">
        <div><strong>${escapeHTML(fmtDateLong(d.iso))}</strong></div>
        <div class="tiny">Cumplimiento diario: ${escapeHTML(fmtPct01(d.pctDaily))} · Hechas: ${d.doneAll}/${d.totalAll}</div>
        ${d.notes ? `<div class="hint tiny" style="margin-top:6px;">${escapeHTML(d.notes).slice(0, 220)}</div>` : ""}
      </div>
    `).join("");
  }

  function renderHistoryTopActivities(m) {
    if (!els.historyTopActivities) return;

    const top = m.topActivities.slice(0, 10);

    if (!top.length) {
      els.historyTopActivities.innerHTML = `<div class="emptyState">Sin actividades todavía.</div>`;
      return;
    }

    els.historyTopActivities.innerHTML = top.map((a) => `
      <div class="topItem">
        <div><strong>${escapeHTML(a.name)}</strong> <span class="muted">(${escapeHTML(a.cat)})</span></div>
        <div class="tiny">Presencia: ${a.done}/${a.total} · ${fmtPct01(a.pct)}</div>
      </div>
    `).join("");
  }

  function renderHistoryCalendar(m) {
    if (!els.historyCalendar) return;

    const days = [...m.byDay];
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    const heatRows = weeks.map((week) => `
      <div class="heatmapRow">
        ${week.map((d) => {
          const pct = d.pctDaily;
          let lv = "";
          if (pct > 0 && pct < 0.25) lv = "lv1";
          else if (pct >= 0.25 && pct < 0.5) lv = "lv2";
          else if (pct >= 0.5 && pct < 0.8) lv = "lv3";
          else if (pct >= 0.8) lv = "lv4";

          return `
            <div class="heatCell ${lv}" title="${escapeHTML(fmtDateLong(d.iso))}: ${Math.round(pct * 100)}%">
              ${escapeHTML(String(isoToDate(d.iso).getDate()))}
            </div>
          `;
        }).join("")}
      </div>
    `).join("");

    els.historyCalendar.innerHTML = `
      <div class="tiny" style="margin-bottom:8px;">
        Más oscuro/intenso = mejor cumplimiento diario.
      </div>
      <div class="heatmap">${heatRows}</div>
    `;
  }

  function renderHistoryTrend(m) {
    drawLineChart(els.chartHistoryTrend, m.byDay.map((d) => Math.round(d.pctDaily * 100)));
    if (els.historyTrendHint) {
      const best = m.bestDay ? `${fmtDateShort(m.bestDay.iso)} (${fmtPct01(m.bestDay.pctDaily)})` : "—";
      els.historyTrendHint.textContent = `Promedio: ${fmtPct01(m.avgDaily)} · Mejor día: ${best}`;
    }
  }

  function renderHistory() {
    const range = clamp(Number(els.historyRange?.value || 30), 14, 365);
    const m = computeMetrics({ rangeDays: range });

    renderHistorySummary(m);
    renderHistoryTrend(m);
    renderHistoryCalendar(m);
    renderHistoryHighlights(m);
    renderHistoryTimeline(m);
    renderHistoryTopActivities(m);
  }

  /* =========================================================
     Stats
  ========================================================= */
  function narrativeFromMetrics(m) {
    const topCat = m.byCategory[0]?.cat;
    const weakCat = m.byCategory[m.byCategory.length - 1]?.cat;

    const p = [];

    if (m.avgDaily >= 0.75) {
      p.push("El periodo se ve fuerte. Hay una constancia bastante real, no solo chispazos de motivación.");
    } else if (m.avgDaily >= 0.5) {
      p.push("El periodo se ve intermedio. Sí hay movimiento, pero todavía no con la estabilidad que haría que esto se sienta sostenido.");
    } else {
      p.push("El periodo se ve flojo. No como juicio, sino como dato: varias cosas importantes se están quedando por fuera.");
    }

    if (m.streakBest >= 5) {
      p.push(`La mejor racha fue de ${m.streakBest} días consistentes, lo cual ya muestra que sí pueden sostener ritmo cuando el sistema acompaña.`);
    } else {
      p.push("No hay rachas largas todavía. Eso suele indicar que la estructura actual todavía no está ayudando tanto como podría.");
    }

    if (topCat) {
      p.push(`La categoría con más presencia fue ${topCat}.`);
    }

    if (weakCat && weakCat !== topCat) {
      p.push(`La categoría más descuidada fue ${weakCat}, así que por ahí hay una alerta útil.`);
    }

    if (m.balance.restRatio < 0.45) {
      p.push("También hay una tendencia a que la carga pese más que el descanso. Bonita costumbre humana esa de exprimir la agenda y luego sorprenderse del cansancio.");
    } else if (m.balance.restRatio > 0.58) {
      p.push("Se ve una presencia interesante de cuidado, descanso o actividades de sostén. Eso no sobra, eso sostiene todo lo demás.");
    }

    return p.join(" ");
  }

  function renderStats() {
    const range = clamp(Number(els.statsRange?.value || 30), 7, 365);
    const m = computeMetrics({ rangeDays: range });

    if (els.statsConsistency) {
      els.statsConsistency.innerHTML = `
        <div class="statCard">
          <div class="muted">Promedio diario</div>
          <div class="dashKpiValue">${escapeHTML(fmtPct01(m.avgDaily))}</div>
          <div class="tiny">sobre actividades diarias</div>
        </div>
        <div class="statCard">
          <div class="muted">Racha actual</div>
          <div class="dashKpiValue">${m.streakCurrent}</div>
          <div class="tiny">días ≥ 60%</div>
        </div>
        <div class="statCard">
          <div class="muted">Mejor racha</div>
          <div class="dashKpiValue">${m.streakBest}</div>
          <div class="tiny">máxima consistencia</div>
        </div>
        <div class="statCard">
          <div class="muted">Días activos</div>
          <div class="dashKpiValue">${m.activeDays}/${m.rangeDays}</div>
          <div class="tiny">con al menos una actividad</div>
        </div>
      `;
    }

    drawBarsChart(els.chartDone, m.byDay.map((d) => Math.round(d.pctDaily * 100)));

    if (els.statsByCategory) {
      els.statsByCategory.innerHTML = m.byCategory.length
        ? m.byCategory.map((c) => `
          <div class="row">
            <div>${escapeHTML(c.cat)}</div>
            <div><b>${Math.round(c.pct * 100)}%</b> <span class="muted">(${c.done}/${c.total})</span></div>
          </div>
        `).join("")
        : `<div class="emptyState">Sin categorías todavía.</div>`;
    }

    drawBarsChart(els.chartBalance, [
      Math.round(m.balance.carga),
      Math.round(m.balance.descanso),
    ], ["Carga", "Descanso"]);
    if (els.chartBalanceHint) {
      els.chartBalanceHint.textContent =
        m.balance.restRatio >= 0.58 ? "Predomina descanso/cuidado" :
        m.balance.restRatio >= 0.45 ? "Balance medio" :
        "Predomina carga";
    }

    drawBarsChart(els.chartEnergy, [
      m.energy.low,
      m.energy.mid,
      m.energy.high,
      m.energy.none,
    ], ["Baja", "Media", "Alta", "Sin"]);
    if (els.chartEnergyHint) {
      els.chartEnergyHint.textContent = `Marcadas: ${m.energy.low + m.energy.mid + m.energy.high} · Sin marcar: ${m.energy.none}`;
    }

    if (els.statsAvoided) {
      const avoided = m.avoidedActivities.slice(0, 8);
      els.statsAvoided.innerHTML = avoided.length
        ? avoided.map((a) => `
          <div class="row">
            <div>${escapeHTML(a.name)} <span class="muted">(${escapeHTML(a.cat)})</span></div>
            <div><b>${Math.round(a.pct * 100)}%</b> <span class="muted">(${a.done}/${a.total})</span></div>
          </div>
        `).join("")
        : `<div class="emptyState">Todavía no hay suficientes datos.</div>`;
    }

    if (els.statsTopActivities) {
      const top = m.topActivities.slice(0, 8);
      els.statsTopActivities.innerHTML = top.length
        ? top.map((a) => `
          <div class="row">
            <div>${escapeHTML(a.name)} <span class="muted">(${escapeHTML(a.cat)})</span></div>
            <div><b>${Math.round(a.pct * 100)}%</b> <span class="muted">(${a.done}/${a.total})</span></div>
          </div>
        `).join("")
        : `<div class="emptyState">Sin actividades todavía.</div>`;
    }

    if (els.statsNarrative) {
      els.statsNarrative.innerHTML = `
        <div class="narrativeBox">
          ${escapeHTML(narrativeFromMetrics(m))}
        </div>
      `;
    }
  }

  /* =========================================================
     Manage
  ========================================================= */
  function openAdd() {
    state.editId = null;
    saveState();

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
    saveState();

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
    saveState();
  }

  function saveActivityFromForm() {
    const name = (els.mName?.value || "").trim();
    const category = (els.mCategory?.value || "").trim();
    const type = els.mType?.value === "daily" ? "daily" : "complement";
    const subcategory = (els.mSub?.value || "").trim();

    const durRaw = (els.mDuration?.value || "").trim();
    const duration = durRaw === "" ? undefined : clamp(Math.round(Number(durRaw)), 0, 960);

    const energyRaw = els.mEnergy?.value || "__none__";
    const energy = ["low", "mid", "high"].includes(energyRaw) ? energyRaw : undefined;

    if (!name || !category) {
      toast("Pongan nombre y categoría. El caos no se clasifica solo.", "warn");
      return;
    }

    if (durRaw !== "" && !Number.isFinite(Number(durRaw))) {
      toast("La duración debe ser un número válido.", "warn");
      return;
    }

    if (state.editId) {
      const a = aById(state.editId);
      if (!a) return;
      a.name = name;
      a.category = category;
      a.type = type;
      a.subcategory = subcategory;
      a.duration = duration;
      a.energy = energy;
    } else {
      db.activities.push(normalizeActivity({
        id: uid(),
        name,
        category,
        type,
        subcategory,
        duration,
        energy,
      }));
    }

    saveDB();
    rebuildCategoryFilter();
    closeForm();
    renderManage();
    renderToday();
    renderWeek();
    renderHistory();
    renderStats();
    toast("Actividad guardada ✅", "ok");
  }

  function deleteActivity(id) {
    const a = aById(id);
    if (!a) return;

    const doDelete = () => {
      db.activities = db.activities.filter((x) => x.id !== id);

      for (const iso of Object.keys(db.logs)) {
        if (db.logs[iso]?.checksDaily?.[id]) delete db.logs[iso].checksDaily[id];
      }

      if (db.cycle?.done?.[id]) delete db.cycle.done[id];

      saveDB();
      rebuildCategoryFilter();
      renderManage();
      renderToday();
      renderWeek();
      renderHistory();
      renderStats();
      toast("Actividad borrada 🗑️", "warn");
      modalClose();
    };

    modalOpen({
      title: "Borrar actividad",
      desc: "Esto elimina también su rastro en checks diarios.",
      contentHTML: `<div class="hint">¿Seguro que quieren borrar <b>${escapeHTML(a.name)}</b>?</div>`,
      actions: [
        { label: "Cancelar", kind: "ghost", onClick: modalClose },
        { label: "Borrar", kind: "danger", onClick: doDelete },
      ],
    });
  }

  function renderManage() {
    rebuildCategoryFilter();
    const list = getFilteredActivities({ forManage: true });

    if (!els.manageList) return;

    if (!list.length) {
      els.manageList.innerHTML = `<div class="emptyState">No hay actividades que coincidan con ese filtro.</div>`;
      return;
    }

    els.manageList.innerHTML = list.map((a) => {
      const t = a.type === "daily" ? "Diaria" : "Rotación semanal";
      return `
        <div class="manageItem">
          <div>
            <div class="manageName">${escapeHTML(a.name)}</div>
            <div class="manageMeta">
              ${escapeHTML(a.category)}
              ${a.subcategory ? ` · ${escapeHTML(a.subcategory)}` : ""}
              · ${escapeHTML(t)}
              ${a.energy ? ` · ${escapeHTML(energyLabel(a.energy))}` : ""}
              ${Number.isFinite(a.duration) ? ` · ${escapeHTML(fmtDurationMin(a.duration))}` : ""}
            </div>
          </div>
          <div class="smallBtns">
            <button class="small" data-edit="${escapeHTML(a.id)}" type="button">Editar</button>
            <button class="small danger" data-del="${escapeHTML(a.id)}" type="button">Borrar</button>
          </div>
        </div>
      `;
    }).join("");

    $$("[data-edit]", els.manageList).forEach((btn) => {
      on(btn, "click", () => openEdit(btn.dataset.edit));
    });

    $$("[data-del]", els.manageList).forEach((btn) => {
      on(btn, "click", () => deleteActivity(btn.dataset.del));
    });
  }

  /* =========================================================
     Export / Import / Wipe
  ========================================================= */
  function exportJSON() {
    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        version: DB_SCHEMA,
        app: "Bitácora",
      },
      db,
      state,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `bitacora_backup_${todayISO()}.json`;
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
          toast("Ese JSON no parece un backup válido de Bitácora.", "warn");
          return;
        }

        db = migrateDB(obj.db);
        saveDB();

        if (obj.state && typeof obj.state === "object") {
          state = {
            ...state,
            ...obj.state,
            dateISO: obj.state.dateISO || todayISO(),
            weekStartISO: obj.state.weekStartISO || startOfWeekISO(obj.state.dateISO || todayISO()),
            view: obj.state.view || "today",
          };
          saveState();
        }

        rebuildCategoryFilter();
        setView(state.view || "today");
        renderWeek();
        renderHistory();
        renderStats();

        toast("Importado. Sobrevivieron los datos, cosa rara pero bonita ✅", "ok");
      } catch {
        toast("JSON inválido.", "warn");
      }
    };
    fr.readAsText(file);
  }

  function exportCSV() {
    const rangeDays = 90;
    const endISO = todayISO();
    const days = getDateRangeArray(endISO, rangeDays);

    const header = [
      "id",
      "name",
      "category",
      "subcategory",
      "type",
      "energy",
      "duration_min",
      ...days,
    ];

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

      const marks = days.map((iso) => isDoneFor(iso, a) ? 1 : 0);
      return [...base, ...marks];
    });

    const notesHeader = ["date", "notes"];
    const notesRows = getAllLogDatesSortedDesc().map((iso) => [iso, db.logs[iso]?.notes || ""]);

    const csv1 = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    const csv2 = [notesHeader, ...notesRows].map((r) => r.map(csvEscape).join(",")).join("\n");

    const finalCsv = `# ACTIVIDADES\n${csv1}\n\n# NOTAS\n${csv2}`;

    const blob = new Blob([finalCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `bitacora_export_${todayISO()}.csv`;
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
      state = loadState();
      saveDB();
      saveState();
      rebuildCategoryFilter();
      setView("today");
      renderWeek();
      renderHistory();
      renderStats();
      toast("Datos locales borrados. Renacimiento digital 🔥", "warn");
      modalClose();
    };

    modalOpen({
      title: "Borrar datos locales",
      desc: "Esto elimina TODO lo guardado en este dispositivo.",
      contentHTML: `<div class="hint">Esto sí es nuclear. No hay Ctrl+Z.</div>`,
      actions: [
        { label: "Cancelar", kind: "ghost", onClick: modalClose },
        { label: "Borrar todo", kind: "danger", onClick: doWipe },
      ],
    });
  }

  /* =========================================================
     Canvas charts
  ========================================================= */
  function getCanvasContext(canvas) {
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) return null;
    return canvas.getContext("2d");
  }

  function clearCanvas(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
  }

  function drawBarsChart(canvas, values = [], labels = []) {
    const ctx = getCanvasContext(canvas);
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    clearCanvas(ctx, w, h);

    const padX = 24;
    const padTop = 16;
    const padBottom = 32;
    const chartH = h - padTop - padBottom;
    const chartW = w - padX * 2;

    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - padX, y);
      ctx.stroke();
    }

    const maxV = Math.max(1, ...values);
    const gap = 12;
    const count = Math.max(1, values.length);
    const barW = Math.max(8, (chartW - gap * (count - 1)) / count);

    values.forEach((v, i) => {
      const x = padX + i * (barW + gap);
      const barH = chartH * (v / maxV);
      const y = padTop + chartH - barH;

      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, "rgba(124,58,237,.92)");
      grad.addColorStop(1, "rgba(34,197,94,.82)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW, barH);

      if (labels[i]) {
        ctx.fillStyle = "rgba(229,231,235,.72)";
        ctx.font = "12px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(String(labels[i]), x + barW / 2, h - 10);
      }
    });
  }

  function drawLineChart(canvas, values = []) {
    const ctx = getCanvasContext(canvas);
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    clearCanvas(ctx, w, h);

    const padX = 24;
    const padTop = 16;
    const padBottom = 22;
    const chartW = w - padX * 2;
    const chartH = h - padTop - padBottom;

    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - padX, y);
      ctx.stroke();
    }

    if (!values.length) return;

    const maxV = Math.max(100, ...values);
    const minV = Math.min(0, ...values);
    const range = Math.max(1, maxV - minV);

    const points = values.map((v, i) => {
      const x = padX + (chartW * i) / Math.max(1, values.length - 1);
      const y = padTop + chartH - ((v - minV) / range) * chartH;
      return { x, y, v };
    });

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(124,58,237,.92)";
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    points.forEach((p) => {
      ctx.beginPath();
      ctx.fillStyle = "rgba(34,197,94,.95)";
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /* =========================================================
     Settings
  ========================================================= */
  function renderSettings() {
    if (!els.appInfo) return;

    const approxDb = JSON.stringify(db).length;
    const approxState = JSON.stringify(state).length;
    const kb = ((approxDb + approxState) / 1024).toFixed(1);

    els.appInfo.textContent =
      `Offline · localStorage · esquema v${DB_SCHEMA} · ${db.activities.length} actividades · ${Object.keys(db.logs).length} días registrados · ~${kb} KB`;
  }

  /* =========================================================
     Events
  ========================================================= */
  function bind() {
    // Tabs
    on(els.btnToday, "click", () => setView("today"));
    on(els.btnWeek, "click", () => {
      state.weekStartISO = startOfWeekISO(state.dateISO);
      saveState();
      setView("week");
    });
    on(els.btnHistory, "click", () => setView("history"));
    on(els.btnStats, "click", () => setView("stats"));
    on(els.btnManage, "click", () => setView("manage"));
    on(els.btnSettings, "click", () => setView("settings"));
    bindTabsKeyboard();

    // Day nav
    on(els.prevDay, "click", () => {
      state.dateISO = addDays(state.dateISO, -1);
      saveState();
      renderToday();
    });

    on(els.nextDay, "click", () => {
      state.dateISO = addDays(state.dateISO, +1);
      saveState();
      renderToday();
    });

    // Week nav
    on(els.prevWeek, "click", () => {
      state.weekStartISO = addDays(state.weekStartISO, -7);
      saveState();
      renderWeek();
    });

    on(els.nextWeek, "click", () => {
      state.weekStartISO = addDays(state.weekStartISO, +7);
      saveState();
      renderWeek();
    });

    // Today filters
    on(els.search, "input", renderToday);
    on(els.categoryFilter, "change", renderToday);
    on(els.modeFilter, "change", renderToday);
    on(els.energyFilter, "change", renderToday);

    // Chips
    on(els.chipPending, "click", () => {
      state.pendingFirst = !getChipPressed(els.chipPending);
      saveState();
      renderToday();
    });

    on(els.chipShowDone, "click", () => {
      state.showDone = !getChipPressed(els.chipShowDone);
      saveState();
      renderToday();
    });

    on(els.btnCollapseDone, "click", () => {
      state.collapseDone = !state.collapseDone;
      saveState();
      renderToday();
    });

    on(els.btnResetFilters, "click", () => {
      if (els.search) els.search.value = "";
      if (els.categoryFilter) els.categoryFilter.value = "__all__";
      if (els.modeFilter) els.modeFilter.value = "all";
      if (els.energyFilter) els.energyFilter.value = "__all__";
      state.pendingFirst = true;
      state.showDone = true;
      state.collapseDone = false;
      saveState();
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

    // History / Stats ranges
    on(els.historyRange, "change", renderHistory);
    on(els.statsRange, "change", renderStats);

    // Export / import
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
  }

  /* =========================================================
     Boot
  ========================================================= */
  function boot() {
    ensureCycleFor(state.dateISO || todayISO());
    rebuildCategoryFilter();
    bind();
    setView(state.view || "today");
    renderWeek();
    renderHistory();
    renderStats();
    renderSettings();
  }

  boot();
})();
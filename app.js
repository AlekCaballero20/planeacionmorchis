/* app.js
   Bitácora - Alek & Cata (v6)
   ------------------------------------------------------------
   ✅ Perfiles separados: Alek / Cata
   ✅ Día siempre inicia en hoy
   ✅ Agenda: calendario + detalle + horario construido
   ✅ Duraciones en bloques de 30 min
   ✅ Sin tiempo predeterminado por actividad
   ✅ Exportar JSON en topbar
   ✅ Importar / Exportar CSV
   ✅ Diarias por día
   ✅ Complementarias por semana
   ✅ Hoy / Semana / Histórico / Estadísticas / Manage / Ajustes
   ✅ Toast + modal
   ✅ Tabs accesibles
*/

(() => {
  "use strict";

  /* =========================================================
     Storage / constants
  ========================================================= */
  const LS_KEY = "bitacora_v6_db";
  const LS_STATE = "bitacora_v6_state";
  const DB_SCHEMA = 6;

  const PROFILES = ["alek", "cata"];
  const DURATION_STEP = 30;
  const DAY_START_HOUR = 6;
  const DAY_START_MINUTE = 0;

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const monthNamesShort = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const monthNamesFull = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  /* =========================================================
     DOM helpers
  ========================================================= */
  const $ = (sel, scope = document) => scope?.querySelector?.(sel) || null;
  const $$ = (sel, scope = document) => Array.from(scope?.querySelectorAll?.(sel) || []);

  function on(el, evt, fn, opts) {
    if (!el) return;
    el.addEventListener(evt, fn, opts);
  }

  /* =========================================================
     Elements
  ========================================================= */
  const els = {
    toastRegion: $("#toastRegion"),
    modalOverlay: $("#modalOverlay"),
    modalClose: $("#modalClose"),
    modalTitle: $("#modalTitle"),
    modalDesc: $("#modalDesc"),
    modalContent: $("#modalContent"),
    modalActions: $("#modalActions"),
    appInfo: $("#appInfo"),

    dateTitle: $("#dateTitle"),
    kpiDaily: $("#kpiDaily"),
    kpiDailyHelp: $("#kpiDailyHelp"),
    kpiCount: $("#kpiCount"),
    kpiError: $("#kpiError"),
    balancePill: $("#balancePill"),
    selectedDayMeta: $("#selectedDayMeta"),

    search: $("#search"),
    categoryFilter: $("#categoryFilter"),
    modeFilter: $("#modeFilter"),
    energyFilter: $("#energyFilter"),
    chipPending: $("#chipPending"),
    chipShowDone: $("#chipShowDone"),
    btnResetFilters: $("#btnResetFilters"),
    btnCollapseDone: $("#btnCollapseDone"),

    dayNotes: $("#dayNotes"),
    noteSaved: $("#noteSaved"),

    btnToday: $("#btnToday"),
    btnAgenda: $("#btnAgenda"),
    btnWeek: $("#btnWeek"),
    btnHistory: $("#btnHistory"),
    btnStats: $("#btnStats"),
    btnManage: $("#btnManage"),
    btnSettings: $("#btnSettings"),

    viewToday: $("#viewToday"),
    viewAgenda: $("#viewAgenda"),
    viewWeek: $("#viewWeek"),
    viewHistory: $("#viewHistory"),
    viewStats: $("#viewStats"),
    viewManage: $("#viewManage"),
    viewSettings: $("#viewSettings"),

    prevDay: $("#prevDay"),
    nextDay: $("#nextDay"),

    todaySub: $("#todaySub"),
    timeTrackerWrap: $("#timeTrackerWrap"),
    pendingList: $("#pendingList"),
    doneList: $("#doneList"),
    pendingCount: $("#pendingCount"),
    doneCount: $("#doneCount"),
    doneBucket: $("#doneBucket"),
    btnCheckAll: $("#btnCheckAll"),
    btnUncheckAll: $("#btnUncheckAll"),

    agendaMonthLabel: $("#agendaMonthLabel"),
    agendaCalendar: $("#agendaCalendar"),
    agendaDayDetail: $("#agendaDayDetail"),
    agendaSchedule: $("#agendaSchedule"),
    prevMonth: $("#prevMonth"),
    nextMonth: $("#nextMonth"),

    prevWeek: $("#prevWeek"),
    nextWeek: $("#nextWeek"),
    weekGrid: $("#weekGrid"),
    weekByDay: $("#weekByDay"),
    weekByCategory: $("#weekByCategory"),
    weekSub: $("#weekSub"),
    weekInsight: $("#weekInsight"),

    historyRange: $("#historyRange"),
    historySummary: $("#historySummary"),
    chartHistoryTrend: $("#chartHistoryTrend"),
    historyTrendHint: $("#historyTrendHint"),
    historyCalendar: $("#historyCalendar"),
    historyHighlights: $("#historyHighlights"),
    historyTimeline: $("#historyTimeline"),
    historyTopActivities: $("#historyTopActivities"),

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

    btnAdd: $("#btnAdd"),
    manageForm: $("#manageForm"),
    mName: $("#mName"),
    mCategory: $("#mCategory"),
    mType: $("#mType"),
    mSub: $("#mSub"),
    mEnergy: $("#mEnergy"),
    btnCancelEdit: $("#btnCancelEdit"),
    btnSaveActivity: $("#btnSaveActivity"),
    manageList: $("#manageList"),
    manageSearch: $("#manageSearch"),
    manageFilterType: $("#manageFilterType"),

    btnExport2: $("#btnExport2"),
    importFile2: $("#importFile2"),
    btnExportCSV2: $("#btnExportCSV2"),
    btnWipeAll: $("#btnWipeAll"),

    btnProfileAlek: $("#btnProfileAlek"),
    btnProfileCata: $("#btnProfileCata"),
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
    return Math.round((isoToDate(bISO).getTime() - isoToDate(aISO).getTime()) / 86400000);
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

  function escapeHTML(s) {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({
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

  function roundToStep(mins, step = DURATION_STEP) {
    const n = safeNumber(mins, 0);
    if (n <= 0) return 0;
    return Math.round(n / step) * step;
  }

  function ensureStep(mins, step = DURATION_STEP) {
    const n = safeNumber(mins, 0);
    if (n <= 0) return 0;
    return Math.max(step, roundToStep(n, step));
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

  function toClock(totalMinutes) {
    const mins = safeNumber(totalMinutes, 0);
    const hh = Math.floor(mins / 60).toString().padStart(2, "0");
    const mm = (mins % 60).toString().padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function dayBaseMinutes() {
    return DAY_START_HOUR * 60 + DAY_START_MINUTE;
  }

  // Hora actual como "HH:MM"
  function nowHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // Valida y retorna "HH:MM" o null (cubre el formato antiguo `true`)
  function parseDoneTime(val) {
    if (typeof val === "string" && /^\d{2}:\d{2}$/.test(val)) return val;
    return null;
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
      type === "err" ? "toastErr" : "";

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

      $$("[data-modal-action]", els.modalActions).forEach(btn => {
        on(btn, "click", () => {
          const fn = actions?.[Number(btn.dataset.modalAction)]?.onClick;
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
  on(els.modalOverlay, "click", e => {
    if (e.target === els.modalOverlay) modalClose();
  });
  on(document, "keydown", e => {
    if (e.key === "Escape" && els.modalOverlay && !els.modalOverlay.classList.contains("hidden")) {
      modalClose();
    }
  });

  /* =========================================================
     Data model v6
     db = {
       schemaVersion: 6,
       activities: [{id,name,category,subcategory,type,energy?}],
       profiles: {
         alek: {
           logs: { [iso]: { checksDaily:{[id]:true}, notes:"", durations:{[id]:mins} } },
           cycle: { weekStartISO:"YYYY-MM-DD", done:{[id]:true} }
         },
         cata: { ... }
       }
     }
  ========================================================= */
  function getSeedArray() {
    return window.BITACORA_SEED || window.RITUAL_SEED || [];
  }

  function normalizeActivity(a) {
    const energy = ["low", "mid", "high"].includes(a?.energy) ? a.energy : undefined;
    return {
      id: a?.id || uid(),
      name: String(a?.name || "").trim() || "Sin nombre",
      category: String(a?.category || "").trim() || "General",
      subcategory: String(a?.subcategory || "").trim(),
      type: a?.type === "daily" ? "daily" : "complement",
      energy,
    };
  }

  function emptyProfile() {
    return {
      logs: {},
      cycle: { weekStartISO: startOfWeekISO(todayISO()), done: {} },
    };
  }

  function seedDB() {
    return {
      schemaVersion: DB_SCHEMA,
      activities: getSeedArray().map(normalizeActivity),
      profiles: {
        alek: emptyProfile(),
        cata: emptyProfile(),
      },
    };
  }

  function migrateProfileLogs(logs) {
    Object.keys(logs).forEach(iso => {
      const day = logs[iso];
      if (!day || typeof day !== "object") {
        logs[iso] = { checksDaily: {}, notes: "", durations: {} };
        return;
      }

      if (day.checks && !day.checksDaily) {
        day.checksDaily = day.checks;
        delete day.checks;
      }

      if (!day.checksDaily || typeof day.checksDaily !== "object") day.checksDaily = {};
      if (typeof day.notes !== "string") day.notes = String(day.notes || "");
      if (!day.durations || typeof day.durations !== "object") day.durations = {};
      if (!Array.isArray(day.entries)) day.entries = [];

      Object.keys(day.durations).forEach(id => {
        day.durations[id] = ensureStep(day.durations[id], DURATION_STEP);
        if (!day.durations[id]) delete day.durations[id];
      });

      day.entries = day.entries
        .filter(x => x && typeof x === "object" && x.activityId)
        .map(x => ({
          id: x.id || uid(),
          activityId: String(x.activityId),
          minutes: ensureStep(x.minutes, DURATION_STEP),
          time: parseDoneTime(x.time),
          createdAt: safeNumber(x.createdAt, Date.now()),
        }))
        .filter(x => x.minutes > 0);
    });
    return logs;
  }

  function migrateDB(raw) {
    if (!raw || typeof raw !== "object") return seedDB();

    if (!raw.profiles) {
      const alekLogs = raw.logs || {};
      const alekCycle = raw.cycle || { weekStartISO: startOfWeekISO(todayISO()), done: {} };
      raw.profiles = {
        alek: { logs: alekLogs, cycle: alekCycle },
        cata: emptyProfile(),
      };
      delete raw.logs;
      delete raw.cycle;
    }

    PROFILES.forEach(p => {
      if (!raw.profiles[p] || typeof raw.profiles[p] !== "object") raw.profiles[p] = emptyProfile();
      const prof = raw.profiles[p];
      if (!prof.logs || typeof prof.logs !== "object") prof.logs = {};
      if (!prof.cycle || typeof prof.cycle !== "object") prof.cycle = { weekStartISO: startOfWeekISO(todayISO()), done: {} };
      if (!prof.cycle.weekStartISO) prof.cycle.weekStartISO = startOfWeekISO(todayISO());
      if (!prof.cycle.done || typeof prof.cycle.done !== "object") prof.cycle.done = {};
      if (!prof.cycle.doneAt || typeof prof.cycle.doneAt !== "object") prof.cycle.doneAt = {};
      prof.logs = migrateProfileLogs(prof.logs);
    });

    if (!Array.isArray(raw.activities)) raw.activities = [];
    raw.activities = raw.activities.filter(Boolean).map(normalizeActivity);
    raw.schemaVersion = DB_SCHEMA;

    return raw;
  }

  function saveDB() {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
    // Sync a Firebase en background (write-through)
    if (window.BitacoraCloud?.ready) {
      window.BitacoraCloud.save(db).catch(() => {});
    }
  }

  function loadDB() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      const fresh = seedDB();
      localStorage.setItem(LS_KEY, JSON.stringify(fresh));
      return fresh;
    }
    try {
      const migrated = migrateDB(JSON.parse(raw));
      localStorage.setItem(LS_KEY, JSON.stringify(migrated));
      return migrated;
    } catch {
      const fresh = seedDB();
      localStorage.setItem(LS_KEY, JSON.stringify(fresh));
      return fresh;
    }
  }

  function loadState() {
    const now = new Date();
    const fallback = {
      view: "today",
      dateISO: todayISO(),
      weekStartISO: startOfWeekISO(todayISO()),
      editId: null,
      showDone: true,
      collapseDone: false,
      pendingFirst: true,
      profile: "alek",
      agendaYear: now.getFullYear(),
      agendaMonth: now.getMonth(),
      agendaSelectedDay: todayISO(),
    };

    const raw = localStorage.getItem(LS_STATE);
    if (!raw) return fallback;

    try {
      const s = JSON.parse(raw);
      const today = todayISO();
      return {
        view: s.view || fallback.view,
        dateISO: today,
        weekStartISO: startOfWeekISO(today),
        editId: s.editId || null,
        showDone: s.showDone !== false,
        collapseDone: s.collapseDone === true,
        pendingFirst: s.pendingFirst !== false,
        profile: PROFILES.includes(s.profile) ? s.profile : "alek",
        agendaYear: s.agendaYear || now.getFullYear(),
        agendaMonth: s.agendaMonth !== undefined ? s.agendaMonth : now.getMonth(),
        agendaSelectedDay: today,
      };
    } catch {
      return fallback;
    }
  }

  function saveState() {
    localStorage.setItem(LS_STATE, JSON.stringify(state));
  }

  // Sincroniza desde Firebase al iniciar (no bloquea la UI)
  async function syncFromCloud() {
    if (!window.BitacoraCloud?.ready) return;
    try {
      const cloudData = await window.BitacoraCloud.load();
      if (!cloudData) return;
      db = migrateDB(cloudData);
      localStorage.setItem(LS_KEY, JSON.stringify(db));
      renderCurrentView();
      console.log("[BitacoraCloud] Sincronizado desde la nube ✅");
    } catch (e) {
      console.warn("[BitacoraCloud] syncFromCloud error:", e);
    }
  }

  let db = loadDB();
  let state = loadState();

  /* =========================================================
     Profile helpers
  ========================================================= */
  function activeProfile() {
    return state.profile || "alek";
  }

  function activeProfileData() {
    const p = activeProfile();
    if (!db.profiles[p]) db.profiles[p] = emptyProfile();
    return db.profiles[p];
  }

  /* =========================================================
     Data helpers
  ========================================================= */
  function ensureDay(iso) {
    const pd = activeProfileData();
    if (!pd.logs[iso]) pd.logs[iso] = { checksDaily: {}, notes: "", durations: {}, entries: [] };
    const day = pd.logs[iso];
    if (!day.checksDaily || typeof day.checksDaily !== "object") day.checksDaily = {};
    if (typeof day.notes !== "string") day.notes = String(day.notes || "");
    if (!day.durations || typeof day.durations !== "object") day.durations = {};
    if (!Array.isArray(day.entries)) day.entries = [];
  }

  function ensureCycleFor(refISO) {
    const pd = activeProfileData();
    const week = startOfWeekISO(refISO || todayISO());
    if (!pd.cycle) pd.cycle = { weekStartISO: week, done: {}, doneAt: {} };
    if (!pd.cycle.done || typeof pd.cycle.done !== "object") pd.cycle.done = {};
    if (!pd.cycle.doneAt || typeof pd.cycle.doneAt !== "object") pd.cycle.doneAt = {};
    if (!pd.cycle.weekStartISO) pd.cycle.weekStartISO = week;
    if (pd.cycle.weekStartISO !== week) {
      pd.cycle.weekStartISO = week;
      pd.cycle.done = {};
      pd.cycle.doneAt = {};
      saveDB();
    }
  }

  function aById(id) {
    return db.activities.find(x => x.id === id);
  }

  function allCategories() {
    return unique(db.activities.map(a => a.category).filter(Boolean)).sort(sortByLocale);
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
    const pd = activeProfileData();
    if (activity.type === "daily") return !!(pd.logs[iso]?.checksDaily?.[activity.id]);
    return !!(pd.cycle?.done?.[activity.id]);
  }

  function setDoneFor(iso, activity, done, timeHHMM) {
    ensureDay(iso);
    ensureCycleFor(iso);
    const pd = activeProfileData();
    const t = timeHHMM || nowHHMM();

    if (activity.type === "daily") {
      if (done) pd.logs[iso].checksDaily[activity.id] = t;
      else delete pd.logs[iso].checksDaily[activity.id];
    } else {
      if (done) {
        pd.cycle.done[activity.id] = true;
        pd.cycle.doneAt[activity.id] = t;
      } else {
        delete pd.cycle.done[activity.id];
        delete pd.cycle.doneAt[activity.id];
      }
    }

    saveDB();
  }

  function getDoneTimeFor(iso, activity) {
    const pd = activeProfileData();
    if (activity.type === "daily") {
      return parseDoneTime(pd.logs[iso]?.checksDaily?.[activity.id]);
    }
    return parseDoneTime(pd.cycle?.doneAt?.[activity.id]);
  }

  function setDoneTimeFor(iso, activity, timeHHMM) {
    if (!isDoneFor(iso, activity)) return;
    const pd = activeProfileData();
    if (activity.type === "daily") {
      ensureDay(iso);
      pd.logs[iso].checksDaily[activity.id] = timeHHMM;
    } else {
      ensureCycleFor(iso);
      pd.cycle.doneAt[activity.id] = timeHHMM;
    }
    saveDB();
  }

  function setLoggedDuration(iso, actId, minutes) {
    ensureDay(iso);
    const pd = activeProfileData();
    const normalized = ensureStep(minutes, DURATION_STEP);
    if (normalized > 0) pd.logs[iso].durations[actId] = normalized;
    else delete pd.logs[iso].durations[actId];
    saveDB();
  }

  function adjustLoggedDuration(iso, actId, delta) {
    const current = getLoggedDuration(iso, actId);
    const next = Math.max(0, current + delta);
    setLoggedDuration(iso, actId, next);
    return getLoggedDuration(iso, actId);
  }

  function getLoggedDuration(iso, actId) {
    const pd = activeProfileData();
    return ensureStep(pd.logs[iso]?.durations?.[actId] || 0, DURATION_STEP);
  }

  function getTimeEntries(iso, actId = null) {
    const pd = activeProfileData();
    const all = Array.isArray(pd.logs[iso]?.entries) ? pd.logs[iso].entries : [];
    const filtered = actId ? all.filter(x => x.activityId === actId) : all.slice();
    return filtered.sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return safeNumber(a.createdAt, 0) - safeNumber(b.createdAt, 0);
    });
  }

  function addTimeEntry(iso, activity, minutes, timeHHMM) {
    const normalized = ensureStep(minutes, DURATION_STEP);
    if (!normalized) return;
    ensureDay(iso);
    const pd = activeProfileData();
    const day = pd.logs[iso];
    const parsedTime = parseDoneTime(timeHHMM);
    day.entries.push({
      id: uid(),
      activityId: activity.id,
      minutes: normalized,
      time: parsedTime,
      createdAt: Date.now(),
    });
    const current = getLoggedDuration(iso, activity.id);
    day.durations[activity.id] = current + normalized;

    if (!isDoneFor(iso, activity)) setDoneFor(iso, activity, true, parsedTime || nowHHMM());
    else if (parsedTime && !getDoneTimeFor(iso, activity)) setDoneTimeFor(iso, activity, parsedTime);

    saveDB();
  }

  function removeTimeEntry(iso, entryId) {
    ensureDay(iso);
    const pd = activeProfileData();
    const day = pd.logs[iso];
    const idx = day.entries.findIndex(x => x.id === entryId);
    if (idx < 0) return false;
    const entry = day.entries[idx];
    day.entries.splice(idx, 1);

    const current = getLoggedDuration(iso, entry.activityId);
    const next = Math.max(0, current - ensureStep(entry.minutes, DURATION_STEP));
    if (next > 0) day.durations[entry.activityId] = next;
    else delete day.durations[entry.activityId];
    saveDB();
    return true;
  }

  function getFilteredActivities({ forManage = false } = {}) {
    const q = ((forManage ? els.manageSearch?.value : els.search?.value) || "").trim().toLowerCase();
    const cat = els.categoryFilter?.value || "__all__";
    const mode = (forManage ? els.manageFilterType?.value : els.modeFilter?.value) || (forManage ? "__all__" : "all");
    const energy = els.energyFilter?.value || "__all__";

    return db.activities
      .filter(a => {
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
      cats.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
    els.categoryFilter.value = cats.includes(current) ? current : "__all__";
  }

  function getDateRangeArray(endISO, rangeDays) {
    const startISO = addDays(endISO, -(rangeDays - 1));
    return Array.from({ length: rangeDays }, (_, i) => addDays(startISO, i));
  }

  function getDayMetrics(iso) {
    const pd = activeProfileData();
    const day = pd.logs[iso];
    const dailyActs = db.activities.filter(a => a.type === "daily");
    const allActs = db.activities;

    let doneDaily = 0;
    let doneAll = 0;
    let visibleCount = 0;
    let totalDurationDone = 0;
    const durations = day?.durations || {};

    for (const a of dailyActs) {
      if (isDoneFor(iso, a)) doneDaily++;
    }

    for (const a of allActs) {
      visibleCount++;
      if (isDoneFor(iso, a)) {
        doneAll++;
        if (durations[a.id]) totalDurationDone += durations[a.id];
      }
    }

    return {
      iso,
      doneDaily,
      totalDaily: dailyActs.length,
      doneAll,
      totalAll: visibleCount,
      pctDaily: dailyActs.length ? doneDaily / dailyActs.length : 0,
      pctAll: visibleCount ? doneAll / visibleCount : 0,
      totalDurationDone,
      notes: day?.notes || "",
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
        hay.includes("descanso") || hay.includes("medit") || hay.includes("pausa") || hay.includes("respir") ||
        hay.includes("caminar") || hay.includes("jugar") || hay.includes("natur") || hay.includes("compartir") ||
        hay.includes("mascota") || hay.includes("serie") || hay.includes("película");

      const isWorkish =
        hay.includes("trabajo") || hay.includes("admin") || hay.includes("program") || hay.includes("pedagog") ||
        hay.includes("música") || hay.includes("dibujo") || hay.includes("arte") || hay.includes("francés") ||
        hay.includes("inglés") || hay.includes("italiano") || hay.includes("finanza") || hay.includes("planea");

      let score = 1;
      if (a.energy === "high") score = 1.6;
      if (a.energy === "mid") score = 1.15;
      if (a.energy === "low") score = 0.8;

      const w = score * times;
      if (isRestish && !isWorkish) descanso += w;
      else if (isWorkish && !isRestish) carga += w;
      else {
        carga += w * 0.6;
        descanso += w * 0.4;
      }
    }

    const total = carga + descanso;
    return { carga, descanso, restRatio: total ? descanso / total : 0.5 };
  }

  function computeMetrics({ rangeDays = 30 } = {}) {
    const endISO = todayISO();
    const days = getDateRangeArray(endISO, rangeDays);
    const dailyActs = db.activities.filter(a => a.type === "daily");
    const cats = unique(db.activities.map(a => a.category).filter(Boolean)).sort(sortByLocale);

    const byDay = days.map(iso => {
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

    const byCategory = cats.map(cat => {
      const acts = db.activities.filter(a => a.category === cat);
      let done = 0;
      let total = 0;
      for (const iso of days) {
        for (const a of acts) {
          total++;
          if (isDoneFor(iso, a)) done++;
        }
      }
      return { cat, done, total, pct: total ? done / total : 0 };
    }).sort((a, b) => b.pct - a.pct);

    const topActivities = db.activities.map(a => {
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
      .filter(a => a.done < a.total)
      .sort((a, b) => a.pct - b.pct || a.done - b.done);

    const avgDaily = avg(byDay.map(x => x.pctDaily));
    const avgAll = avg(byDay.map(x => x.pctAll));
    const bestDay = [...byDay].sort((a, b) => b.pctDaily - a.pctDaily || b.doneDaily - a.doneDaily)[0] || null;
    const worstDay = [...byDay].sort((a, b) => a.pctDaily - b.pctDaily || a.doneDaily - b.doneDaily)[0] || null;

    let streakCurrent = 0;
    let streakBest = 0;
    let working = 0;

    for (const d of byDay) {
      if (d.pctDaily >= 0.6) {
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

    const activeDays = byDay.filter(d => d.doneAll > 0).length;
    const emptyDays = byDay.filter(d => d.doneAll === 0).length;
    const noteDays = byDay.filter(d => (d.notes || "").trim()).length;
    const totalDuration = sum(byDay.map(d => d.duration || 0));

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

  function getDoneActsForDay(iso) {
    const pd = activeProfileData();
    const dayLog = pd.logs[iso];

    return db.activities.filter(a => {
      if (a.type === "daily") return !!dayLog?.checksDaily?.[a.id];
      ensureCycleFor(iso);
      return !!pd.cycle?.done?.[a.id];
    });
  }

  function buildScheduleForDay(iso) {
    const entries = getTimeEntries(iso)
      .map(entry => {
        const activity = aById(entry.activityId);
        if (!activity) return null;
        return {
          activity,
          duration: ensureStep(entry.minutes, DURATION_STEP),
          doneTime: parseDoneTime(entry.time) || getDoneTimeFor(iso, activity),
        };
      })
      .filter(Boolean);

    const usedByAct = {};
    entries.forEach(e => {
      usedByAct[e.activity.id] = (usedByAct[e.activity.id] || 0) + e.duration;
    });

    const doneActs = getDoneActsForDay(iso);
    doneActs.forEach(a => {
      const total = getLoggedDuration(iso, a.id);
      const remain = Math.max(0, total - (usedByAct[a.id] || 0));
      if (!remain && entries.some(e => e.activity.id === a.id)) return;
      if (!remain && !getDoneTimeFor(iso, a)) return;
      entries.push({
        activity: a,
        duration: remain,
        doneTime: getDoneTimeFor(iso, a),
      });
    });

    const ordered = entries.sort((a, b) => {
      if (a.doneTime && b.doneTime) return a.doneTime.localeCompare(b.doneTime);
      if (a.doneTime) return -1;
      if (b.doneTime) return 1;
      if (b.duration !== a.duration) return b.duration - a.duration;
      return a.activity.name.localeCompare(b.activity.name, "es");
    });

    return ordered.map(entry => {
      let startText = null;
      let endText = null;

      if (entry.doneTime) {
        const [hh, mm] = entry.doneTime.split(":").map(Number);
        const startMins = hh * 60 + mm;
        startText = entry.doneTime;
        endText = entry.duration > 0 ? toClock(startMins + entry.duration) : null;
      }

      return { ...entry, startText, endText };
    });
  }

  /* =========================================================
     View switching / tabs
  ========================================================= */
  const TAB_MAP = {
    today: { btn: els.btnToday, view: els.viewToday },
    agenda: { btn: els.btnAgenda, view: els.viewAgenda },
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
    if (view === "agenda") renderAgenda();
    if (view === "week") renderWeek();
    if (view === "history") renderHistory();
    if (view === "stats") renderStats();
    if (view === "manage") renderManage();
    if (view === "settings") renderSettings();
  }

  function bindTabsKeyboard() {
    const tabs = Object.values(TAB_MAP).map(x => x.btn).filter(Boolean);
    tabs.forEach((tab, idx) => {
      on(tab, "keydown", e => {
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
     Profile toggle
  ========================================================= */
  function updateProfileToggleUI() {
    const p = activeProfile();
    if (els.btnProfileAlek) {
      els.btnProfileAlek.classList.toggle("isActive", p === "alek");
      els.btnProfileAlek.setAttribute("aria-pressed", String(p === "alek"));
    }
    if (els.btnProfileCata) {
      els.btnProfileCata.classList.toggle("isActive", p === "cata");
      els.btnProfileCata.setAttribute("aria-pressed", String(p === "cata"));
    }
  }

  function setProfile(profile) {
    if (!PROFILES.includes(profile)) return;
    state.profile = profile;
    state.dateISO = todayISO();
    state.weekStartISO = startOfWeekISO(state.dateISO);
    state.agendaSelectedDay = state.dateISO;
    state.agendaYear = isoToDate(state.dateISO).getFullYear();
    state.agendaMonth = isoToDate(state.dateISO).getMonth();
    saveState();
    updateProfileToggleUI();
    renderCurrentView();
    renderSidebarDayMeta();
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
        activeProfileData().logs[iso].notes = els.dayNotes.value || "";
        saveDB();
        if (els.noteSaved) els.noteSaved.textContent = "guardado";
      }, 420);
    };
  }

  /* =========================================================
     Editar hora de actividad completada
  ========================================================= */
  function askEditTime(activity, iso) {
    const current = getDoneTimeFor(iso, activity) || nowHHMM();
    modalOpen({
      title: `🕐 Hora — ${activity.name}`,
      desc: "¿A qué hora hiciste esta actividad? Se usa para construir tu horario real del día.",
      contentHTML: `
        <div style="margin-top:8px">
          <label class="label" for="timeEditInput">Hora</label>
          <input id="timeEditInput" class="input" type="time" value="${escapeHTML(current)}"
                 autofocus style="font-size:22px;text-align:center;width:100%" />
          <div class="hint tiny" style="margin-top:8px">
            Se guarda como referencia para tu horario diario.
          </div>
        </div>
      `,
      actions: [
        { label: "Cancelar", kind: "ghost", onClick: () => { modalClose(); } },
        {
          label: "Guardar hora",
          onClick: () => {
            const val = document.getElementById("timeEditInput")?.value || "";
            if (!/^\d{2}:\d{2}$/.test(val)) {
              toast("Hora inválida", "warn");
              return;
            }
            setDoneTimeFor(iso, activity, val);
            modalClose();
            renderCurrentView();
            toast(`Hora guardada: ${val} ✅`, "ok");
          },
        },
      ],
    });

    setTimeout(() => {
      const inp = document.getElementById("timeEditInput");
      if (inp) {
        on(inp, "keydown", e => {
          if (e.key === "Enter") {
            e.preventDefault();
            $(".btn:not(.ghost)", els.modalActions)[0]?.click();
          }
        });
      }
    }, 50);
  }

  /* =========================================================
     Duration modal / controls
  ========================================================= */
  function askDuration(activity, iso) {
    modalOpen({
      title: `⏱ ${activity.name}`,
      desc: "¿Cuánto tiempo le dedicaron hoy? Se guarda solo en bloques de 30 min para construir el horario real.",
      contentHTML: `
        <div style="margin-top:8px">
          <label class="label" for="durationInput">Minutos dedicados</label>
          <input id="durationInput" class="input" type="number" min="${DURATION_STEP}" step="${DURATION_STEP}"
                 placeholder="Ej: 30, 60, 90" autofocus style="font-size:18px;text-align:center" />
          <div class="hint tiny" style="margin-top:8px">
            Se redondea a bloques de ${DURATION_STEP} min. Déjalo en blanco si no quieres registrarlo ahora.
          </div>
        </div>
      `,
      actions: [
        {
          label: "Omitir",
          kind: "ghost",
          onClick: () => {
            modalClose();
            renderCurrentView();
          },
        },
        {
          label: "Guardar",
          onClick: () => {
            const raw = document.getElementById("durationInput")?.value || "";
            const val = raw.trim() === "" ? 0 : Number(raw);

            if (raw.trim() !== "" && (!Number.isFinite(val) || val <= 0)) {
              toast("Ingresa un número válido.", "warn");
              return;
            }

            if (val > 0) setLoggedDuration(iso, activity.id, val);
            modalClose();
            renderCurrentView();
          },
        },
      ],
    });

    setTimeout(() => {
      const inp = document.getElementById("durationInput");
      if (inp) {
        on(inp, "keydown", e => {
          if (e.key === "Enter") {
            e.preventDefault();
            $$("[data-modal-action]", els.modalActions).find(b => b.dataset.modalAction === "1")?.click();
          }
        });
      }
    }, 50);
  }

  /* =========================================================
     Sidebar helpers
  ========================================================= */
  function renderSidebarDayMeta() {
    if (els.selectedDayMeta) {
      const prof = activeProfile() === "alek" ? "Alek" : "Cata";
      els.selectedDayMeta.textContent = `${prof} · ${fmtDateShort(state.dateISO)}`;
    }
  }

  function renderTimeTracker(iso) {
    if (!els.timeTrackerWrap) return;
    const activities = [...db.activities].sort((a, b) => a.name.localeCompare(b.name, "es"));
    const totalTracked = Object.values(activeProfileData().logs[iso]?.durations || {}).reduce((s, v) => s + ensureStep(v), 0);
    const remaining = Math.max(0, 1440 - totalTracked);
    const doneCount = activities.filter(a => isDoneFor(iso, a)).length;
    const pending = activities.filter(a => !isDoneFor(iso, a));
    const entries = getTimeEntries(iso).sort((a, b) => safeNumber(b.createdAt, 0) - safeNumber(a.createdAt, 0));

    els.timeTrackerWrap.innerHTML = `
      <div class="timeTracker">
        <div class="timeStats">
          <span class="tag tagTime">Hoy registradas: ${escapeHTML(fmtDurationMin(totalTracked))}</span>
          <span class="tag ${remaining <= 0 ? "tagNoTime" : ""}">Te quedan: ${escapeHTML(fmtDurationMin(remaining))}</span>
          <span class="tag">Hechas: ${doneCount}/${activities.length}</span>
          <span class="tag">Sin hacer: ${pending.length}</span>
        </div>
        <div class="timeQuickForm">
          <select id="timeEntryActivity" class="select" title="Actividad para registrar">
            <option value="">Selecciona actividad...</option>
            ${activities.map(a => `<option value="${escapeHTML(a.id)}">${escapeHTML(a.name)} (${escapeHTML(a.category)})</option>`).join("")}
          </select>
          <input id="timeEntryMinutes" class="input" type="number" min="${DURATION_STEP}" step="${DURATION_STEP}" placeholder="Min (30,60,90)" />
          <input id="timeEntryClock" class="input" type="time" value="${escapeHTML(nowHHMM())}" />
          <button id="btnAddTimeEntry" class="btn" type="button">+ Registrar</button>
        </div>
        ${pending.length ? `<div class="hint tiny">Actividades sin hacer hoy: ${escapeHTML(pending.slice(0, 5).map(a => a.name).join(", "))}${pending.length > 5 ? "..." : ""}</div>` : ""}
        <div class="timeEntries" id="dayTimeEntries">
          ${entries.length ? entries.map(entry => {
            const a = aById(entry.activityId);
            if (!a) return "";
            return `
              <div class="timeEntryRow">
                <div>
                  <div class="timeEntryTitle">${escapeHTML(a.name)}</div>
                  <div class="tiny">${entry.time ? escapeHTML(entry.time) + " · " : ""}${escapeHTML(fmtDurationMin(entry.minutes))} · ${escapeHTML(a.category)}</div>
                </div>
                <button class="small danger" type="button" data-action="remove-entry" data-entry-id="${escapeHTML(entry.id)}">Quitar</button>
              </div>
            `;
          }).join("") : `<div class="emptyState">Sin bloques registrados hoy. Registra sueño, trabajo, deporte o lo que hagas en el día.</div>`}
        </div>
      </div>
    `;
  }

  function bindTimeTracker(iso) {
    const addBtn = document.getElementById("btnAddTimeEntry");
    const entriesWrap = document.getElementById("dayTimeEntries");

    on(addBtn, "click", () => {
      const actId = document.getElementById("timeEntryActivity")?.value || "";
      const minutesRaw = document.getElementById("timeEntryMinutes")?.value || "";
      const clock = document.getElementById("timeEntryClock")?.value || "";
      const activity = aById(actId);
      const minutes = Number(minutesRaw);

      if (!activity) {
        toast("Elige una actividad para registrar.", "warn");
        return;
      }
      if (!Number.isFinite(minutes) || minutes <= 0) {
        toast("Ingresa minutos válidos (30, 60, 90...).", "warn");
        return;
      }

      addTimeEntry(iso, activity, minutes, clock);
      renderToday();
      toast("Bloque registrado ✅", "ok");
    });

    on(entriesWrap, "click", e => {
      const btn = e.target.closest("[data-action='remove-entry']");
      if (!btn) return;
      const ok = removeTimeEntry(iso, btn.dataset.entryId);
      if (ok) {
        renderToday();
        toast("Bloque eliminado", "ok");
      }
    });
  }

  /* =========================================================
     Today
  ========================================================= */
  function renderActivityCards(list, iso) {
    if (!list.length) return `<div class="emptyState">Nada por acá. Milagro administrativo, supongo ✅</div>`;

    return list.map(a => {
      const checked = isDoneFor(iso, a);
      const typeLabel = a.type === "daily" ? "Diaria" : "Rotación semanal";
      const loggedDur = getLoggedDuration(iso, a.id);
      const durLabel = loggedDur ? fmtDurationMin(loggedDur) : null;
      const doneTime = checked ? getDoneTimeFor(iso, a) : null;

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
              ${durLabel ? `<span class="tag tagTime">⏱ ${escapeHTML(durLabel)}</span>` : `<span class="tag tagNoTime">sin tiempo</span>`}
              ${doneTime
                ? `<span class="tag tagDoneTime" data-action="edit-time" data-id="${escapeHTML(a.id)}" title="Toca para editar la hora">🕐 ${escapeHTML(doneTime)} ✏️</span>`
                : (checked ? `<span class="tag tagNoTime" data-action="edit-time" data-id="${escapeHTML(a.id)}" title="Añadir hora">+ hora</span>` : "")
              }
            </div>
            ${checked ? `
              <div class="durationControls" style="margin-top:10px;">
                <button class="durationBtn" type="button" data-action="dec" data-id="${escapeHTML(a.id)}">−30</button>
                <div class="durationValue">${escapeHTML(loggedDur ? fmtDurationMin(loggedDur) : "0 min")}</div>
                <button class="durationBtn" type="button" data-action="inc" data-id="${escapeHTML(a.id)}">+30</button>
              </div>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  function bindCardDelegation(container) {
    if (!container || container.__boundBitacoraCard) return;
    container.__boundBitacoraCard = true;

    on(container, "change", e => {
      const target = e.target;
      if (!target?.classList?.contains("chk")) return;
      const id = target.dataset.id;
      const a = aById(id);
      if (!a) return;

      const checked = target.checked;
      setDoneFor(state.dateISO, a, checked);

      if (checked) {
        askDuration(a, state.dateISO);
      } else {
        setLoggedDuration(state.dateISO, a.id, 0);
        renderCurrentView();
      }
    });

    on(container, "click", e => {
      // Editar hora
      const timeBadge = e.target.closest("[data-action='edit-time']");
      if (timeBadge) {
        const id = timeBadge.dataset.id;
        const a = aById(id);
        if (a) askEditTime(a, state.dateISO);
        return;
      }

      // Ajustar duración
      const btn = e.target.closest(".durationBtn");
      if (!btn) return;
      const id = btn.dataset.id;
      const a = aById(id);
      if (!a) return;

      const delta = btn.dataset.action === "inc" ? DURATION_STEP : -DURATION_STEP;
      adjustLoggedDuration(state.dateISO, id, delta);
      renderCurrentView();
    });
  }

  function renderKPIs(iso) {
    const visible = getFilteredActivities({ forManage: false });
    const dailyActs = db.activities.filter(a => a.type === "daily");
    const doneDaily = dailyActs.filter(a => isDoneFor(iso, a)).length;
    const doneVisible = visible.filter(a => isDoneFor(iso, a)).length;
    const errAct = db.activities.find(a => (a.name || "").toLowerCase().includes("tiempo de error"));
    const errVal = errAct ? getLoggedDuration(iso, errAct.id) : 0;

    if (els.kpiDaily) els.kpiDaily.textContent = dailyActs.length ? `${Math.round((doneDaily / dailyActs.length) * 100)}%` : "0%";
    if (els.kpiDailyHelp) els.kpiDailyHelp.textContent = `diarias hoy (${doneDaily}/${dailyActs.length})`;
    if (els.kpiCount) els.kpiCount.textContent = `${doneVisible}/${visible.length}`;
    if (els.kpiError) els.kpiError.textContent = errVal ? fmtDurationMin(errVal) : "0";
  }

  function renderBalancePill(iso) {
    if (!els.balancePill) return;
    const doneActs = db.activities.filter(a => isDoneFor(iso, a));
    let carga = 0;
    let descanso = 0;

    for (const a of doneActs) {
      const hay = `${a.name} ${a.category} ${a.subcategory || ""}`.toLowerCase();
      const isRestish =
        hay.includes("descanso") || hay.includes("medit") || hay.includes("compartir") || hay.includes("mascota") ||
        hay.includes("juego") || hay.includes("película") || hay.includes("serie") || hay.includes("respir") || hay.includes("natur");

      const isWorkish =
        hay.includes("trabajo") || hay.includes("admin") || hay.includes("program") || hay.includes("pedagog") ||
        hay.includes("finan") || hay.includes("planea") || hay.includes("idioma") || hay.includes("arte") || hay.includes("música");

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
    if (els.dayNotes) els.dayNotes.value = activeProfileData().logs[iso]?.notes || "";
    bindNotesAutosave(iso);
    renderSidebarDayMeta();
    renderTimeTracker(iso);
    bindTimeTracker(iso);

    let activities = getFilteredActivities({ forManage: false });
    let pending = activities.filter(a => !isDoneFor(iso, a));
    let done = activities.filter(a => isDoneFor(iso, a));

    if (state.pendingFirst === false) {
      const merged = [...done, ...pending];
      done = merged.filter(a => isDoneFor(iso, a));
      pending = merged.filter(a => !isDoneFor(iso, a));
    }

    if (els.todaySub) {
      const mf = els.modeFilter?.value || "all";
      const ef = els.energyFilter?.value || "__all__";
      const modeLabel = mf === "daily" ? "Diarias" : mf === "complement" ? "Rotación" : "Todo";
      const energyTxt = ef === "__all__" ? "" : ` · ${energyLabel(ef)}`;
      const profileTxt = activeProfile() === "alek" ? " · Alek" : " · Cata";
      els.todaySub.textContent = `${modeLabel}${energyTxt}${profileTxt}`;
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

    bindCardDelegation(els.pendingList);
    bindCardDelegation(els.doneList);

    renderKPIs(iso);
    renderBalancePill(iso);
  }

  function bulkToggle(mode) {
    const iso = state.dateISO;
    const visibleDaily = getFilteredActivities({ forManage: false }).filter(a => a.type === "daily");
    visibleDaily.forEach(a => {
      setDoneFor(iso, a, mode === "check");
      if (mode !== "check") setLoggedDuration(iso, a.id, 0);
    });
    renderCurrentView();
    toast(mode === "check" ? "Diarias marcadas ✅" : "Diarias desmarcadas 🧼", "ok");
  }

  /* =========================================================
     Agenda
  ========================================================= */
  function renderAgenda() {
    const selected = state.agendaSelectedDay || todayISO();
    state.dateISO = selected;

    const selectedDate = isoToDate(selected);
    state.agendaYear = selectedDate.getFullYear();
    state.agendaMonth = selectedDate.getMonth();

    const year = state.agendaYear;
    const month = state.agendaMonth;
    const pd = activeProfileData();

    if (els.agendaMonthLabel) {
      const profLabel = activeProfile() === "alek" ? "Alek" : "Cata";
      els.agendaMonthLabel.textContent = `${monthNamesFull[month]} ${year} · ${profLabel}`;
    }

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dailyActs = db.activities.filter(a => a.type === "daily");

    const dayStats = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayLog = pd.logs[iso];
      const done = dayLog ? dailyActs.filter(a => !!dayLog.checksDaily?.[a.id]).length : 0;
      const durSum = dayLog ? Object.values(dayLog.durations || {}).reduce((s, v) => s + ensureStep(v), 0) : 0;
      dayStats[iso] = { done, pct: dailyActs.length ? done / dailyActs.length : 0, durSum };
    }

    let html = `<div class="agendaCal" role="grid" aria-label="Calendario de ${monthNamesFull[month]} ${year}">`;
    dayNames.forEach(d => {
      html += `<div class="calDayHeader" role="columnheader">${escapeHTML(d)}</div>`;
    });

    for (let i = 0; i < firstDayOfWeek; i++) {
      html += `<div class="calCell empty" aria-hidden="true"></div>`;
    }

    const todayStr = todayISO();
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const stat = dayStats[iso];
      const pct = stat.pct;
      const isSelected = iso === state.agendaSelectedDay;
      const isToday = iso === todayStr;

      let lv = "";
      if (pct > 0 && pct < 0.25) lv = "lv1";
      else if (pct >= 0.25 && pct < 0.5) lv = "lv2";
      else if (pct >= 0.5 && pct < 0.8) lv = "lv3";
      else if (pct >= 0.8) lv = "lv4";

      const durTxt = stat.durSum ? ` · ${fmtDurationMin(stat.durSum)}` : "";

      html += `
        <div class="calCell ${lv}${isSelected ? " selected" : ""}${isToday ? " isToday" : ""}"
             data-iso="${escapeHTML(iso)}"
             role="gridcell" tabindex="0"
             aria-label="${escapeHTML(fmtDateShort(iso))}: ${Math.round(pct * 100)}%${durTxt}"
             aria-selected="${isSelected}">
          <span class="calDay">${d}</span>
          ${pct > 0 ? `<span class="calPct">${Math.round(pct * 100)}%</span>` : ""}
          ${stat.durSum ? `<span class="calDur">${escapeHTML(fmtDurationMin(stat.durSum))}</span>` : ""}
        </div>
      `;
    }

    html += `</div>`;

    if (els.agendaCalendar) {
      els.agendaCalendar.innerHTML = html;
      $$(".calCell[data-iso]", els.agendaCalendar).forEach(cell => {
        const go = () => {
          state.agendaSelectedDay = cell.dataset.iso;
          state.dateISO = cell.dataset.iso;
          saveState();
          renderAgenda();
        };
        on(cell, "click", go);
        on(cell, "keydown", e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            go();
          }
        });
      });
    }

    renderAgendaDayDetail();
    renderAgendaSchedule();
    renderSidebarDayMeta();
  }

  function renderAgendaDayDetail() {
    if (!els.agendaDayDetail) return;

    const iso = state.agendaSelectedDay || todayISO();
    const pd = activeProfileData();
    const dayLog = pd.logs[iso];
    const doneActs = getDoneActsForDay(iso);
    const pendingActs = db.activities.filter(a => !doneActs.some(d => d.id === a.id));
    const durations = dayLog?.durations || {};
    const totalTime = Object.values(durations).reduce((s, v) => s + ensureStep(v), 0);
    const profLabel = activeProfile() === "alek" ? "Alek" : "Cata";

    let html = `
      <div class="agendaDayHeader">
        <div>
          <h3 style="font-size:15px;font-weight:900;">${escapeHTML(fmtDateLong(iso))}</h3>
          <div class="muted" style="margin-top:3px">${profLabel} · ${doneActs.length} actividades hechas${totalTime ? ` · ${fmtDurationMin(totalTime)} registradas` : ""}</div>
        </div>
        <button class="btn ghost" id="btnGoToDay" type="button" style="white-space:nowrap">Ir a este día</button>
      </div>
    `;

    if (doneActs.length === 0) {
      html += `<div class="emptyState" style="margin-top:12px">Sin actividades registradas para este día.</div>`;
    } else {
      html += `<div class="scheduleList">`;
      const sorted = [...doneActs].sort((a, b) => (durations[b.id] || 0) - (durations[a.id] || 0));
      sorted.forEach(a => {
        const dur = ensureStep(durations[a.id] || 0);
        const durLabel = dur ? fmtDurationMin(dur) : null;
        const barHeight = dur ? Math.min(Math.round((dur / 180) * 60) + 24, 80) : 24;

        html += `
          <div class="scheduleItem">
            <div class="scheduleBar" style="height:${barHeight}px"></div>
            <div class="scheduleInfo">
              <div class="scheduleName">${escapeHTML(a.name)}</div>
              <div class="scheduleMeta">
                <span class="tag">${escapeHTML(a.category)}</span>
                ${durLabel ? `<span class="tag tagTime">⏱ ${escapeHTML(durLabel)}</span>` : `<span class="tag tagNoTime">Sin tiempo registrado</span>`}
              </div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    if (dayLog?.notes?.trim()) {
      html += `
        <div class="divider" aria-hidden="true"></div>
        <div class="agendaNote">
          <div class="muted" style="font-size:12px;margin-bottom:6px">📝 Nota del día</div>
          <div class="hint tiny">${escapeHTML(dayLog.notes)}</div>
        </div>
      `;
    }

    if (pendingActs.length > 0 && doneActs.length > 0) {
      html += `
        <div class="divider" aria-hidden="true"></div>
        <div class="muted" style="font-size:12px;margin-bottom:6px">No hechas ese día (${pendingActs.length})</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${pendingActs.slice(0, 12).map(a => `<span class="tag" style="opacity:.6">${escapeHTML(a.name)}</span>`).join("")}
          ${pendingActs.length > 12 ? `<span class="tag" style="opacity:.5">+${pendingActs.length - 12} más</span>` : ""}
        </div>
      `;
    }

    els.agendaDayDetail.innerHTML = html;

    const goBtn = document.getElementById("btnGoToDay");
    on(goBtn, "click", () => {
      state.dateISO = iso;
      saveState();
      setView("today");
    });
  }

  function renderAgendaSchedule() {
    if (!els.agendaSchedule) return;

    const iso = state.agendaSelectedDay || todayISO();
    const schedule = buildScheduleForDay(iso);

    if (!schedule.length) {
      els.agendaSchedule.innerHTML = `
        <div class="scheduleEmpty">
          Todavía no hay bloques de horario construidos para este día.
          <br><br>
          Marca actividades y súmales tiempo en bloques de ${DURATION_STEP} min desde la vista de Hoy.
        </div>
      `;
      return;
    }

    const total = schedule.reduce((acc, item) => acc + item.duration, 0);

    els.agendaSchedule.innerHTML = `
      <div class="muted" style="font-size:12px;margin-bottom:10px;">
        Horario real del día — basado en la hora en que marcaste cada actividad · Total: ${escapeHTML(fmtDurationMin(total))}
      </div>
      <div class="scheduleTimeline">
        ${schedule.map(item => `
          <div class="scheduleSlot">
            <div class="scheduleTime">${item.startText
              ? escapeHTML(item.startText) + (item.endText ? ` → ${escapeHTML(item.endText)}` : "")
              : `<span style="opacity:.5">sin hora</span>`
            }</div>
            <div class="scheduleBlock">
              <div class="scheduleBlockTitle">${escapeHTML(item.activity.name)}</div>
              <div class="scheduleBlockMeta">
                <span class="tag">${escapeHTML(item.activity.category)}</span>
                ${item.activity.subcategory ? `<span class="tag">${escapeHTML(item.activity.subcategory)}</span>` : ""}
                ${item.duration ? `<span class="tag tagTime">${escapeHTML(fmtDurationMin(item.duration))}</span>` : ""}
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  /* =========================================================
     Week
  ========================================================= */
  function weekInsightText(byDay, byCategory) {
    const avgPct = avg(byDay.map(d => d.pctDaily));
    const bestCat = byCategory[0];
    const worstCat = byCategory[byCategory.length - 1];
    if (!byDay.length) return "Sin datos todavía.";
    if (avgPct >= 0.75) return `Semana fuerte. Sostuvieron bastante bien el ritmo${bestCat ? `, especialmente en ${bestCat.cat}` : ""}.`;
    if (avgPct >= 0.5) return `Semana decente. Hubo movimiento real, aunque todavía hay margen${worstCat ? ` para cuidar mejor lo relacionado con ${worstCat.cat}` : ""}.`;
    return `Semana flojita. No pasa nada, pero sí conviene revisar qué se queda siempre para después${worstCat ? `, sobre todo en ${worstCat.cat}` : ""}.`;
  }

  function renderWeek() {
    const w0 = state.weekStartISO || startOfWeekISO(state.dateISO || todayISO());
    state.weekStartISO = w0;
    saveState();

    const days = Array.from({ length: 7 }, (_, i) => addDays(w0, i));
    const dailyActs = db.activities.filter(a => a.type === "daily");
    const profLabel = activeProfile() === "alek" ? "Alek" : "Cata";

    if (els.weekSub) {
      const d0 = isoToDate(w0);
      const d6 = isoToDate(addDays(w0, 6));
      els.weekSub.textContent = `${d0.toLocaleDateString("es-CO", { month: "short", day: "numeric" })} - ${d6.toLocaleDateString("es-CO", { month: "short", day: "numeric" })} · ${profLabel}`;
    }

    const byDay = days.map(iso => {
      const pd = activeProfileData();
      const dayLog = pd.logs[iso];
      const done = dailyActs.filter(a => !!dayLog?.checksDaily?.[a.id]).length;
      const total = dailyActs.length;
      return { iso, done, total, pct: total ? done / total : 0 };
    });

    if (els.weekGrid) {
      els.weekGrid.innerHTML = byDay.map(d => {
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

      $$(".dayCard", els.weekGrid).forEach(card => {
        const go = () => {
          state.dateISO = card.dataset.iso;
          state.agendaSelectedDay = card.dataset.iso;
          saveState();
          setView("today");
        };
        on(card, "click", go);
        on(card, "keydown", e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            go();
          }
        });
      });
    }

    if (els.weekByDay) {
      els.weekByDay.innerHTML = byDay.map(d => `
        <div class="row">
          <div>${escapeHTML(fmtDateShort(d.iso))}</div>
          <div><b>${Math.round(d.pct * 100)}%</b> <span class="muted">(${d.done}/${d.total})</span></div>
        </div>
      `).join("");
    }

    const cats = unique(dailyActs.map(a => a.category).filter(Boolean)).sort(sortByLocale);
    const byCategory = cats.map(cat => {
      const acts = dailyActs.filter(a => a.category === cat);
      let done = 0;
      let total = acts.length * 7;
      const pd = activeProfileData();
      for (const iso of days) {
        const dayLog = pd.logs[iso];
        for (const a of acts) {
          if (!!dayLog?.checksDaily?.[a.id]) done++;
        }
      }
      return { cat, done, total, pct: total ? done / total : 0 };
    }).sort((a, b) => b.pct - a.pct);

    if (els.weekByCategory) {
      els.weekByCategory.innerHTML = byCategory.length
        ? byCategory.map(c => `<div class="row"><div>${escapeHTML(c.cat)}</div><div><b>${Math.round(c.pct * 100)}%</b> <span class="muted">(${c.done}/${c.total})</span></div></div>`).join("")
        : `<div class="emptyState">No hay categorías diarias para analizar todavía.</div>`;
    }

    if (els.weekInsight) els.weekInsight.textContent = weekInsightText(byDay, byCategory);
  }

  /* =========================================================
     History
  ========================================================= */
  function renderHistorySummary(m) {
    if (!els.historySummary) return;
    els.historySummary.innerHTML = [
      { label: "Promedio diario", value: fmtPct01(m.avgDaily), help: "sobre actividades diarias" },
      { label: "Días activos", value: `${m.activeDays}/${m.rangeDays}`, help: "con al menos una actividad hecha" },
      { label: "Tiempo acumulado", value: fmtDurationMin(m.totalDuration), help: "según tiempo registrado" },
      { label: "Días con nota", value: `${m.noteDays}`, help: "bitácora escrita" },
    ].map(c => `
      <div class="summaryCard">
        <div class="muted">${escapeHTML(c.label)}</div>
        <div class="dashKpiValue">${escapeHTML(c.value)}</div>
        <div class="tiny">${escapeHTML(c.help)}</div>
      </div>
    `).join("");
  }

  function renderHistoryHighlights(m) {
    if (!els.historyHighlights) return;
    const { best, worst, balance } = { best: m.bestDay, worst: m.worstDay, balance: m.balance };
    els.historyHighlights.innerHTML = [
      { cls: "good", title: "Mejor día", text: best ? `${fmtDateShort(best.iso)} · ${fmtPct01(best.pctDaily)} (${best.doneDaily}/${best.totalDaily})` : "—" },
      { cls: "bad", title: "Día más flojo", text: worst ? `${fmtDateShort(worst.iso)} · ${fmtPct01(worst.pctDaily)}` : "—" },
      { cls: "warn", title: "Días vacíos", text: `${m.emptyDays} de ${m.rangeDays}` },
      { cls: "good", title: "Balance general", text: balance.restRatio >= 0.58 ? "Más descanso/cuidado" : balance.restRatio >= 0.45 ? "Equilibrio medio" : "Más carga que descanso" },
    ].map(x => `
      <div class="highlightItem ${escapeHTML(x.cls)}">
        <div class="muted">${escapeHTML(x.title)}</div>
        <div><strong>${escapeHTML(x.text)}</strong></div>
      </div>
    `).join("");
  }

  function renderHistoryTimeline(m) {
    if (!els.historyTimeline) return;
    const interesting = [...m.byDay]
      .filter(d => d.doneAll > 0 || (d.notes || "").trim())
      .sort((a, b) => b.iso.localeCompare(a.iso))
      .slice(0, 18);

    if (!interesting.length) {
      els.historyTimeline.innerHTML = `<div class="emptyState">Todavía no hay suficiente rastro. Cuando empiecen a usar esto, aquí aparecerá la historia.</div>`;
      return;
    }

    els.historyTimeline.innerHTML = interesting.map(d => `
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
    els.historyTopActivities.innerHTML = top.map(a => `
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

    const heatRows = weeks.map(week => `
      <div class="heatmapRow">
        ${week.map(d => {
          const pct = d.pctDaily;
          let lv = "";
          if (pct > 0 && pct < 0.25) lv = "lv1";
          else if (pct >= 0.25 && pct < 0.5) lv = "lv2";
          else if (pct >= 0.5 && pct < 0.8) lv = "lv3";
          else if (pct >= 0.8) lv = "lv4";
          return `<div class="heatCell ${lv}" title="${escapeHTML(fmtDateLong(d.iso))}: ${Math.round(pct * 100)}%">${escapeHTML(String(isoToDate(d.iso).getDate()))}</div>`;
        }).join("")}
      </div>
    `).join("");

    els.historyCalendar.innerHTML = `
      <div class="tiny" style="margin-bottom:8px;">Más oscuro = mejor cumplimiento diario.</div>
      <div class="heatmap">${heatRows}</div>
    `;
  }

  function renderHistoryTrend(m) {
    drawLineChart(els.chartHistoryTrend, m.byDay.map(d => Math.round(d.pctDaily * 100)));
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

    if (m.avgDaily >= 0.75) p.push("El periodo se ve fuerte. Hay una constancia bastante real, no solo chispazos de motivación.");
    else if (m.avgDaily >= 0.5) p.push("El periodo se ve intermedio. Sí hay movimiento, pero todavía no con la estabilidad que haría que esto se sienta sostenido.");
    else p.push("El periodo se ve flojo. No como juicio, sino como dato: varias cosas importantes se están quedando por fuera.");

    if (m.streakBest >= 5) p.push(`La mejor racha fue de ${m.streakBest} días consistentes.`);
    else p.push("No hay rachas largas todavía. Eso suele indicar que la estructura actual todavía no está ayudando tanto como podría.");

    if (topCat) p.push(`La categoría con más presencia fue ${topCat}.`);
    if (weakCat && weakCat !== topCat) p.push(`La categoría más descuidada fue ${weakCat}, así que por ahí hay una alerta útil.`);

    if (m.balance.restRatio < 0.45) p.push("También hay una tendencia a que la carga pese más que el descanso. Qué pasión tan humana por complicarse la vida.");
    else if (m.balance.restRatio > 0.58) p.push("Se ve una presencia interesante de cuidado, descanso o actividades de sostén. Eso sostiene todo lo demás.");

    return p.join(" ");
  }

  function renderStats() {
    const range = clamp(Number(els.statsRange?.value || 30), 7, 365);
    const m = computeMetrics({ rangeDays: range });

    if (els.statsConsistency) {
      els.statsConsistency.innerHTML = [
        { muted: "Promedio diario", val: fmtPct01(m.avgDaily), tiny: "sobre actividades diarias" },
        { muted: "Racha actual", val: String(m.streakCurrent), tiny: "días ≥ 60%" },
        { muted: "Mejor racha", val: String(m.streakBest), tiny: "máxima consistencia" },
        { muted: "Días activos", val: `${m.activeDays}/${m.rangeDays}`, tiny: "con al menos una actividad" },
      ].map(c => `
        <div class="statCard">
          <div class="muted">${escapeHTML(c.muted)}</div>
          <div class="dashKpiValue">${escapeHTML(c.val)}</div>
          <div class="tiny">${escapeHTML(c.tiny)}</div>
        </div>
      `).join("");
    }

    drawBarsChart(els.chartDone, m.byDay.map(d => Math.round(d.pctDaily * 100)));

    if (els.statsByCategory) {
      els.statsByCategory.innerHTML = m.byCategory.length
        ? m.byCategory.map(c => `<div class="row"><div>${escapeHTML(c.cat)}</div><div><b>${Math.round(c.pct * 100)}%</b> <span class="muted">(${c.done}/${c.total})</span></div></div>`).join("")
        : `<div class="emptyState">Sin categorías todavía.</div>`;
    }

    drawBarsChart(els.chartBalance, [Math.round(m.balance.carga), Math.round(m.balance.descanso)], ["Carga", "Descanso"]);
    if (els.chartBalanceHint) {
      els.chartBalanceHint.textContent = m.balance.restRatio >= 0.58 ? "Predomina descanso/cuidado" : m.balance.restRatio >= 0.45 ? "Balance medio" : "Predomina carga";
    }

    drawBarsChart(els.chartEnergy, [m.energy.low, m.energy.mid, m.energy.high, m.energy.none], ["Baja", "Media", "Alta", "Sin"]);
    if (els.chartEnergyHint) {
      els.chartEnergyHint.textContent = `Marcadas: ${m.energy.low + m.energy.mid + m.energy.high} · Sin marcar: ${m.energy.none}`;
    }

    if (els.statsAvoided) {
      const avoided = m.avoidedActivities.slice(0, 8);
      els.statsAvoided.innerHTML = avoided.length
        ? avoided.map(a => `<div class="row"><div>${escapeHTML(a.name)} <span class="muted">(${escapeHTML(a.cat)})</span></div><div><b>${Math.round(a.pct * 100)}%</b> <span class="muted">(${a.done}/${a.total})</span></div></div>`).join("")
        : `<div class="emptyState">Todavía no hay suficientes datos.</div>`;
    }

    if (els.statsTopActivities) {
      const top = m.topActivities.slice(0, 8);
      els.statsTopActivities.innerHTML = top.length
        ? top.map(a => `<div class="row"><div>${escapeHTML(a.name)} <span class="muted">(${escapeHTML(a.cat)})</span></div><div><b>${Math.round(a.pct * 100)}%</b> <span class="muted">(${a.done}/${a.total})</span></div></div>`).join("")
        : `<div class="emptyState">Sin actividades todavía.</div>`;
    }

    if (els.statsNarrative) {
      els.statsNarrative.innerHTML = `<div class="narrativeBox">${escapeHTML(narrativeFromMetrics(m))}</div>`;
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
    const energyRaw = els.mEnergy?.value || "__none__";
    const energy = ["low", "mid", "high"].includes(energyRaw) ? energyRaw : undefined;

    if (!name || !category) {
      toast("Pongan nombre y categoría. El caos no se clasifica solo.", "warn");
      return;
    }

    if (state.editId) {
      const a = aById(state.editId);
      if (!a) return;
      a.name = name;
      a.category = category;
      a.type = type;
      a.subcategory = subcategory;
      a.energy = energy;
    } else {
      db.activities.push(normalizeActivity({ id: uid(), name, category, type, subcategory, energy }));
    }

    saveDB();
    rebuildCategoryFilter();
    closeForm();
    renderCurrentView();
    toast("Actividad guardada ✅", "ok");
  }

  function deleteActivity(id) {
    const a = aById(id);
    if (!a) return;

    modalOpen({
      title: "Eliminar actividad",
      desc: `¿Borrar "${a.name}"? También se eliminarán sus rastros guardados en los perfiles.`,
      actions: [
        { label: "Cancelar", kind: "ghost", onClick: modalClose },
        {
          label: "Eliminar",
          kind: "danger",
          onClick: () => {
            db.activities = db.activities.filter(x => x.id !== id);

            PROFILES.forEach(p => {
              const prof = db.profiles[p];
              if (!prof) return;

              Object.keys(prof.logs || {}).forEach(iso => {
                if (prof.logs[iso]?.checksDaily?.[id]) delete prof.logs[iso].checksDaily[id];
                if (prof.logs[iso]?.durations?.[id]) delete prof.logs[iso].durations[id];
                if (Array.isArray(prof.logs[iso]?.entries)) {
                  prof.logs[iso].entries = prof.logs[iso].entries.filter(x => x.activityId !== id);
                }
              });

              if (prof.cycle?.done?.[id]) delete prof.cycle.done[id];
              if (prof.cycle?.doneAt?.[id]) delete prof.cycle.doneAt[id];
            });

            saveDB();
            modalClose();
            renderCurrentView();
            toast("Actividad eliminada 🗑️", "ok");
          },
        },
      ],
    });
  }

  function renderManage() {
    const list = getFilteredActivities({ forManage: true });

    if (els.manageList) {
      els.manageList.innerHTML = list.length ? list.map(a => `
        <div class="manageItem">
          <div>
            <div class="manageName">${escapeHTML(a.name)}</div>
            <div class="manageMeta">
              ${escapeHTML(a.category)}
              ${a.subcategory ? ` · ${escapeHTML(a.subcategory)}` : ""}
              · ${a.type === "daily" ? "Diaria" : "Rotación semanal"}
              ${a.energy ? ` · ${escapeHTML(energyLabel(a.energy))}` : ""}
            </div>
          </div>
          <div class="smallBtns">
            <button class="small" type="button" data-action="edit" data-id="${escapeHTML(a.id)}">Editar</button>
            <button class="small danger" type="button" data-action="delete" data-id="${escapeHTML(a.id)}">Borrar</button>
          </div>
        </div>
      `).join("") : `<div class="emptyState">No hay actividades para mostrar.</div>`;

      $$("[data-action='edit']", els.manageList).forEach(btn => on(btn, "click", () => openEdit(btn.dataset.id)));
      $$("[data-action='delete']", els.manageList).forEach(btn => on(btn, "click", () => deleteActivity(btn.dataset.id)));
    }
  }

  /* =========================================================
     Settings / export / import
  ========================================================= */
  function exportJSON() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bitacora-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Backup JSON exportado 📦", "ok");
  }

  function exportCSV() {
    const rows = [["perfil", "fecha", "actividad", "categoria", "subcategoria", "tipo", "energia", "hecha", "duracion_min", "sesiones", "nota_dia"]];
    PROFILES.forEach(profile => {
      const prof = db.profiles[profile];
      const allDates = Object.keys(prof.logs || {}).sort();
      allDates.forEach(iso => {
        const log = prof.logs[iso] || {};
        db.activities.forEach(a => {
          const done = a.type === "daily" ? !!log.checksDaily?.[a.id] : !!prof.cycle?.done?.[a.id];
          const dur = ensureStep(log.durations?.[a.id] || 0);
          const sessions = (Array.isArray(log.entries) ? log.entries : []).filter(x => x.activityId === a.id).length;
          if (!done && !dur && !(log.notes || "").trim()) return;
          rows.push([
            profile,
            iso,
            a.name,
            a.category,
            a.subcategory || "",
            a.type,
            a.energy || "",
            done ? "1" : "0",
            dur || "",
            sessions || "",
            log.notes || "",
          ]);
        });
      });
    });

    const csv = rows.map(r => r.map(csvEscape).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bitacora-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("CSV exportado 📊", "ok");
  }

  function importJSONFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        db = migrateDB(parsed);
        saveDB();

        state.dateISO = todayISO();
        state.weekStartISO = startOfWeekISO(state.dateISO);
        state.agendaSelectedDay = state.dateISO;
        state.agendaYear = isoToDate(state.dateISO).getFullYear();
        state.agendaMonth = isoToDate(state.dateISO).getMonth();
        saveState();

        renderCurrentView();
        toast("Backup importado ✅", "ok");
      } catch {
        toast("No se pudo importar ese JSON.", "err");
      }
    };
    reader.readAsText(file);
  }

  function wipeAll() {
    modalOpen({
      title: "Borrar datos locales",
      desc: "Esto borra la base local de esta bitácora en este navegador. No hay drama reversible después.",
      actions: [
        { label: "Cancelar", kind: "ghost", onClick: modalClose },
        {
          label: "Borrar todo",
          kind: "danger",
          onClick: () => {
            db = seedDB();
            state = loadState();
            saveDB();
            saveState();
            if (window.BitacoraCloud?.ready) window.BitacoraCloud.wipe().catch(() => {});
            modalClose();
            initAfterDataReset();
            toast("Datos borrados local y en la nube 🧼", "ok");
          },
        },
      ],
    });
  }

  function renderSettings() {
    if (els.appInfo) {
      els.appInfo.textContent = `Firebase + localStorage · esquema v${DB_SCHEMA} · bloques de ${DURATION_STEP} min · ${window.BitacoraCloud?.ready ? "☁️ nube activa" : "📴 offline"}`;
    }
  }

  /* =========================================================
     Charts
  ========================================================= */
  function clearCanvas(canvas) {
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || canvas.width || 800));
    const height = Math.max(180, Math.floor(rect.height || canvas.height || 280));
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }

  function drawLineChart(canvas, values = []) {
    if (!canvas) return;
    const setup = clearCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;

    const pad = 24;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;

    ctx.strokeStyle = "rgba(34,48,74,.9)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(width - pad, y);
      ctx.stroke();
    }

    if (!values.length) return;
    const max = Math.max(100, ...values);
    const stepX = values.length > 1 ? innerW / (values.length - 1) : innerW;

    ctx.strokeStyle = "rgba(124,58,237,.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();

    values.forEach((v, i) => {
      const x = pad + stepX * i;
      const y = pad + innerH - (safeNumber(v) / max) * innerH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "rgba(34,197,94,.9)";
    values.forEach((v, i) => {
      const x = pad + stepX * i;
      const y = pad + innerH - (safeNumber(v) / max) * innerH;
      ctx.beginPath();
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawBarsChart(canvas, values = [], labels = []) {
    if (!canvas) return;
    const setup = clearCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;

    const pad = 24;
    const baseY = height - 34;
    const innerW = width - pad * 2;
    const max = Math.max(1, ...values.map(v => safeNumber(v, 0)));
    const gap = 12;
    const barW = values.length ? Math.max(18, (innerW - gap * (values.length - 1)) / values.length) : 24;

    ctx.strokeStyle = "rgba(34,48,74,.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, baseY);
    ctx.lineTo(width - pad, baseY);
    ctx.stroke();

    values.forEach((v, i) => {
      const n = safeNumber(v, 0);
      const h = Math.max(2, (n / max) * (height - 80));
      const x = pad + i * (barW + gap);
      const y = baseY - h;

      ctx.fillStyle = i % 2 === 0 ? "rgba(124,58,237,.85)" : "rgba(34,197,94,.82)";
      ctx.fillRect(x, y, barW, h);

      ctx.fillStyle = "rgba(229,231,235,.78)";
      ctx.font = "11px system-ui";
      ctx.textAlign = "center";
      if (labels[i]) ctx.fillText(labels[i], x + barW / 2, baseY + 14);
      ctx.fillText(String(Math.round(n)), x + barW / 2, y - 6);
    });
  }

  /* =========================================================
     Global render helpers
  ========================================================= */
  function renderCurrentView() {
    updateProfileToggleUI();
    renderSidebarDayMeta();

    if (state.view === "today") renderToday();
    else if (state.view === "agenda") renderAgenda();
    else if (state.view === "week") renderWeek();
    else if (state.view === "history") renderHistory();
    else if (state.view === "stats") renderStats();
    else if (state.view === "manage") renderManage();
    else if (state.view === "settings") renderSettings();
    else renderToday();
  }

  function initAfterDataReset() {
    updateProfileToggleUI();
    updateTabsUI(state.view);
    rebuildCategoryFilter();
    renderCurrentView();
  }

  /* =========================================================
     Event bindings
  ========================================================= */
  function bindEvents() {
    Object.entries(TAB_MAP).forEach(([key, obj]) => {
      on(obj.btn, "click", () => setView(key));
    });

    bindTabsKeyboard();

    on(els.btnProfileAlek, "click", () => setProfile("alek"));
    on(els.btnProfileCata, "click", () => setProfile("cata"));

    on(els.prevDay, "click", () => {
      state.dateISO = addDays(state.dateISO, -1);
      state.agendaSelectedDay = state.dateISO;
      saveState();
      renderCurrentView();
    });

    on(els.nextDay, "click", () => {
      state.dateISO = addDays(state.dateISO, 1);
      state.agendaSelectedDay = state.dateISO;
      saveState();
      renderCurrentView();
    });

    on(els.search, "input", () => renderToday());
    on(els.categoryFilter, "change", () => renderToday());
    on(els.modeFilter, "change", () => renderToday());
    on(els.energyFilter, "change", () => renderToday());

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
    });

    on(els.btnCollapseDone, "click", () => {
      if (state.showDone === false) {
        state.showDone = true;
        state.collapseDone = false;
      } else {
        state.collapseDone = !state.collapseDone;
      }
      saveState();
      renderToday();
    });

    on(els.btnCheckAll, "click", () => bulkToggle("check"));
    on(els.btnUncheckAll, "click", () => bulkToggle("uncheck"));

    on(els.prevMonth, "click", () => {
      const d = new Date(state.agendaYear, state.agendaMonth - 1, 1);
      state.agendaYear = d.getFullYear();
      state.agendaMonth = d.getMonth();
      const first = `${state.agendaYear}-${String(state.agendaMonth + 1).padStart(2, "0")}-01`;
      state.agendaSelectedDay = first;
      state.dateISO = first;
      saveState();
      renderAgenda();
    });

    on(els.nextMonth, "click", () => {
      const d = new Date(state.agendaYear, state.agendaMonth + 1, 1);
      state.agendaYear = d.getFullYear();
      state.agendaMonth = d.getMonth();
      const first = `${state.agendaYear}-${String(state.agendaMonth + 1).padStart(2, "0")}-01`;
      state.agendaSelectedDay = first;
      state.dateISO = first;
      saveState();
      renderAgenda();
    });

    on(els.prevWeek, "click", () => {
      state.weekStartISO = addDays(state.weekStartISO, -7);
      saveState();
      renderWeek();
    });

    on(els.nextWeek, "click", () => {
      state.weekStartISO = addDays(state.weekStartISO, 7);
      saveState();
      renderWeek();
    });

    on(els.historyRange, "change", renderHistory);
    on(els.statsRange, "change", renderStats);

    on(els.btnAdd, "click", openAdd);
    on(els.btnCancelEdit, "click", closeForm);
    on(els.btnSaveActivity, "click", saveActivityFromForm);
    on(els.manageSearch, "input", renderManage);
    on(els.manageFilterType, "change", renderManage);

    on(els.btnExport2, "click", exportJSON);
    on(els.btnExportCSV2, "click", exportCSV);
    on(els.btnWipeAll, "click", wipeAll);

    on(els.importFile2, "change", e => {
      const file = e.target.files?.[0];
      if (!file) return;
      importJSONFile(file);
      e.target.value = "";
    });

    on(window, "resize", () => {
      if (state.view === "history") renderHistory();
      if (state.view === "stats") renderStats();
    });
  }

  /* =========================================================
     Init
  ========================================================= */
  function init() {
    state.dateISO = todayISO();
    state.weekStartISO = startOfWeekISO(state.dateISO);
    state.agendaSelectedDay = state.dateISO;
    state.agendaYear = isoToDate(state.dateISO).getFullYear();
    state.agendaMonth = isoToDate(state.dateISO).getMonth();
    saveState();

    updateProfileToggleUI();
    updateTabsUI(state.view);
    rebuildCategoryFilter();
    bindEvents();
    renderCurrentView();
    syncFromCloud(); // no bloquea, carga desde Firebase en background
  }

  init();
})();

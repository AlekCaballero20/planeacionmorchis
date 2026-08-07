/* app.js
   Bitácora - Alek & Cata
   ------------------------------------------------------------
   ✅ Firebase-first: Firebase es la única fuente de datos
   ✅ Sin respaldo persistente en el navegador
   ✅ Sin plantilla inicial automática: si Firebase está vacío, inicia vacío
   ✅ Importar JSON guarda directamente en Firebase
   ✅ Perfiles separados: Alek / Cata
   ✅ Día, agenda, semana, histórico, estadísticas y actividades
*/

(() => {
  "use strict";

  const { config, dom, elements, utils, charts } = window.BitacoraModules || {};
  if (!config || !dom || !elements || !utils || !charts) {
    throw new Error("BitacoraModules no esta cargado. Revisa el orden de scripts en index.html.");
  }

  const {
    DB_SCHEMA,
    PROFILES,
    DURATION_STEP,
    MAX_ENTRY_MINUTES,
    RUNTIME_ID,
    DEFAULT_ACTIVITIES,
    ROUTINE_PROMPTS,
    dayNames,
    monthNamesShort,
    monthNamesFull,
  } = config;

  const { $, $$, on } = dom;
  const els = elements.createElements($);
  const { drawLineChart, drawBarsChart } = charts;
  const {
    uid,
    nowISODate,
    safeNumber,
    todayISO,
    isoToDate,
    addDays,
    startOfWeekISO,
    fmtDateLong,
    fmtDateShort,
    escapeHTML,
    csvEscape,
    sortByLocale,
    unique,
    sum,
    avg,
    fmtPct01,
    ensureStep,
    fmtDurationMin,
    nowHHMM,
    parseDoneTime,
    clockToMinutes,
    toClock,
    energyLabel,
  } = utils;
  let db = null;
  let state = createDefaultState();
  let saveQueue = Promise.resolve();
  let toastTimer = null;
  let notesTimer = null;

  function createDefaultState() {
    const today = todayISO();
    const d = isoToDate(today);
    return {
      view: "today",
      dateISO: today,
      weekStartISO: startOfWeekISO(today),
      editId: null,
      showDone: true,
      collapseDone: false,
      pendingFirst: true,
      profile: "alek",
      agendaYear: d.getFullYear(),
      agendaMonth: d.getMonth(),
      agendaSelectedDay: today,
      timeFollowUp: null,
      smartPlannerMode: "balanced",
      smartPlannerPlan: null,
      smartPlannerKey: "",
    };
  }

  function applyTheme() {
    document.documentElement.dataset.theme = "light";
  }

  function hideBoot() {
    if (window.BitacoraUI?.hideBoot) window.BitacoraUI.hideBoot();
    else els.appBoot?.classList.add("hidden");
  }

  function setCloudStatus(status, detail = "") {
    if (!els.cloudStatus) return;

    els.cloudStatus.classList.remove("isOk", "isError", "isLoading");

    if (status === "loading") {
      els.cloudStatus.textContent = "Conectando…";
      els.cloudStatus.classList.add("isLoading");
    } else if (status === "ready") {
      els.cloudStatus.textContent = "Firebase conectado";
      els.cloudStatus.classList.add("isOk");
    } else if (status === "empty") {
      els.cloudStatus.textContent = "Firebase vacío";
      els.cloudStatus.classList.add("isLoading");
    } else if (status === "saving") {
      els.cloudStatus.textContent = "Guardando…";
      els.cloudStatus.classList.add("isLoading");
    } else if (status === "saved") {
      els.cloudStatus.textContent = "Guardado en Firebase";
      els.cloudStatus.classList.add("isOk");
    } else if (status === "error") {
      els.cloudStatus.textContent = "Error Firebase";
      els.cloudStatus.classList.add("isError");
    } else {
      els.cloudStatus.textContent = String(status || "Estado desconocido");
      els.cloudStatus.classList.add("isLoading");
    }

    if (els.cloudStatusHint) {
      els.cloudStatusHint.textContent = detail || "La información debe venir de Firebase. Si está vacío, importa un JSON o crea actividades manualmente.";
    }

    if (els.footerStorageStatus) els.footerStorageStatus.textContent = "Firebase";
  }

  function assertCloudReady() {
    return !!(window.BitacoraCloud && window.BitacoraCloud.ready && typeof window.BitacoraCloud.load === "function" && typeof window.BitacoraCloud.save === "function");
  }

  function toast(msg, type = "info") {
    if (!els.toastRegion) return;
    clearTimeout(toastTimer);
    const cls = type === "ok" ? "toastOk" : type === "warn" ? "toastWarn" : type === "err" ? "toastErr" : "";
    const title = type === "ok" ? "Listo" : type === "warn" ? "Ojo" : type === "err" ? "Ups" : "Aviso";
    els.toastRegion.innerHTML = `
      <div class="toast ${cls}" role="status">
        <div>
          <div class="toastTitle">${escapeHTML(title)}</div>
          <div class="toastMsg">${escapeHTML(msg)}</div>
        </div>
      </div>
    `;
    toastTimer = setTimeout(() => {
      if (els.toastRegion) els.toastRegion.innerHTML = "";
    }, 2800);
  }

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

      $$('[data-modal-action]', els.modalActions).forEach(btn => {
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
    if (e.key === "Escape" && els.modalOverlay && !els.modalOverlay.classList.contains("hidden")) modalClose();
  });

  function emptyProfile() {
    const week = startOfWeekISO(todayISO());
    return {
      logs: {},
      weeklyCycles: {},
      cycle: { weekStartISO: week, done: {}, doneAt: {}, updatedAt: null },
    };
  }

  function emptyDB() {
    const now = nowISODate();
    return {
      schemaVersion: DB_SCHEMA,
      activities: DEFAULT_ACTIVITIES.map(activity => ({ ...activity })),
      meta: {
        createdAt: now,
        updatedAt: now,
        revision: 0,
        deviceId: RUNTIME_ID,
        lastCloudSyncAt: null,
        defaultsSyncedAt: null,
        needsDefaultActivitySync: true,
      },
      profiles: {
        alek: emptyProfile(),
        cata: emptyProfile(),
      },
      /* Plan compartido: los bloques de a dos viven una sola vez, fuera de los
         perfiles, y se muestran en ambos. Una sola fuente de verdad. */
      sharedPlan: {},
    };
  }

  function normalizeActivity(a) {
    const energy = ["low", "mid", "high"].includes(a?.energy) ? a.energy : undefined;
    const status = a?.status === "archived" ? "archived" : "active";
    return {
      id: String(a?.id || uid()),
      name: String(a?.name || "").trim() || "Sin nombre",
      category: String(a?.category || "").trim() || "General",
      subcategory: String(a?.subcategory || "").trim(),
      type: a?.type === "daily" ? "daily" : "complement",
      energy,
      status,
      archivedAt: status === "archived" ? (a?.archivedAt || nowISODate()) : null,
    };
  }

  function mergeDefaultActivities(raw) {
    if (!Array.isArray(raw.activities)) raw.activities = [];
    let changed = false;
    const byId = new Set(raw.activities.filter(Boolean).map(a => String(a.id || "")));
    const byName = new Set(raw.activities.filter(Boolean).map(a => String(a.name || "").trim().toLowerCase()));

    DEFAULT_ACTIVITIES.forEach(activity => {
      if (byId.has(activity.id)) return;
      if (byName.has(activity.name.toLowerCase())) return;
      raw.activities.push({ ...activity });
      changed = true;
    });
    return changed;
  }

  function normalizeCycle(cycle, fallbackWeek = startOfWeekISO(todayISO())) {
    const week = cycle?.weekStartISO || fallbackWeek;
    return {
      weekStartISO: week,
      done: cycle?.done && typeof cycle.done === "object" ? cycle.done : {},
      doneAt: cycle?.doneAt && typeof cycle.doneAt === "object" ? cycle.doneAt : {},
      updatedAt: cycle?.updatedAt || null,
    };
  }

  function ensureMeta(raw) {
    const now = nowISODate();
    if (!raw.meta || typeof raw.meta !== "object") raw.meta = {};
    raw.meta.createdAt = raw.meta.createdAt || now;
    raw.meta.updatedAt = raw.meta.updatedAt || raw.meta.createdAt || now;
    raw.meta.revision = safeNumber(raw.meta.revision, 0);
    raw.meta.deviceId = raw.meta.deviceId || RUNTIME_ID;
    raw.meta.lastCloudSyncAt = raw.meta.lastCloudSyncAt || null;
    return raw.meta;
  }

  /* Un bloque planeado puede ir con hora ("06:30") o suelto en el día (start null).
     Sin hora es intención: qué se quiere hacer ese día, sin comprometer el reloj. */
  function normalizePlannedBlock(x) {
    if (!x || typeof x !== "object" || !x.activityId) return null;

    const start = parseDoneTime(x.start);
    const startMin = start ? clockToMinutes(start) : null;
    let minutes = ensureStep(x.minutes);

    if (!minutes && start) {
      const endMin = clockToMinutes(parseDoneTime(x.end));
      if (endMin != null && startMin != null && endMin > startMin) minutes = ensureStep(endMin - startMin);
    }

    minutes = Math.min(Math.max(0, minutes), MAX_ENTRY_MINUTES);
    const end = start && minutes > 0 ? toClock(startMin + minutes) : null;

    return {
      id: String(x.id || uid()),
      activityId: String(x.activityId),
      start,
      end,
      minutes,
      note: String(x.note || ""),
      reason: String(x.reason || ""),
      status: ["planned", "done", "skipped"].includes(x.status) ? x.status : "planned",
      shared: x.shared === true,
      createdBy: PROFILES.includes(x.createdBy) ? x.createdBy : "",
      createdAt: x.createdAt || nowISODate(),
    };
  }

  /* Orden del plan: primero lo que tiene hora, en orden de reloj; después lo suelto. */
  function sortPlannedBlocks(blocks) {
    return blocks.slice().sort((a, b) => {
      if (a.start && b.start) return a.start.localeCompare(b.start);
      if (a.start) return -1;
      if (b.start) return 1;
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
  }

  function migrateProfileLogs(logs) {
    if (!logs || typeof logs !== "object") return {};
    Object.keys(logs).forEach(iso => {
      const day = logs[iso];
      if (!day || typeof day !== "object") {
        logs[iso] = { checksDaily: {}, notes: "", durations: {}, entries: [], plannedEntries: [] };
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
      if (!Array.isArray(day.plannedEntries)) day.plannedEntries = [];

      Object.keys(day.durations).forEach(id => {
        day.durations[id] = ensureStep(day.durations[id]);
        if (!day.durations[id]) delete day.durations[id];
      });

      day.entries = day.entries
        .filter(x => x && typeof x === "object" && x.activityId)
        .map(x => ({
          id: String(x.id || uid()),
          activityId: String(x.activityId),
          minutes: ensureStep(x.minutes),
          time: parseDoneTime(x.time),
          endTime: parseDoneTime(x.endTime) || null,
          createdAt: safeNumber(x.createdAt, Date.now()),
        }))
        .filter(x => x.minutes > 0);

      day.plannedEntries = day.plannedEntries
        .filter(x => x && typeof x === "object" && x.activityId)
        .map(normalizePlannedBlock)
        .filter(Boolean);
    });
    return logs;
  }

  function migrateDB(raw) {
    if (!raw || typeof raw !== "object") return emptyDB();

    if (!raw.profiles) {
      raw.profiles = {
        alek: { logs: raw.logs || {}, cycle: raw.cycle || null },
        cata: emptyProfile(),
      };
      delete raw.logs;
      delete raw.cycle;
    }

    PROFILES.forEach(profile => {
      if (!raw.profiles[profile] || typeof raw.profiles[profile] !== "object") raw.profiles[profile] = emptyProfile();
      const prof = raw.profiles[profile];
      if (!prof.logs || typeof prof.logs !== "object") prof.logs = {};
      if (!prof.weeklyCycles || typeof prof.weeklyCycles !== "object") prof.weeklyCycles = {};

      if (prof.cycle && typeof prof.cycle === "object") {
        const migratedCycle = normalizeCycle(prof.cycle);
        if (!prof.weeklyCycles[migratedCycle.weekStartISO]) prof.weeklyCycles[migratedCycle.weekStartISO] = migratedCycle;
      }

      Object.keys(prof.weeklyCycles).forEach(week => {
        prof.weeklyCycles[week] = normalizeCycle(prof.weeklyCycles[week], week);
      });

      prof.cycle = normalizeCycle(prof.weeklyCycles[startOfWeekISO(todayISO())] || prof.cycle);
      prof.logs = migrateProfileLogs(prof.logs);
    });

    if (!raw.sharedPlan || typeof raw.sharedPlan !== "object") raw.sharedPlan = {};
    Object.keys(raw.sharedPlan).forEach(iso => {
      const list = Array.isArray(raw.sharedPlan[iso]) ? raw.sharedPlan[iso] : [];
      const clean = list.map(x => normalizePlannedBlock({ ...x, shared: true })).filter(Boolean);
      if (clean.length) raw.sharedPlan[iso] = clean;
      else delete raw.sharedPlan[iso];
    });

    const addedDefaults = mergeDefaultActivities(raw);
    if (!Array.isArray(raw.activities)) raw.activities = [];
    raw.activities = raw.activities.filter(Boolean).map(normalizeActivity);
    raw.schemaVersion = DB_SCHEMA;
    ensureMeta(raw);
    raw.meta.defaultsSyncedAt = addedDefaults ? nowISODate() : (raw.meta.defaultsSyncedAt || null);
    raw.meta.needsDefaultActivitySync = !!addedDefaults;
    return raw;
  }

  function touchMeta({ synced = false } = {}) {
    ensureMeta(db);
    db.meta.updatedAt = nowISODate();
    db.meta.revision = safeNumber(db.meta.revision, 0) + 1;
    db.meta.deviceId = RUNTIME_ID;
    if (synced) db.meta.lastCloudSyncAt = nowISODate();
  }

  async function loadDBFromCloud() {
    setCloudStatus("loading");
    if (!assertCloudReady()) throw new Error("BitacoraCloud no está listo. Revisa firebase.js y el orden de scripts.");
    const cloudData = await window.BitacoraCloud.load();
    if (!cloudData) {
      setCloudStatus("empty", "Firebase no tiene datos todavía. Importa un JSON o crea actividades manualmente.");
      return emptyDB();
    }
    const migrated = migrateDB(cloudData);
    setCloudStatus("ready");
    return migrated;
  }

  function saveDB() {
    if (!db) return Promise.resolve(false);
    touchMeta();
    setCloudStatus("saving");

    saveQueue = saveQueue
      .then(async () => {
        if (!assertCloudReady()) throw new Error("Firebase no está listo para guardar.");
        await window.BitacoraCloud.save(db);
        db.meta.lastCloudSyncAt = nowISODate();
        setCloudStatus("saved");
        return true;
      })
      .catch(error => {
        console.warn("[Bitácora] saveDB error:", error);
        setCloudStatus("error", "No se pudo guardar en Firebase. Revisa reglas, conexión o consola.");
        toast("No se pudo guardar en Firebase.", "err");
        return false;
      });

    return saveQueue;
  }

  function activeProfile() {
    return PROFILES.includes(state.profile) ? state.profile : "alek";
  }

  function activeProfileData() {
    const p = activeProfile();
    if (!db.profiles[p]) db.profiles[p] = emptyProfile();
    return db.profiles[p];
  }

  function ensureDay(iso) {
    const pd = activeProfileData();
    if (!pd.logs[iso]) pd.logs[iso] = { checksDaily: {}, notes: "", durations: {}, entries: [], plannedEntries: [] };
    const day = pd.logs[iso];
    if (!day.checksDaily || typeof day.checksDaily !== "object") day.checksDaily = {};
    if (typeof day.notes !== "string") day.notes = String(day.notes || "");
    if (!day.durations || typeof day.durations !== "object") day.durations = {};
    if (!Array.isArray(day.entries)) day.entries = [];
    if (!Array.isArray(day.plannedEntries)) day.plannedEntries = [];
    return day;
  }

  function ensureCycleFor(refISO) {
    const pd = activeProfileData();
    const week = startOfWeekISO(refISO || todayISO());
    if (!pd.weeklyCycles || typeof pd.weeklyCycles !== "object") pd.weeklyCycles = {};
    if (!pd.weeklyCycles[week]) pd.weeklyCycles[week] = { weekStartISO: week, done: {}, doneAt: {}, updatedAt: null };
    pd.weeklyCycles[week] = normalizeCycle(pd.weeklyCycles[week], week);
    if (week === startOfWeekISO(todayISO())) pd.cycle = pd.weeklyCycles[week];
    return pd.weeklyCycles[week];
  }

  function getCycleFor(refISO) {
    const pd = activeProfileData();
    const week = startOfWeekISO(refISO || todayISO());
    const cycle = pd.weeklyCycles?.[week];
    return cycle ? normalizeCycle(cycle, week) : null;
  }

  function aById(id) {
    return db.activities.find(a => a.id === id);
  }

  function isActivityActive(activity) {
    return activity?.status !== "archived";
  }

  function activeActivities() {
    return db.activities.filter(isActivityActive);
  }

  function allCategories() {
    return unique(activeActivities().map(a => a.category).filter(Boolean)).sort(sortByLocale);
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
    if (activity.type === "daily") return !!pd.logs[iso]?.checksDaily?.[activity.id];
    return !!getCycleFor(iso)?.done?.[activity.id];
  }

  function setDoneFor(iso, activity, done, timeHHMM) {
    ensureDay(iso);
    ensureCycleFor(iso);
    const pd = activeProfileData();
    const time = parseDoneTime(timeHHMM) || nowHHMM();

    if (activity.type === "daily") {
      if (done) pd.logs[iso].checksDaily[activity.id] = time;
      else delete pd.logs[iso].checksDaily[activity.id];
    } else {
      const cycle = ensureCycleFor(iso);
      if (done) {
        cycle.done[activity.id] = true;
        cycle.doneAt[activity.id] = time;
      } else {
        delete cycle.done[activity.id];
        delete cycle.doneAt[activity.id];
      }
      cycle.updatedAt = nowISODate();
      if (cycle.weekStartISO === startOfWeekISO(todayISO())) pd.cycle = cycle;
    }

    saveDB();
  }

  function getDoneTimeFor(iso, activity) {
    const pd = activeProfileData();
    if (activity.type === "daily") return parseDoneTime(pd.logs[iso]?.checksDaily?.[activity.id]);
    return parseDoneTime(getCycleFor(iso)?.doneAt?.[activity.id]);
  }

  function setDoneTimeFor(iso, activity, timeHHMM) {
    if (!isDoneFor(iso, activity)) return;
    const time = parseDoneTime(timeHHMM);
    if (!time) return;
    const pd = activeProfileData();
    if (activity.type === "daily") {
      ensureDay(iso);
      pd.logs[iso].checksDaily[activity.id] = time;
    } else {
      const cycle = ensureCycleFor(iso);
      cycle.doneAt[activity.id] = time;
      cycle.updatedAt = nowISODate();
      if (cycle.weekStartISO === startOfWeekISO(todayISO())) pd.cycle = cycle;
    }
    saveDB();
  }

  function setLoggedDuration(iso, actId, minutes) {
    const day = ensureDay(iso);
    const normalized = ensureStep(minutes);
    if (normalized > 0) day.durations[actId] = normalized;
    else delete day.durations[actId];
    saveDB();
  }

  function adjustLoggedDuration(iso, actId, delta) {
    const current = getLoggedDuration(iso, actId);
    setLoggedDuration(iso, actId, Math.max(0, current + delta));
  }

  function getLoggedDuration(iso, actId) {
    const pd = activeProfileData();
    return ensureStep(pd.logs[iso]?.durations?.[actId] || 0);
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

  function entryRange(entry) {
    const start = clockToMinutes(entry?.time);
    const minutes = ensureStep(entry?.minutes || 0);
    if (start == null || minutes <= 0) return null;
    return { start, end: start + minutes };
  }

  function findOverlappingEntry(iso, timeHHMM, minutes, exceptId = null) {
    const candidate = entryRange({ time: timeHHMM, minutes });
    if (!candidate) return null;
    return getTimeEntries(iso).find(entry => {
      if (exceptId && entry.id === exceptId) return false;
      const current = entryRange(entry);
      if (!current) return false;
      return candidate.start < current.end && candidate.end > current.start;
    }) || null;
  }

  function addTimeEntry(iso, activity, minutes, timeHHMM) {
    const normalized = ensureStep(minutes);
    if (!activity || !normalized || normalized > MAX_ENTRY_MINUTES) return false;
    const parsedTime = parseDoneTime(timeHHMM);
    if (parsedTime && findOverlappingEntry(iso, parsedTime, normalized)) return false;

    const day = ensureDay(iso);
    const startMins = clockToMinutes(parsedTime);
    day.entries.push({
      id: uid(),
      activityId: activity.id,
      minutes: normalized,
      time: parsedTime,
      endTime: startMins == null ? null : toClock(startMins + normalized),
      createdAt: Date.now(),
    });

    day.durations[activity.id] = getLoggedDuration(iso, activity.id) + normalized;

    if (!isDoneFor(iso, activity)) setDoneFor(iso, activity, true, parsedTime || nowHHMM());
    else if (parsedTime && !getDoneTimeFor(iso, activity)) setDoneTimeFor(iso, activity, parsedTime);

    saveDB();
    return true;
  }

  function removeTimeEntry(iso, entryId) {
    const day = ensureDay(iso);
    const idx = day.entries.findIndex(x => x.id === entryId);
    if (idx < 0) return false;
    const entry = day.entries[idx];
    day.entries.splice(idx, 1);

    const current = getLoggedDuration(iso, entry.activityId);
    const next = Math.max(0, current - ensureStep(entry.minutes));
    if (next > 0) day.durations[entry.activityId] = next;
    else delete day.durations[entry.activityId];

    saveDB();
    return true;
  }

  /* ============================================================
     Plan del día
     Registrar es mirar atrás; planear es mirar adelante. Los bloques
     planeados viven en day.plannedEntries (propios) y en db.sharedPlan
     (los de a dos), y se leen siempre juntos.
     ============================================================ */

  function ensureSharedDay(iso) {
    if (!db.sharedPlan || typeof db.sharedPlan !== "object") db.sharedPlan = {};
    if (!Array.isArray(db.sharedPlan[iso])) db.sharedPlan[iso] = [];
    return db.sharedPlan[iso];
  }

  /* Todo el plan de un día: lo propio + lo compartido, ya ordenado. */
  function getPlanFor(iso) {
    const own = ensureDay(iso).plannedEntries || [];
    const shared = (db.sharedPlan?.[iso] || []).map(b => ({ ...b, shared: true }));
    return sortPlannedBlocks(own.concat(shared));
  }

  function findPlannedBlock(iso, blockId) {
    const own = (activeProfileData().logs[iso]?.plannedEntries || []).find(b => b.id === blockId);
    if (own) return { block: own, shared: false };
    const shared = (db.sharedPlan?.[iso] || []).find(b => b.id === blockId);
    if (shared) return { block: shared, shared: true };
    return null;
  }

  function addPlannedBlock(iso, data) {
    const block = normalizePlannedBlock({
      ...data,
      id: uid(),
      status: "planned",
      createdBy: activeProfile(),
      createdAt: nowISODate(),
    });
    if (!block) return null;

    if (block.shared) ensureSharedDay(iso).push(block);
    else ensureDay(iso).plannedEntries.push(block);

    saveDB();
    return block;
  }

  function updatePlannedBlock(iso, blockId, data) {
    const found = findPlannedBlock(iso, blockId);
    if (!found) return null;

    const merged = normalizePlannedBlock({ ...found.block, ...data, id: blockId });
    if (!merged) return null;

    /* Si cambió de propio a compartido (o al revés) hay que moverlo de lista. */
    if (merged.shared !== found.shared) {
      removePlannedBlock(iso, blockId, { silent: true });
      if (merged.shared) ensureSharedDay(iso).push(merged);
      else ensureDay(iso).plannedEntries.push(merged);
    } else {
      Object.assign(found.block, merged);
    }

    saveDB();
    return merged;
  }

  function removePlannedBlock(iso, blockId, { silent = false } = {}) {
    const day = ensureDay(iso);
    const before = day.plannedEntries.length + (db.sharedPlan?.[iso]?.length || 0);

    day.plannedEntries = day.plannedEntries.filter(b => b.id !== blockId);
    if (Array.isArray(db.sharedPlan?.[iso])) {
      db.sharedPlan[iso] = db.sharedPlan[iso].filter(b => b.id !== blockId);
      if (!db.sharedPlan[iso].length) delete db.sharedPlan[iso];
    }

    const removed = before > day.plannedEntries.length + (db.sharedPlan?.[iso]?.length || 0);
    if (removed && !silent) saveDB();
    return removed;
  }

  function setPlannedStatus(iso, blockId, status) {
    const found = findPlannedBlock(iso, blockId);
    if (!found) return null;
    found.block.status = ["planned", "done", "skipped"].includes(status) ? status : "planned";
    saveDB();
    return found.block;
  }

  /* Cierra el ciclo: un bloque cuya actividad ya se hizo ese día cuenta como
     cumplido sin que nadie lo marque dos veces. Solo sube de planeado a hecho;
     nunca deshace un "saltado" puesto a mano. */
  function reconcilePlanWithReality(iso) {
    let changed = false;
    getPlanFor(iso).forEach(block => {
      if (block.status !== "planned") return;
      const activity = aById(block.activityId);
      if (!activity) return;
      if (isDoneFor(iso, activity) || getLoggedDuration(iso, block.activityId) > 0) {
        const found = findPlannedBlock(iso, block.id);
        if (found) {
          found.block.status = "done";
          changed = true;
        }
      }
    });
    return changed;
  }

  /* Plan contra realidad, para el día seleccionado. */
  function getPlanMetrics(iso) {
    const plan = getPlanFor(iso);
    const done = plan.filter(b => b.status === "done").length;
    const skipped = plan.filter(b => b.status === "skipped").length;
    const pending = plan.filter(b => b.status === "planned").length;
    const plannedMinutes = sum(plan.map(b => b.minutes));
    const realMinutes = sum(plan.map(b => getLoggedDuration(iso, b.activityId)));

    return {
      total: plan.length,
      done,
      skipped,
      pending,
      plannedMinutes,
      realMinutes,
      pct: plan.length ? done / plan.length : 0,
      /* Cuánto se desvió el tiempo real del estimado, solo si hay ambos. */
      driftMinutes: plannedMinutes && realMinutes ? realMinutes - plannedMinutes : 0,
    };
  }

  /* Actividades de rotación semanal que siguen sin fecha asignada en la semana.
     Es la lista de "esto falta, ¿cuándo lo hacemos?". */
  function getUnscheduledForWeek(weekStartISO) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartISO, i));
    const cycle = getCycleFor(weekStartISO);
    const plannedIds = new Set();

    days.forEach(iso => getPlanFor(iso).forEach(b => plannedIds.add(b.activityId)));

    return activeActivities()
      .filter(a => a.type === "complement")
      .filter(a => !cycle?.done?.[a.id])
      .filter(a => !plannedIds.has(a.id));
  }

  function getFilteredActivities({ forManage = false } = {}) {
    const q = ((forManage ? els.manageSearch?.value : els.search?.value) || "").trim().toLowerCase();
    const cat = els.categoryFilter?.value || "__all__";
    const mode = (forManage ? els.manageFilterType?.value : els.modeFilter?.value) || (forManage ? "__all__" : "all");
    const energy = els.energyFilter?.value || "__all__";

    return db.activities
      .filter(a => {
        if (!forManage && !isActivityActive(a)) return false;
        const hay = `${a.name} ${a.category} ${a.subcategory || ""}`.toLowerCase();
        if (q && !hay.includes(q)) return false;
        if (!forManage) {
          if (cat !== "__all__" && a.category !== cat) return false;
          if (mode === "daily" && a.type !== "daily") return false;
          if (mode === "complement" && a.type !== "complement") return false;
          if (energy !== "__all__" && (a.energy || "__none__") !== energy) return false;
        } else if (mode !== "__all__" && a.type !== mode) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        if (a.type !== b.type) return a.type === "daily" ? -1 : 1;
        if (a.category !== b.category) return a.category.localeCompare(b.category, "es");
        return a.name.localeCompare(b.name, "es");
      });
  }

  function rebuildCategoryFilter() {
    if (!els.categoryFilter) return;
    const cats = allCategories();
    const current = els.categoryFilter.value || "__all__";
    els.categoryFilter.innerHTML = `<option value="__all__">Todas las categorías</option>` +
      cats.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
    els.categoryFilter.value = cats.includes(current) ? current : "__all__";
  }

  function getDateRangeArray(endISO, rangeDays) {
    const startISO = addDays(endISO, -(rangeDays - 1));
    return Array.from({ length: rangeDays }, (_, i) => addDays(startISO, i));
  }

  function getDayMetrics(iso) {
    const day = activeProfileData().logs[iso];
    const dailyActs = activeActivities().filter(a => a.type === "daily");
    const allActs = activeActivities();
    const durations = day?.durations || {};
    const doneDaily = dailyActs.filter(a => isDoneFor(iso, a)).length;
    const doneAll = allActs.filter(a => isDoneFor(iso, a)).length;
    return {
      iso,
      doneDaily,
      totalDaily: dailyActs.length,
      doneAll,
      totalAll: allActs.length,
      pctDaily: dailyActs.length ? doneDaily / dailyActs.length : 0,
      pctAll: allActs.length ? doneAll / allActs.length : 0,
      totalDurationDone: sum(Object.values(durations)),
      notes: day?.notes || "",
    };
  }

  function computeBalanceForRange(days) {
    let carga = 0;
    let descanso = 0;

    for (const iso of days) {
      for (const a of activeActivities()) {
        if (!isDoneFor(iso, a)) continue;
        const hay = `${a.name} ${a.category} ${a.subcategory || ""}`.toLowerCase();
        const isRest = /descanso|dorm|sueñ|pausa|respir|caminar|natur|pareja|conex|mascota|jugar/.test(hay);
        const isWork = /trabajo|admin|program|planea|finanza|estudio|práctica|practica|música|musica|arte|dibujo|pedagog/.test(hay);
        const score = a.energy === "high" ? 1.6 : a.energy === "mid" ? 1.15 : a.energy === "low" ? 0.8 : 1;
        if (isRest && !isWork) descanso += score;
        else if (isWork && !isRest) carga += score;
        else {
          carga += score * 0.6;
          descanso += score * 0.4;
        }
      }
    }

    const total = carga + descanso;
    return { carga, descanso, restRatio: total ? descanso / total : 0.5 };
  }

  function computeMetrics({ rangeDays = 30 } = {}) {
    const days = getDateRangeArray(todayISO(), rangeDays);
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

    const cats = allCategories();
    const byCategory = cats.map(cat => {
      const acts = activeActivities().filter(a => a.category === cat);
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

    const topActivities = activeActivities().map(a => {
      const done = days.filter(iso => isDoneFor(iso, a)).length;
      return { id: a.id, name: a.name, cat: a.category, type: a.type, done, total: rangeDays, pct: rangeDays ? done / rangeDays : 0 };
    }).sort((a, b) => b.done - a.done || b.pct - a.pct);

    const avoidedActivities = [...topActivities]
      .filter(a => a.done < a.total)
      .sort((a, b) => a.pct - b.pct || a.done - b.done);

    const bestDay = [...byDay].sort((a, b) => b.pctDaily - a.pctDaily || b.doneDaily - a.doneDaily)[0] || null;
    const worstDay = [...byDay].sort((a, b) => a.pctDaily - b.pctDaily || a.doneDaily - b.doneDaily)[0] || null;

    let streakCurrent = 0;
    let streakBest = 0;
    let working = 0;
    byDay.forEach(d => {
      if (d.pctDaily >= 0.6) {
        working++;
        streakBest = Math.max(streakBest, working);
      } else working = 0;
    });
    for (let i = byDay.length - 1; i >= 0; i--) {
      if (byDay[i].pctDaily >= 0.6) streakCurrent++;
      else break;
    }

    const energy = { low: 0, mid: 0, high: 0, none: 0 };
    activeActivities().forEach(a => {
      if (a.energy === "low") energy.low++;
      else if (a.energy === "mid") energy.mid++;
      else if (a.energy === "high") energy.high++;
      else energy.none++;
    });

    return {
      rangeDays,
      days,
      byDay,
      byCategory,
      topActivities,
      avoidedActivities,
      avgDaily: avg(byDay.map(x => x.pctDaily)),
      avgAll: avg(byDay.map(x => x.pctAll)),
      bestDay,
      worstDay,
      streakCurrent,
      streakBest,
      activeDays: byDay.filter(d => d.doneAll > 0).length,
      emptyDays: byDay.filter(d => d.doneAll === 0).length,
      noteDays: byDay.filter(d => (d.notes || "").trim()).length,
      totalDuration: sum(byDay.map(d => d.duration || 0)),
      dailyCount: activeActivities().filter(a => a.type === "daily").length,
      allCount: activeActivities().length,
      energy,
      balance: computeBalanceForRange(days),
    };
  }

  function getDoneActsForDay(iso) {
    return activeActivities().filter(a => isDoneFor(iso, a));
  }

  function buildScheduleForDay(iso) {
    const entries = getTimeEntries(iso).map(entry => {
      const activity = aById(entry.activityId);
      if (!activity) return null;
      return {
        activity,
        duration: ensureStep(entry.minutes),
        doneTime: parseDoneTime(entry.time) || getDoneTimeFor(iso, activity),
      };
    }).filter(Boolean);

    const usedByAct = {};
    entries.forEach(e => {
      usedByAct[e.activity.id] = (usedByAct[e.activity.id] || 0) + e.duration;
    });

    getDoneActsForDay(iso).forEach(a => {
      const total = getLoggedDuration(iso, a.id);
      const remain = Math.max(0, total - (usedByAct[a.id] || 0));
      if (!remain && entries.some(e => e.activity.id === a.id)) return;
      if (!remain && !getDoneTimeFor(iso, a)) return;
      entries.push({ activity: a, duration: remain, doneTime: getDoneTimeFor(iso, a) });
    });

    return entries.sort((a, b) => {
      if (a.doneTime && b.doneTime) return a.doneTime.localeCompare(b.doneTime);
      if (a.doneTime) return -1;
      if (b.doneTime) return 1;
      if (b.duration !== a.duration) return b.duration - a.duration;
      return a.activity.name.localeCompare(b.activity.name, "es");
    }).map(entry => {
      let startText = null;
      let endText = null;
      if (entry.doneTime) {
        const startMins = clockToMinutes(entry.doneTime);
        startText = entry.doneTime;
        endText = entry.duration > 0 ? toClock(startMins + entry.duration) : null;
      }
      return { ...entry, startText, endText };
    });
  }

  function getScheduleEndMinutes(iso) {
    const timed = buildScheduleForDay(iso)
      .filter(item => item.startText && item.duration > 0)
      .map(item => clockToMinutes(item.startText) + item.duration)
      .filter(Number.isFinite);
    return timed.length ? Math.max(...timed) : 0;
  }

  function nextOpenClock(iso) {
    return toClock(getScheduleEndMinutes(iso));
  }

  function clearTimeFollowUp() {
    state.timeFollowUp = null;
  }

  function maybeQueueTimeFollowUp(iso, startClock, minutes, label = "") {
    clearTimeFollowUp();
    if (iso !== todayISO()) return;

    const startMins = clockToMinutes(startClock);
    const normalized = ensureStep(minutes);
    const currentClock = nowHHMM();
    const currentMins = clockToMinutes(currentClock);
    if (startMins == null || !normalized || currentMins == null) return;

    const nextMins = startMins + normalized;
    const gap = currentMins - nextMins;
    if (gap < DURATION_STEP) return;

    state.timeFollowUp = {
      iso,
      profile: activeProfile(),
      nextClock: toClock(nextMins),
      currentClock,
      label: String(label || "").trim(),
      createdAt: Date.now(),
    };
  }

  function activeTimeFollowUpFor(iso) {
    const prompt = state.timeFollowUp;
    if (!prompt || prompt.iso !== iso || prompt.profile !== activeProfile()) return null;
    return prompt;
  }

  function activityText(activity) {
    return `${activity?.name || ""} ${activity?.category || ""} ${activity?.subcategory || ""}`.toLowerCase();
  }

  function isSleepActivity(activity) {
    const hay = activityText(activity);
    return hay.includes("sue") || hay.includes("dorm") || hay.includes("descanso") || hay.includes("descans");
  }

  function findSleepActivity() {
    return aById("default_sleep") || activeActivities().find(isSleepActivity) || activeActivities().find(a => activityText(a).includes("pausa")) || null;
  }

  function hasSleepEntry(iso) {
    return getTimeEntries(iso).some(entry => {
      const activity = aById(entry.activityId);
      return activity && isSleepActivity(activity);
    });
  }

  function minutesFromHourMinuteInputs(hourId, minuteId) {
    const hours = Number(document.getElementById(hourId)?.value || 0);
    const mins = Number(document.getElementById(minuteId)?.value || 0);
    const total = (Number.isFinite(hours) ? hours * 60 : 0) + (Number.isFinite(mins) ? mins : 0);
    return ensureStep(total);
  }

  function findRoutineActivity(prompt) {
    const exact = aById(prompt.activityId);
    if (exact && isActivityActive(exact)) return exact;
    return activeActivities().find(a => activityText(a).includes(prompt.label)) || null;
  }

  function isClockInsideWindow(clock, start, end) {
    const current = clockToMinutes(clock);
    const startMin = clockToMinutes(start);
    const endMin = clockToMinutes(end);
    if (current == null || startMin == null || endMin == null) return false;
    return current >= startMin && current <= endMin;
  }

  function hasRoutineEntry(iso, prompt) {
    const activity = findRoutineActivity(prompt);
    if (!activity) return true;
    return isDoneFor(iso, activity) || getTimeEntries(iso, activity.id).length > 0 || getLoggedDuration(iso, activity.id) > 0;
  }

  function routinePromptsFor(iso) {
    const now = nowHHMM();
    return ROUTINE_PROMPTS
      .map(prompt => ({ ...prompt, activity: findRoutineActivity(prompt) }))
      .filter(prompt => prompt.activity && isClockInsideWindow(now, prompt.start, prompt.end) && !hasRoutineEntry(iso, prompt));
  }

  function lastDoneISO(activityId, beforeISO = todayISO(), rangeDays = 60) {
    const pd = activeProfileData();
    for (let i = 0; i < rangeDays; i++) {
      const iso = addDays(beforeISO, -i);
      const day = pd.logs[iso];
      if (day?.durations?.[activityId] || day?.checksDaily?.[activityId]) return iso;
      if (Array.isArray(day?.entries) && day.entries.some(e => e.activityId === activityId)) return iso;
    }
    return null;
  }

  function getActivitySuggestion(iso) {
    const pending = activeActivities().filter(a => !isDoneFor(iso, a));
    const scored = pending.map(a => {
      const last = lastDoneISO(a.id, addDays(iso, -1), 45);
      const daysAgo = last ? Math.max(1, Math.round((isoToDate(iso) - isoToDate(last)) / 86400000)) : 46;
      const name = activityText(a);
      const priority = name.includes("piano") ? 14 : name.includes("música") || name.includes("musica") ? 8 : 0;
      return { activity: a, daysAgo, score: daysAgo + priority };
    }).sort((a, b) => b.score - a.score);
    return scored[0] || null;
  }

  function smartTimeBucket(clockOrMinutes) {
    const mins = typeof clockOrMinutes === "number" ? clockOrMinutes : clockToMinutes(clockOrMinutes);
    if (mins == null) return "sin hora";
    if (mins < 6 * 60) return "madrugada";
    if (mins < 11 * 60) return "manana";
    if (mins < 15 * 60) return "mediodia";
    if (mins < 19 * 60) return "tarde";
    if (mins < 23 * 60) return "noche";
    return "madrugada";
  }

  function smartActivityKind(activity) {
    const hay = activityText(activity);
    if (/descanso|dorm|sue|pausa|respir|caminar|pareja|jugar|ocio|relax/.test(hay)) return "rest";
    if (/comida|desayun|almorz|cenar|cocina|mercado/.test(hay)) return "care";
    if (/trabajo|admin|program|planea|finanza|estudio|practica|música|musica|arte|dibujo|pedagog/.test(hay)) return "load";
    return activity.energy === "high" ? "load" : activity.energy === "low" ? "rest" : "neutral";
  }

  function makeSmartPatternStore() {
    return {
      totalDays: 0,
      daysWithLogs: 0,
      byWeekday: Array.from({ length: 7 }, () => ({ total: 0, activities: {}, categories: {}, buckets: {} })),
      byActivity: {},
      byBucket: {},
    };
  }

  function bumpSmartStat(store, key, amount = 1) {
    if (!key) return;
    store[key] = (store[key] || 0) + amount;
  }

  function analyzeRoutinePatterns(profile = activeProfile(), rangeDays = 45) {
    const pd = db?.profiles?.[profile] || activeProfileData();
    const patterns = makeSmartPatternStore();
    const days = getDateRangeArray(todayISO(), rangeDays);
    patterns.totalDays = days.length;

    days.forEach(iso => {
      const day = pd.logs?.[iso];
      const weekday = isoToDate(iso).getDay();
      const dayPattern = patterns.byWeekday[weekday];
      dayPattern.total++;
      if (!day) return;

      const seenToday = new Set();
      const entries = Array.isArray(day.entries) ? day.entries : [];
      entries.forEach(entry => {
        const activity = aById(entry.activityId);
        if (!activity) return;
        const minutes = ensureStep(entry.minutes || day.durations?.[activity.id] || 0);
        const bucket = smartTimeBucket(entry.time);
        const startMin = clockToMinutes(entry.time);
        seenToday.add(activity.id);
        bumpSmartStat(dayPattern.activities, activity.id);
        bumpSmartStat(dayPattern.categories, activity.category);
        if (!dayPattern.buckets[bucket]) dayPattern.buckets[bucket] = { activities: {}, categories: {}, total: 0 };
        dayPattern.buckets[bucket].total++;
        bumpSmartStat(dayPattern.buckets[bucket].activities, activity.id);
        bumpSmartStat(dayPattern.buckets[bucket].categories, activity.category);
        if (!patterns.byBucket[bucket]) patterns.byBucket[bucket] = { activities: {}, categories: {}, total: 0 };
        patterns.byBucket[bucket].total++;
        bumpSmartStat(patterns.byBucket[bucket].activities, activity.id);
        bumpSmartStat(patterns.byBucket[bucket].categories, activity.category);

        if (!patterns.byActivity[activity.id]) {
          patterns.byActivity[activity.id] = { count: 0, days: 0, weekdays: {}, buckets: {}, totalMinutes: 0, timedCount: 0, totalStart: 0, category: activity.category };
        }
        const stat = patterns.byActivity[activity.id];
        stat.count++;
        stat.totalMinutes += minutes;
        bumpSmartStat(stat.weekdays, weekday);
        bumpSmartStat(stat.buckets, bucket);
        if (startMin != null) {
          stat.timedCount++;
          stat.totalStart += startMin;
        }
      });

      Object.keys(day.checksDaily || {}).forEach(activityId => {
        if (seenToday.has(activityId)) return;
        const activity = aById(activityId);
        if (!activity) return;
        const time = parseDoneTime(day.checksDaily[activityId]);
        const bucket = smartTimeBucket(time);
        seenToday.add(activityId);
        bumpSmartStat(dayPattern.activities, activityId);
        bumpSmartStat(dayPattern.categories, activity.category);
        if (!patterns.byActivity[activityId]) {
          patterns.byActivity[activityId] = { count: 0, days: 0, weekdays: {}, buckets: {}, totalMinutes: 0, timedCount: 0, totalStart: 0, category: activity.category };
        }
        const stat = patterns.byActivity[activityId];
        stat.count++;
        stat.totalMinutes += ensureStep(day.durations?.[activityId] || 30);
        bumpSmartStat(stat.weekdays, weekday);
        bumpSmartStat(stat.buckets, bucket);
        const startMin = clockToMinutes(time);
        if (startMin != null) {
          stat.timedCount++;
          stat.totalStart += startMin;
        }
      });

      if (seenToday.size) patterns.daysWithLogs++;
      seenToday.forEach(activityId => {
        if (patterns.byActivity[activityId]) patterns.byActivity[activityId].days++;
      });
    });

    Object.values(patterns.byActivity).forEach(stat => {
      stat.avgMinutes = ensureStep(stat.totalMinutes / Math.max(1, stat.count));
      stat.typicalTime = stat.timedCount ? toClock(Math.round(stat.totalStart / stat.timedCount / DURATION_STEP) * DURATION_STEP) : null;
    });

    return patterns;
  }

  function getTodayContext(iso) {
    const profile = activeProfile();
    const day = ensureDay(iso);
    const nowClock = nowHHMM();
    const nowMinutes = clockToMinutes(nowClock) || 0;
    const doneActivities = activeActivities().filter(a => isDoneFor(iso, a) || getTimeEntries(iso, a.id).length || getLoggedDuration(iso, a.id));
    const doneIds = new Set(doneActivities.map(a => a.id));
    const pendingActivities = activeActivities().filter(a => !doneIds.has(a.id));
    const staleActivities = pendingActivities.map(activity => {
      const last = lastDoneISO(activity.id, addDays(iso, -1), 60);
      const daysAgo = last ? Math.max(1, Math.round((isoToDate(iso) - isoToDate(last)) / 86400000)) : 61;
      return { activity, daysAgo, last };
    }).sort((a, b) => b.daysAgo - a.daysAgo);
    const loadDone = doneActivities.filter(a => smartActivityKind(a) === "load").length;
    const restDone = doneActivities.filter(a => smartActivityKind(a) === "rest").length;
    const highDone = doneActivities.filter(a => a.energy === "high").length;
    const categoriesDone = {};
    doneActivities.forEach(a => bumpSmartStat(categoriesDone, a.category));

    return {
      profile,
      iso,
      weekday: isoToDate(iso).getDay(),
      nowClock,
      nowMinutes,
      currentBucket: smartTimeBucket(nowMinutes),
      nextBucket: smartTimeBucket(nowMinutes + 90),
      doneIds,
      doneActivities,
      pendingActivities,
      staleActivities,
      plannedEntries: day.plannedEntries || [],
      entries: day.entries || [],
      categoriesDone,
      loadDone,
      restDone,
      highDone,
      loadRatio: (loadDone + restDone) ? loadDone / (loadDone + restDone) : 0.5,
      needsRest: highDone >= 2 || loadDone > restDone + 1,
    };
  }

  function scoreActivityForToday(activity, context, patterns) {
    if (!activity || context.doneIds.has(activity.id)) return { score: -999, reason: "Ya registrada hoy", confidence: 0 };
    const weekdayStats = patterns.byWeekday[context.weekday] || {};
    const activityStats = patterns.byActivity[activity.id] || {};
    const bucketStats = patterns.byBucket[context.currentBucket]?.activities?.[activity.id] || 0;
    const nextBucketStats = patterns.byBucket[context.nextBucket]?.activities?.[activity.id] || 0;
    const weekdayCount = weekdayStats.activities?.[activity.id] || 0;
    const categoryDayCount = weekdayStats.categories?.[activity.category] || 0;
    const stale = context.staleActivities.find(x => x.activity.id === activity.id);
    const daysAgo = stale?.daysAgo || 0;
    const kind = smartActivityKind(activity);
    let score = 0;
    const reasons = [];

    if (weekdayCount) {
      score += weekdayCount * 9;
      reasons.push(`suele aparecer los ${dayNames[context.weekday]}`);
    }
    if (bucketStats || nextBucketStats) {
      score += bucketStats * 8 + nextBucketStats * 5;
      reasons.push(`encaja con esta franja`);
    }
    if (categoryDayCount && !weekdayCount) score += Math.min(16, categoryDayCount * 3);
    if (daysAgo >= 14) {
      score += Math.min(28, daysAgo * 0.75);
      reasons.push(`lleva ${daysAgo} dias sin registrarse`);
    } else if (daysAgo >= 5) {
      score += 8;
      reasons.push(`esta algo olvidada`);
    }

    if (activity.energy === "high") score += context.highDone >= 2 ? -18 : 2;
    if (activity.energy === "low") score += context.needsRest ? 18 : 3;
    if (kind === "rest" && context.needsRest) reasons.push("compensa la carga del dia");
    if (kind === "load" && context.needsRest) score -= 10;
    if (activity.type === "daily") score += 8;
    if (!patterns.daysWithLogs) score += activity.type === "daily" ? 12 : 4;

    const confidence = Math.max(0.18, Math.min(0.96, (weekdayCount + bucketStats + nextBucketStats + (activityStats.count || 0) / 4) / Math.max(4, patterns.daysWithLogs || 4)));
    return {
      activity,
      score,
      reason: reasons.slice(0, 2).join("; ") || "pendiente activa para completar el dia",
      confidence,
      daysAgo,
      avgMinutes: activityStats.avgMinutes || 45,
      typicalTime: activityStats.typicalTime,
    };
  }

  function smartDurationFor(scoreItem, mode) {
    const raw = scoreItem.avgMinutes || 45;
    const softer = mode === "soft" ? -15 : mode === "productive" ? 15 : 0;
    const mins = raw + softer;
    if (mins <= 35) return 30;
    if (mins <= 52) return 45;
    return 60;
  }

  function generateSmartDayPlan(iso, options = {}) {
    const mode = options.mode || state.smartPlannerMode || "balanced";
    const patterns = analyzeRoutinePatterns(activeProfile(), options.rangeDays || 45);
    const context = getTodayContext(iso);
    const maxBlocks = mode === "productive" ? 6 : mode === "soft" ? 4 : 5;
    const startBase = Math.max(context.nowMinutes + 15, getScheduleEndMinutes(iso) || 0, 7 * 60);
    let cursor = Math.ceil(startBase / 15) * 15;
    if (todayISO() !== iso) cursor = Math.max(7 * 60, cursor);
    const hardEnd = mode === "productive" ? 22 * 60 : 21 * 60;
    const scored = context.pendingActivities
      .map(activity => scoreActivityForToday(activity, context, patterns))
      .filter(item => item.score > -100)
      .sort((a, b) => b.score - a.score);
    const plan = [];
    let highCount = context.highDone;
    let restIncluded = false;

    for (const item of scored) {
      if (plan.length >= maxBlocks || cursor >= hardEnd) break;
      if (plan.some(block => block.activityId === item.activity.id)) continue;
      const kind = smartActivityKind(item.activity);
      if (item.activity.energy === "high" && highCount >= (mode === "productive" ? 3 : 2)) continue;
      if (context.needsRest && plan.length >= 2 && !restIncluded && kind !== "rest" && item.activity.energy !== "low") continue;
      const minutes = smartDurationFor(item, mode);
      const end = cursor + minutes;
      if (end > hardEnd) continue;
      plan.push({
        id: uid(),
        start: toClock(cursor),
        end: toClock(end),
        minutes,
        activityId: item.activity.id,
        title: item.activity.name,
        category: item.activity.category,
        reason: item.reason,
        energy: item.activity.energy || "",
        confidence: item.confidence,
      });
      if (item.activity.energy === "high") highCount++;
      if (kind === "rest" || item.activity.energy === "low") restIncluded = true;
      cursor = end + (mode === "productive" ? 10 : 15);
    }

    if (context.needsRest && !restIncluded && plan.length < maxBlocks) {
      const restItem = scored.find(item => smartActivityKind(item.activity) === "rest" || item.activity.energy === "low");
      if (restItem && !plan.some(block => block.activityId === restItem.activity.id) && cursor + 30 <= hardEnd) {
        plan.push({
          id: uid(),
          start: toClock(cursor),
          end: toClock(cursor + 30),
          minutes: 30,
          activityId: restItem.activity.id,
          title: restItem.activity.name,
          category: restItem.activity.category,
          reason: "bloque suave para equilibrar carga y descanso",
          energy: restItem.activity.energy || "",
          confidence: restItem.confidence,
        });
      }
    }

    const topCategory = Object.entries(patterns.byWeekday[context.weekday]?.categories || {}).sort((a, b) => b[1] - a[1])[0];
    const topBucket = Object.entries(patterns.byWeekday[context.weekday]?.buckets || {}).sort((a, b) => b[1].total - a[1].total)[0];
    const patternText = patterns.daysWithLogs
      ? `La mayoria de ${dayNames[context.weekday]} suelen registrar ${topCategory ? topCategory[0] : "actividades"}${topBucket ? ` en la franja de ${topBucket[0]}` : ""}.`
      : "Todavia hay poco historial; esta propuesta usa actividades activas y pendientes del perfil.";

    return { iso, profile: context.profile, mode, patternText, plan, patterns, context };
  }

  function getSmartPlanForRender(iso, force = false) {
    const key = `${activeProfile()}|${iso}|${state.smartPlannerMode}|${getTodayContext(iso).doneActivities.length}|${getTodayContext(iso).entries.length}`;
    if (force || !state.smartPlannerPlan || state.smartPlannerKey !== key) {
      state.smartPlannerPlan = generateSmartDayPlan(iso);
      state.smartPlannerKey = key;
    }
    return state.smartPlannerPlan;
  }

  function saveSmartPlannedEntries(iso, plan) {
    const day = ensureDay(iso);
    const existing = Array.isArray(day.plannedEntries) ? day.plannedEntries.filter(x => x.status !== "planned") : [];
    day.plannedEntries = existing.concat((plan || []).map(block => ({
      id: block.id || uid(),
      activityId: block.activityId,
      start: block.start,
      end: block.end,
      minutes: ensureStep(block.minutes || (clockToMinutes(block.end) - clockToMinutes(block.start))),
      reason: block.reason || "",
      status: "planned",
      createdAt: nowISODate(),
    })));
    saveDB();
  }

  function markPlannedEntryStatus(iso, blockId, status) {
    const day = ensureDay(iso);
    const entry = day.plannedEntries.find(x => x.id === blockId);
    if (!entry) return null;
    entry.status = status;
    saveDB();
    return entry;
  }

  function renderSmartPlanner() {
    if (!els.smartPlannerWrap) return;
    const iso = state.dateISO;
    const proposal = getSmartPlanForRender(iso);
    const plan = proposal.plan || [];
    const saved = ensureDay(iso).plannedEntries.filter(x => x.status === "planned");
    const visiblePlan = saved.length ? saved.map(x => {
      const activity = aById(x.activityId);
      return activity ? {
        id: x.id,
        start: x.start,
        end: x.end,
        minutes: x.minutes,
        activityId: x.activityId,
        title: activity.name,
        category: activity.category,
        reason: x.reason || "bloque planeado guardado",
        energy: activity.energy || "",
        confidence: 0.7,
      } : null;
    }).filter(Boolean) : plan;

    els.smartPlannerWrap.innerHTML = `
      <section class="smartPlanner" aria-label="Que hacemos hoy">
        <div class="smartPlannerHeader">
          <div>
            <h3>Qu&eacute; hacemos hoy</h3>
            <div class="muted">Propuesta local basada en el historial de ${activeProfile() === "alek" ? "Alek" : "Cata"}</div>
          </div>
          <div class="smartPlanActions">
            <button class="small" type="button" data-smart-action="soft">M&aacute;s suave</button>
            <button class="small" type="button" data-smart-action="productive">M&aacute;s productivo</button>
            <button class="small" type="button" data-smart-action="refresh">Actualizar propuesta</button>
          </div>
        </div>
        <div class="smartPatternBox">${escapeHTML(proposal.patternText)}</div>
        ${visiblePlan.length ? `
          <div class="smartPlanList">
            ${visiblePlan.map(block => `
              <div class="smartPlanItem" data-plan-id="${escapeHTML(block.id)}">
                <div class="smartPlanTime">${escapeHTML(block.start)}<span>${escapeHTML(block.end)}</span></div>
                <div class="smartPlanMain">
                  <div class="smartPlanTitle">${escapeHTML(block.title)}</div>
                  <div class="smartPlanMeta">
                    <span class="tag">${escapeHTML(block.category)}</span>
                    ${block.energy ? `<span class="tag">${escapeHTML(energyLabel(block.energy))}</span>` : ""}
                    <span class="tag">${escapeHTML(fmtDurationMin(block.minutes))}</span>
                    <span class="tag">${Math.round((block.confidence || 0) * 100)}% confianza</span>
                  </div>
                  <div class="smartPlanReason">${escapeHTML(block.reason)}</div>
                </div>
                <div class="smartPlanActions">
                  <button class="small" type="button" data-smart-action="register" data-plan-id="${escapeHTML(block.id)}">Registrar</button>
                  <button class="small" type="button" data-smart-action="change" data-plan-id="${escapeHTML(block.id)}">Cambiar</button>
                  <button class="small danger" type="button" data-smart-action="remove" data-plan-id="${escapeHTML(block.id)}">Quitar</button>
                </div>
              </div>
            `).join("")}
          </div>
          <div class="smartPlanFooter">
            <button class="btn" type="button" data-smart-action="use">Usar horario</button>
          </div>
        ` : `<div class="emptyState">No hay suficientes pendientes futuros para proponer horario sin tocar lo que ya existe.</div>`}
      </section>
    `;
  }

  function bindSmartPlanner(iso) {
    if (!els.smartPlannerWrap || els.smartPlannerWrap.__boundSmartPlanner) return;
    els.smartPlannerWrap.__boundSmartPlanner = true;
    on(els.smartPlannerWrap, "click", e => {
      const btn = e.target.closest("[data-smart-action]");
      if (!btn) return;
      iso = state.dateISO;
      const action = btn.dataset.smartAction;
      const proposal = getSmartPlanForRender(iso);
      const plan = proposal.plan || [];
      const planId = btn.dataset.planId || "";

      if (action === "soft" || action === "productive") {
        state.smartPlannerMode = action === "soft" ? "soft" : "productive";
        getSmartPlanForRender(iso, true);
        renderSmartPlanner();
        return;
      }

      if (action === "refresh") {
        state.smartPlannerMode = "balanced";
        getSmartPlanForRender(iso, true);
        renderSmartPlanner();
        toast("Propuesta actualizada.", "ok");
        return;
      }

      if (action === "use") {
        saveSmartPlannedEntries(iso, plan);
        renderToday();
        toast("Horario planeado guardado en Firebase.", "ok");
        return;
      }

      if (action === "remove") {
        const day = ensureDay(iso);
        const savedIdx = day.plannedEntries.findIndex(x => x.id === planId);
        if (savedIdx >= 0) {
          day.plannedEntries.splice(savedIdx, 1);
          saveDB();
        } else {
          proposal.plan = plan.filter(x => x.id !== planId);
        }
        renderSmartPlanner();
        return;
      }

      if (action === "change") {
        const day = ensureDay(iso);
        const savedBlock = day.plannedEntries.find(x => x.id === planId);
        const block = plan.find(x => x.id === planId);
        const used = new Set(plan.map(x => x.activityId).concat(day.plannedEntries.map(x => x.activityId)));
        const scored = proposal.context.pendingActivities
          .filter(a => !used.has(a.id))
          .map(a => scoreActivityForToday(a, proposal.context, proposal.patterns))
          .sort((a, b) => b.score - a.score)[0];
        if ((!block && !savedBlock) || !scored) return toast("No encontre otra actividad adecuada para cambiar.", "warn");
        if (savedBlock) {
          savedBlock.activityId = scored.activity.id;
          savedBlock.reason = scored.reason;
          saveDB();
        }
        if (block) {
          block.activityId = scored.activity.id;
          block.title = scored.activity.name;
          block.category = scored.activity.category;
          block.energy = scored.activity.energy || "";
          block.reason = scored.reason;
          block.confidence = scored.confidence;
        }
        renderSmartPlanner();
        return;
      }

      if (action === "register") {
        const saved = ensureDay(iso).plannedEntries.find(x => x.id === planId);
        const block = saved ? {
          id: saved.id,
          activityId: saved.activityId,
          minutes: saved.minutes,
          start: saved.start,
        } : plan.find(x => x.id === planId);
        const activity = block ? aById(block.activityId) : null;
        if (!block || !activity) return toast("No encontre ese bloque planeado.", "warn");
        if (!addTimeEntry(iso, activity, block.minutes, block.start)) return toast("Ese bloque se cruza con otro horario registrado.", "warn");
        if (saved) markPlannedEntryStatus(iso, saved.id, "done");
        maybeQueueTimeFollowUp(iso, block.start, block.minutes, activity.name);
        state.smartPlannerPlan = null;
        renderToday();
        toast(`${activity.name} registrado en Firebase.`, "ok");
      }
    });
  }

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
    if (!TAB_MAP[view]) view = "today";
    state.view = view;
    updateTabsUI(view);
    renderCurrentView();
  }

  function bindTabsKeyboard() {
    const tabs = Object.values(TAB_MAP).map(x => x.btn).filter(Boolean);
    tabs.forEach((tab, idx) => {
      on(tab, "keydown", e => {
        if (tab.getAttribute("role") !== "tab") return;
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        let next = idx;
        if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
        if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = tabs.length - 1;
        tabs[next].focus();
      });
    });
  }

  function updateProfileToggleUI() {
    const profile = activeProfile();
    if (els.btnProfileAlek) {
      els.btnProfileAlek.classList.toggle("isActive", profile === "alek");
      els.btnProfileAlek.setAttribute("aria-pressed", String(profile === "alek"));
    }
    if (els.btnProfileCata) {
      els.btnProfileCata.classList.toggle("isActive", profile === "cata");
      els.btnProfileCata.setAttribute("aria-pressed", String(profile === "cata"));
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
    updateProfileToggleUI();
    renderCurrentView();
  }

  function bindNotesAutosave(iso) {
    if (!els.dayNotes) return;
    els.dayNotes.oninput = () => {
      if (els.noteSaved) els.noteSaved.textContent = "escribiendo…";
      clearTimeout(notesTimer);
      notesTimer = setTimeout(() => {
        const day = ensureDay(iso);
        day.notes = els.dayNotes.value || "";
        saveDB();
        if (els.noteSaved) els.noteSaved.textContent = "guardado";
      }, 420);
    };
  }

  function askEditTime(activity, iso) {
    const current = getDoneTimeFor(iso, activity) || nowHHMM();
    modalOpen({
      title: `🕐 Hora - ${activity.name}`,
      desc: "¿A qué hora hiciste esta actividad? Esto ayuda a construir el horario real del día.",
      contentHTML: `
        <div style="margin-top:8px">
          <label class="label" for="timeEditInput">Hora</label>
          <input id="timeEditInput" class="input" type="time" value="${escapeHTML(current)}" autofocus style="font-size:22px;text-align:center;width:100%" />
        </div>
      `,
      actions: [
        { label: "Cancelar", kind: "ghost", onClick: modalClose },
        {
          label: "Guardar hora",
          onClick: () => {
            const val = document.getElementById("timeEditInput")?.value || "";
            if (!parseDoneTime(val)) return toast("Hora inválida.", "warn");
            setDoneTimeFor(iso, activity, val);
            modalClose();
            renderCurrentView();
            toast(`Hora guardada: ${val} ✅`, "ok");
          },
        },
      ],
    });
  }

  function askDuration(activity, iso) {
    modalOpen({
      title: `⏱ ${activity.name}`,
      desc: `¿Cuánto tiempo le dedicaron hoy? Se guarda en bloques de ${DURATION_STEP} minutos.`,
      contentHTML: `
        <div style="margin-top:8px">
          <label class="label" for="durationInput">Minutos dedicados</label>
          <input id="durationInput" class="input" type="number" min="${DURATION_STEP}" step="${DURATION_STEP}" placeholder="Ej: 15, 60, 90" autofocus style="font-size:18px;text-align:center" />
          <div class="hint tiny" style="margin-top:8px">Déjalo vacío si no quieres registrar tiempo ahora.</div>
        </div>
      `,
      actions: [
        { label: "Omitir", kind: "ghost", onClick: () => { modalClose(); renderCurrentView(); } },
        {
          label: "Guardar",
          onClick: () => {
            const raw = document.getElementById("durationInput")?.value || "";
            const val = raw.trim() === "" ? 0 : Number(raw);
            if (raw.trim() !== "" && (!Number.isFinite(val) || val <= 0)) return toast("Ingresa un número válido.", "warn");
            if (val > 0) setLoggedDuration(iso, activity.id, val);
            modalClose();
            renderCurrentView();
          },
        },
      ],
    });
  }

  function renderSidebarDayMeta() {
    if (els.selectedDayMeta) {
      const profile = activeProfile() === "alek" ? "Alek" : "Cata";
      els.selectedDayMeta.textContent = `${profile} · ${fmtDateShort(state.dateISO)}`;
    }
  }

  function renderTimeTracker(iso) {
    if (!els.timeTrackerWrap) return;
    const activities = [...activeActivities()].sort((a, b) => a.name.localeCompare(b.name, "es"));
    const day = ensureDay(iso);
    const totalTracked = sum(Object.values(day.durations || {}));
    const remaining = Math.max(0, 1440 - totalTracked);
    const doneCount = activities.filter(a => isDoneFor(iso, a)).length;
    const pending = activities.filter(a => !isDoneFor(iso, a));
    const entries = getTimeEntries(iso).sort((a, b) => safeNumber(b.createdAt, 0) - safeNumber(a.createdAt, 0));
    const nextClock = nextOpenClock(iso);
    const suggestion = getActivitySuggestion(iso);
    const sleepActivity = findSleepActivity();
    const showSleepPrompt = sleepActivity && !hasSleepEntry(iso);
    const routinePrompts = routinePromptsFor(iso);

    els.timeTrackerWrap.innerHTML = `
      <div class="timeTracker">
        <div class="timeStats">
          <span class="tag tagTime">Hoy registradas: ${escapeHTML(fmtDurationMin(totalTracked))}</span>
          <span class="tag ${remaining <= 0 ? "tagNoTime" : ""}">Te quedan: ${escapeHTML(fmtDurationMin(remaining))}</span>
          <span class="tag">Hechas: ${doneCount}/${activities.length}</span>
          <span class="tag">Sin hacer: ${pending.length}</span>
        </div>

        ${showSleepPrompt ? `
          <div class="timeCoachBox sleepCoach">
            <div>
              <strong>¿A qué hora dormiste y cuánto dormiste hoy?</strong>
              <div class="tiny">Esto guarda el bloque real de descanso en Firebase para recuperar mejor tu horario.</div>
            </div>
            <div class="timeCoachInputs">
              <input id="sleepStart" class="input" type="time" step="900" value="00:00" title="Hora a la que te dormiste" />
              <input id="sleepHours" class="input miniInput" type="number" min="0" max="24" step="1" placeholder="8" />
              <span class="tiny">h</span>
              <input id="sleepMinutes" class="input miniInput" type="number" min="0" max="45" step="${DURATION_STEP}" placeholder="0" />
              <span class="tiny">min</span>
              <button id="btnAddSleep" class="btn" type="button">Registrar sueño</button>
            </div>
          </div>
        ` : ""}

        ${routinePrompts.length ? `
          <div class="routinePromptList">
            ${routinePrompts.map(prompt => `
              <div class="timeCoachBox routineCoach">
                <div>
                  <strong>${escapeHTML(prompt.question)}</strong>
                  <div class="tiny">${escapeHTML(prompt.start)} - ${escapeHTML(prompt.end)} · se guarda como ${escapeHTML(fmtDurationMin(prompt.minutes))}</div>
                </div>
                <div class="timeCoachInputs">
                  <input class="input" type="time" step="900" value="${escapeHTML(nowHHMM())}" data-routine-time="${escapeHTML(prompt.key)}" title="Hora de registro" />
                  <button class="btn ghost" type="button" data-action="add-routine" data-routine-key="${escapeHTML(prompt.key)}">Sí, registrar</button>
                </div>
              </div>
            `).join("")}
          </div>
        ` : ""}

        ${suggestion ? `
          <div class="timeCoachBox">
            <div>
              <strong>Idea para decidir qué hacer:</strong>
              <span> hace ${suggestion.daysAgo >= 46 ? "mucho" : suggestion.daysAgo + " días"} no registras ${escapeHTML(suggestion.activity.name)}.</span>
            </div>
            <button class="btn ghost" id="btnUseSuggestion" type="button" data-activity-id="${escapeHTML(suggestion.activity.id)}">Voy a hacer esto</button>
          </div>
        ` : ""}

        <div class="timeQuickForm">
          <select id="timeEntryActivity" class="select" title="Actividad para registrar">
            <option value="">Selecciona actividad...</option>
            ${activities.map(a => `<option value="${escapeHTML(a.id)}">${escapeHTML(a.name)} (${escapeHTML(a.category)})</option>`).join("")}
          </select>
          <input id="timeEntryHours" class="input miniInput" type="number" min="0" max="24" step="1" placeholder="Horas" />
          <input id="timeEntryMinutes" class="input miniInput" type="number" min="0" max="45" step="${DURATION_STEP}" placeholder="Min" />
          <input id="timeEntryClock" class="input" type="time" step="900" value="${escapeHTML(nextClock)}" />
          <button id="btnAddTimeEntry" class="btn" type="button">+ Registrar</button>
        </div>

        ${activeTimeFollowUpFor(iso) ? `
          <div class="timeCoachBox timeFollowUpPrompt" id="timeFollowUpPrompt">
            <div>
              <strong>Registraste hasta las ${escapeHTML(activeTimeFollowUpFor(iso).nextClock)}.</strong>
              <div class="tiny">¿Quieres agregar qué hiciste en la hora que seguía o seguimos desde la hora actual?</div>
            </div>
            <div class="timeCoachInputs">
              <button class="btn ghost" type="button" data-followup-action="next">Agregar la hora que seguía</button>
              <button class="btn" type="button" data-followup-action="current">Seguir desde ahora</button>
              <button class="small" type="button" data-followup-action="dismiss" title="Cerrar sugerencia">Cerrar</button>
            </div>
          </div>
        ` : ""}

        <div class="hint tiny">Siguiente pregunta: ¿qué hiciste a las ${escapeHTML(nextClock)}? Puedes responder en horas o bloques de ${DURATION_STEP} min.</div>
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
    const sleepBtn = document.getElementById("btnAddSleep");
    const suggestionBtn = document.getElementById("btnUseSuggestion");
    const entriesWrap = document.getElementById("dayTimeEntries");
    const routineWrap = document.querySelector(".routinePromptList");
    const followUpWrap = document.getElementById("timeFollowUpPrompt");

    on(sleepBtn, "click", () => {
      const activity = findSleepActivity();
      const minutes = minutesFromHourMinuteInputs("sleepHours", "sleepMinutes");
      const start = document.getElementById("sleepStart")?.value || "00:00";
      if (!activity) return toast("No encontré una actividad de sueño/descanso.", "warn");
      if (!minutes) return toast("Ingresa cuántas horas dormiste.", "warn");
      if (!addTimeEntry(iso, activity, minutes, start)) return toast("Ese bloque se cruza con otro horario registrado.", "warn");
      maybeQueueTimeFollowUp(iso, start, minutes, activity.name);
      renderToday();
      toast("Sueño registrado ✅", "ok");
    });

    on(routineWrap, "click", e => {
      const btn = e.target.closest("[data-action='add-routine']");
      if (!btn) return;
      const prompt = ROUTINE_PROMPTS.find(x => x.key === btn.dataset.routineKey);
      const activity = prompt ? findRoutineActivity(prompt) : null;
      const clock = document.querySelector(`[data-routine-time='${CSS.escape(btn.dataset.routineKey || "")}']`)?.value || nowHHMM();
      if (!prompt || !activity) return toast("No encontré esa actividad predeterminada.", "warn");
      if (!addTimeEntry(iso, activity, prompt.minutes, clock)) return toast("Ese bloque se cruza con otro horario registrado.", "warn");
      maybeQueueTimeFollowUp(iso, clock, prompt.minutes, activity.name);
      renderToday();
      toast(`${activity.name} registrado en Firebase ✅`, "ok");
    });

    on(suggestionBtn, "click", () => {
      const select = document.getElementById("timeEntryActivity");
      if (select) select.value = suggestionBtn.dataset.activityId || "";
      document.getElementById("timeEntryHours")?.focus();
    });

    on(addBtn, "click", () => {
      const actId = document.getElementById("timeEntryActivity")?.value || "";
      const clock = document.getElementById("timeEntryClock")?.value || "";
      const activity = aById(actId);
      const minutes = minutesFromHourMinuteInputs("timeEntryHours", "timeEntryMinutes");
      if (!activity) return toast("Elige una actividad para registrar.", "warn");
      if (!minutes) return toast(`Ingresa una duración válida en horas o bloques de ${DURATION_STEP} min.`, "warn");
      if (!addTimeEntry(iso, activity, minutes, clock)) return toast("Revisa duración y hora: no se guardan bloques inválidos o solapados.", "warn");
      maybeQueueTimeFollowUp(iso, clock, minutes, activity.name);
      renderToday();
      toast("Bloque registrado ✅", "ok");
    });

    on(followUpWrap, "click", e => {
      const btn = e.target.closest("[data-followup-action]");
      if (!btn) return;

      const action = btn.dataset.followupAction;
      const prompt = activeTimeFollowUpFor(iso);
      const clockInput = document.getElementById("timeEntryClock");
      const hoursInput = document.getElementById("timeEntryHours");
      const minutesInput = document.getElementById("timeEntryMinutes");
      const activityInput = document.getElementById("timeEntryActivity");

      if (action === "next" && prompt) {
        if (clockInput) clockInput.value = prompt.nextClock;
        if (hoursInput) hoursInput.value = "1";
        if (minutesInput) minutesInput.value = "0";
        if (activityInput) {
          activityInput.value = "";
          activityInput.focus();
        }
        clearTimeFollowUp();
        followUpWrap.remove();
        toast(`Listo, registra qué hiciste desde las ${prompt.nextClock}.`, "info");
        return;
      }

      if (action === "current") {
        const current = nowHHMM();
        if (clockInput) clockInput.value = current;
        if (hoursInput) hoursInput.value = "";
        if (minutesInput) minutesInput.value = "";
        if (activityInput) activityInput.focus();
        clearTimeFollowUp();
        followUpWrap.remove();
        toast(`Seguimos desde la hora actual: ${current}.`, "info");
        return;
      }

      if (action === "dismiss") {
        clearTimeFollowUp();
        followUpWrap.remove();
      }
    });

    on(entriesWrap, "click", e => {
      const btn = e.target.closest("[data-action='remove-entry']");
      if (!btn) return;
      if (removeTimeEntry(iso, btn.dataset.entryId)) {
        renderToday();
        toast("Bloque eliminado", "ok");
      }
    });
  }

  function renderActivityCards(list, iso) {
    if (!list.length) return `<div class="emptyState">Nada por acá. Milagro administrativo, supongo ✅</div>`;

    return list.map(a => {
      const checked = isDoneFor(iso, a);
      const typeLabel = a.type === "daily" ? "Diaria" : "Rotación semanal";
      const loggedDur = getLoggedDuration(iso, a.id);
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
              ${loggedDur ? `<span class="tag tagTime">⏱ ${escapeHTML(fmtDurationMin(loggedDur))}</span>` : `<span class="tag tagNoTime">sin tiempo</span>`}
              ${doneTime ? `<span class="tag tagDoneTime" data-action="edit-time" data-id="${escapeHTML(a.id)}" title="Toca para editar la hora">🕐 ${escapeHTML(doneTime)} ✏️</span>` : checked ? `<span class="tag tagNoTime" data-action="edit-time" data-id="${escapeHTML(a.id)}" title="Añadir hora">+ hora</span>` : ""}
            </div>
            ${checked ? `
              <div class="durationControls" style="margin-top:10px;">
                <button class="durationBtn" type="button" data-action="dec" data-id="${escapeHTML(a.id)}">−${DURATION_STEP}</button>
                <div class="durationValue">${escapeHTML(loggedDur ? fmtDurationMin(loggedDur) : "0 min")}</div>
                <button class="durationBtn" type="button" data-action="inc" data-id="${escapeHTML(a.id)}">+${DURATION_STEP}</button>
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
      const activity = aById(target.dataset.id);
      if (!activity) return;
      const checked = target.checked;
      setDoneFor(state.dateISO, activity, checked);
      if (checked) askDuration(activity, state.dateISO);
      else {
        setLoggedDuration(state.dateISO, activity.id, 0);
        renderCurrentView();
      }
    });

    on(container, "click", e => {
      const timeBadge = e.target.closest("[data-action='edit-time']");
      if (timeBadge) {
        const activity = aById(timeBadge.dataset.id);
        if (activity) askEditTime(activity, state.dateISO);
        return;
      }
      const btn = e.target.closest(".durationBtn");
      if (!btn) return;
      const activity = aById(btn.dataset.id);
      if (!activity) return;
      const delta = btn.dataset.action === "inc" ? DURATION_STEP : -DURATION_STEP;
      adjustLoggedDuration(state.dateISO, activity.id, delta);
      renderCurrentView();
    });
  }

  function renderKPIs(iso) {
    const visible = getFilteredActivities();
    const dailyActs = activeActivities().filter(a => a.type === "daily");
    const doneDaily = dailyActs.filter(a => isDoneFor(iso, a)).length;
    const doneVisible = visible.filter(a => isDoneFor(iso, a)).length;
    const errAct = activeActivities().find(a => (a.name || "").toLowerCase().includes("tiempo de error"));
    const errVal = errAct ? getLoggedDuration(iso, errAct.id) : 0;

    if (els.kpiDaily) els.kpiDaily.textContent = dailyActs.length ? `${Math.round((doneDaily / dailyActs.length) * 100)}%` : "0%";
    if (els.kpiDailyHelp) els.kpiDailyHelp.textContent = `diarias hoy (${doneDaily}/${dailyActs.length})`;
    if (els.kpiCount) els.kpiCount.textContent = `${doneVisible}/${visible.length}`;
    if (els.kpiError) els.kpiError.textContent = errVal ? fmtDurationMin(errVal) : "0";
  }

  function renderBalancePill(iso) {
    if (!els.balancePill) return;
    const balance = computeBalanceForRange([iso]);
    const ratio = balance.restRatio;
    if (ratio >= 0.45 && ratio <= 0.65) {
      els.balancePill.textContent = "Balanceado";
      els.balancePill.className = "balancePill pillGood";
    } else if (ratio < 0.3) {
      els.balancePill.textContent = "Mucha carga";
      els.balancePill.className = "balancePill pillWarn";
    } else {
      els.balancePill.textContent = "Más descanso";
      els.balancePill.className = "balancePill pillGood";
    }
  }

  /* ============================================================
     Plan del día: interfaz
     ============================================================ */

  function planStatusLabel(status) {
    if (status === "done") return "cumplido";
    if (status === "skipped") return "no fue";
    return "planeado";
  }

  function renderPlanBlock(iso, block) {
    const activity = aById(block.activityId);
    if (!activity) return "";

    const real = getLoggedDuration(iso, block.activityId);
    const timeText = block.start
      ? `${escapeHTML(block.start)}${block.end ? ` – ${escapeHTML(block.end)}` : ""}`
      : "En el día";

    return `
      <div class="planBlock is-${escapeHTML(block.status)}" data-block="${escapeHTML(block.id)}">
        <div class="planTime ${block.start ? "" : "planTimeLoose"}">${timeText}</div>

        <div class="planBody">
          <div class="planTitle">${escapeHTML(activity.name)}</div>

          <div class="planMeta">
            <span class="tag">${escapeHTML(activity.category)}</span>
            ${block.minutes ? `<span class="tag">${escapeHTML(fmtDurationMin(block.minutes))} previsto</span>` : ""}
            ${real ? `<span class="tag tagTime">⏱ ${escapeHTML(fmtDurationMin(real))} real</span>` : ""}
            ${block.shared ? `<span class="tag tagShared">♥ Los dos</span>` : ""}
            <span class="tag tagStatus">${escapeHTML(planStatusLabel(block.status))}</span>
          </div>

          ${block.note ? `<div class="planNote">${escapeHTML(block.note)}</div>` : ""}
          ${block.reason ? `<div class="planReason">${escapeHTML(block.reason)}</div>` : ""}
        </div>

        <div class="planActions">
          <button class="miniBtn2" type="button" data-plan="done" data-id="${escapeHTML(block.id)}" title="Marcar como cumplido">
            ${block.status === "done" ? "✓ Cumplido" : "Cumplido"}
          </button>

          <button class="miniBtn2" type="button" data-plan="skipped" data-id="${escapeHTML(block.id)}" title="No pasó, y está bien">
            No fue
          </button>

          <button class="miniBtn2" type="button" data-plan="edit" data-id="${escapeHTML(block.id)}" title="Editar bloque">
            Editar
          </button>

          <button class="miniBtn2 isDanger" type="button" data-plan="remove" data-id="${escapeHTML(block.id)}" title="Quitar del plan">
            Quitar
          </button>
        </div>
      </div>
    `;
  }

  function renderDayPlan() {
    if (!els.dayPlanWrap) return;

    const iso = state.dateISO;
    if (reconcilePlanWithReality(iso)) saveDB();

    const plan = getPlanFor(iso);
    const m = getPlanMetrics(iso);
    const isPast = iso < todayISO();

    const summary = plan.length
      ? `${m.done} de ${m.total} ${m.total === 1 ? "cumplido" : "cumplidos"}${
          m.skipped ? ` · ${m.skipped} no ${m.skipped === 1 ? "fue" : "fueron"}` : ""
        }${
          m.plannedMinutes ? ` · ${escapeHTML(fmtDurationMin(m.plannedMinutes))} previstos` : ""
        }`
      : isPast
        ? "Este día no se planeó."
        : "Todavía no hay plan para este día.";

    els.dayPlanWrap.innerHTML = `
      <div class="dayPlan">
        <div class="dayPlanHeader">
          <div>
            <div class="subTitle">Plan de navegación</div>
            <div class="dayPlanSummary">${summary}</div>
          </div>

          <button class="btn" type="button" data-plan="add">+ Añadir al plan</button>
        </div>

        ${plan.length
          ? `<div class="planList">${plan.map(b => renderPlanBlock(iso, b)).join("")}</div>`
          : `<div class="planEmpty">
               ${isPast
                 ? "Sin plan previo. Lo de abajo es lo que terminó pasando."
                 : "Añade lo que quieren hacer este día. Con hora si importa cuándo, o suelto si solo importa que pase."}
             </div>`
        }

        ${m.driftMinutes
          ? `<div class="planDrift">${m.driftMinutes > 0 ? "Tomó" : "Tomó"} ${escapeHTML(fmtDurationMin(Math.abs(m.driftMinutes)))} ${m.driftMinutes > 0 ? "más" : "menos"} de lo previsto.</div>`
          : ""
        }
      </div>
    `;
  }

  /* Formulario de bloque. Sirve para crear y para editar: si llega un bloque,
     precarga sus valores. */
  /* Hora sugerida para un bloque nuevo: después de lo último registrado ese día;
     si no hay nada, el siguiente cuarto de hora (solo si el día es hoy); y si es
     un día futuro, las 9:00. Nunca medianoche, que es lo que devuelve un día vacío. */
  function suggestedStartFor(iso) {
    const afterSchedule = getScheduleEndMinutes(iso);
    if (afterSchedule > 0) return toClock(Math.ceil(afterSchedule / DURATION_STEP) * DURATION_STEP);

    if (iso === todayISO()) {
      const now = clockToMinutes(nowHHMM());
      const next = Math.ceil((now + 5) / DURATION_STEP) * DURATION_STEP;
      if (next < 23 * 60) return toClock(next);
    }

    return "09:00";
  }

  function openPlanBlockModal(iso, existing = null) {
    const activities = activeActivities().slice().sort((a, b) => a.name.localeCompare(b.name, "es"));

    if (!activities.length) {
      toast("Primero crea alguna actividad en la pestaña Actividades.", "warn");
      return;
    }

    const sel = existing?.activityId || activities[0].id;
    const hasTime = existing ? !!existing.start : true;

    modalOpen({
      title: existing ? "Editar bloque del plan" : "Añadir al plan",
      desc: fmtDateLong(iso),
      contentHTML: `
        <div class="planForm">
          <div>
            <label class="label" for="pfActivity">Actividad</label>
            <select id="pfActivity" class="select">
              ${activities.map(a => `
                <option value="${escapeHTML(a.id)}" ${a.id === sel ? "selected" : ""}>
                  ${escapeHTML(a.name)} · ${escapeHTML(a.category)}
                </option>
              `).join("")}
            </select>
          </div>

          <div class="planFormRow">
            <label class="planCheckLabel" for="pfHasTime">
              <input type="checkbox" id="pfHasTime" class="chk" ${hasTime ? "checked" : ""} />
              <span>A una hora concreta</span>
            </label>

            <label class="planCheckLabel" for="pfShared">
              <input type="checkbox" id="pfShared" class="chk" ${existing?.shared ? "checked" : ""} />
              <span>Plan de los dos</span>
            </label>
          </div>

          <div class="grid2">
            <div id="pfTimeFields">
              <label class="label" for="pfStart">Hora de inicio</label>
              <input type="time" id="pfStart" class="input" step="900" value="${escapeHTML(existing?.start || suggestedStartFor(iso))}" />
            </div>

            <div>
              <label class="label" for="pfMinutes">Cuánto crees que tome</label>
              <input type="number" id="pfMinutes" class="input" min="0" step="${DURATION_STEP}" value="${safeNumber(existing?.minutes, 60)}" />
            </div>
          </div>

          <div>
            <label class="label" for="pfNote">Nota (opcional)</label>
            <input type="text" id="pfNote" class="input" maxlength="140" placeholder="Por qué, con quién, dónde…" value="${escapeHTML(existing?.note || "")}" />
          </div>
        </div>
      `,
      actions: [
        { label: "Cancelar", kind: "ghost", onClick: modalClose },
        {
          label: existing ? "Guardar cambios" : "Añadir al plan",
          onClick: () => {
            const activityId = $("#pfActivity")?.value;
            const withTime = !!$("#pfHasTime")?.checked;
            const shared = !!$("#pfShared")?.checked;
            const start = withTime ? parseDoneTime($("#pfStart")?.value) : null;
            const minutes = ensureStep(safeNumber($("#pfMinutes")?.value, 0));
            const note = String($("#pfNote")?.value || "").trim();

            if (!activityId) {
              toast("Elige una actividad.", "warn");
              return;
            }

            if (withTime && !start) {
              toast("Esa hora no es válida.", "warn");
              return;
            }

            const data = { activityId, start, minutes, note, shared };
            const saved = existing
              ? updatePlannedBlock(iso, existing.id, data)
              : addPlannedBlock(iso, data);

            if (!saved) {
              toast("No se pudo guardar el bloque.", "err");
              return;
            }

            modalClose();
            renderCurrentView();
            toast(existing ? "Bloque actualizado." : "Añadido al plan.", "ok");
          },
        },
      ],
    });

    /* Los campos de hora solo tienen sentido si el bloque va a una hora. */
    const toggleTimeFields = () => {
      const wrap = $("#pfTimeFields");
      if (wrap) wrap.classList.toggle("hidden", !$("#pfHasTime")?.checked);
    };

    on($("#pfHasTime"), "change", toggleTimeFields);
    toggleTimeFields();
  }

  function bindDayPlan(iso) {
    if (!els.dayPlanWrap || els.dayPlanWrap.__boundDayPlan) return;
    els.dayPlanWrap.__boundDayPlan = true;

    on(els.dayPlanWrap, "click", e => {
      const btn = e.target.closest("[data-plan]");
      if (!btn) return;

      const action = btn.dataset.plan;
      const day = state.dateISO;
      const id = btn.dataset.id;

      if (action === "add") {
        openPlanBlockModal(day);
        return;
      }

      if (action === "edit") {
        const found = findPlannedBlock(day, id);
        if (found) openPlanBlockModal(day, found.block);
        return;
      }

      if (action === "remove") {
        if (removePlannedBlock(day, id)) {
          renderCurrentView();
          toast("Bloque quitado del plan.", "ok");
        }
        return;
      }

      if (action === "done" || action === "skipped") {
        const found = findPlannedBlock(day, id);
        /* Volver a tocar el mismo estado lo devuelve a planeado. */
        const next = found?.block.status === action ? "planned" : action;
        setPlannedStatus(day, id, next);
        renderCurrentView();
      }
    });
  }

  function renderToday() {
    const iso = state.dateISO;
    ensureDay(iso);
    rebuildCategoryFilter();

    if (els.dateTitle) els.dateTitle.textContent = fmtDateLong(iso);
    if (els.todaySub) els.todaySub.textContent = `${activeProfile() === "alek" ? "Alek" : "Cata"} · pendientes + hechas según filtros`;
    if (els.dayNotes) els.dayNotes.value = activeProfileData().logs[iso]?.notes || "";
    if (els.noteSaved) els.noteSaved.textContent = "guardado";

    setChipPressed(els.chipPending, state.pendingFirst);
    setChipPressed(els.chipShowDone, state.showDone);
    renderSidebarDayMeta();
    renderKPIs(iso);
    renderBalancePill(iso);
    renderDayPlan();
    bindDayPlan(iso);
    renderTimeTracker(iso);
    bindTimeTracker(iso);
    renderSmartPlanner();
    bindSmartPlanner(iso);

    const all = getFilteredActivities();
    const pending = all.filter(a => !isDoneFor(iso, a));
    const done = all.filter(a => isDoneFor(iso, a));
    const pendingList = state.pendingFirst ? pending : all.filter(a => !isDoneFor(iso, a));

    if (els.pendingList) els.pendingList.innerHTML = renderActivityCards(pendingList, iso);
    if (els.doneList) els.doneList.innerHTML = renderActivityCards(done, iso);
    if (els.pendingCount) els.pendingCount.textContent = String(pending.length);
    if (els.doneCount) els.doneCount.textContent = String(done.length);
    if (els.doneBucket) els.doneBucket.classList.toggle("hidden", !state.showDone || state.collapseDone);
    if (els.btnCollapseDone) els.btnCollapseDone.textContent = state.showDone ? (state.collapseDone ? "Hechas: ocultas" : "Hechas: ON") : "Hechas: OFF";

    bindCardDelegation(els.pendingList);
    bindCardDelegation(els.doneList);
    bindNotesAutosave(iso);
  }

  function bulkToggle(mode) {
    const iso = state.dateISO;
    const visible = getFilteredActivities().filter(a => mode === "check" ? !isDoneFor(iso, a) : isDoneFor(iso, a));
    visible.forEach(a => {
      setDoneFor(iso, a, mode === "check");
      if (mode === "uncheck") setLoggedDuration(iso, a.id, 0);
    });
    renderToday();
    toast(mode === "check" ? "Actividades visibles marcadas." : "Actividades visibles desmarcadas.", "ok");
  }

  function renderAgenda() {
    const year = state.agendaYear;
    const month = state.agendaMonth;
    const selected = state.agendaSelectedDay || state.dateISO;

    if (els.agendaMonthLabel) els.agendaMonthLabel.textContent = `${monthNamesFull[month]} ${year}`;

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const blanks = first.getDay();
    const cells = [];

    dayNames.forEach(name => cells.push(`<div class="calDayHeader">${escapeHTML(name)}</div>`));
    for (let i = 0; i < blanks; i++) cells.push(`<div class="calCell empty"></div>`);

    for (let day = 1; day <= last.getDate(); day++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const metrics = getDayMetrics(iso);
      const pct = Math.round(metrics.pctAll * 100);
      const lv = pct >= 85 ? "lv4" : pct >= 60 ? "lv3" : pct >= 30 ? "lv2" : pct > 0 ? "lv1" : "";
      const classes = ["calCell", lv, iso === todayISO() ? "isToday" : "", iso === selected ? "selected" : ""].filter(Boolean).join(" ");
      cells.push(`
        <button class="${classes}" type="button" data-day="${iso}" title="${escapeHTML(fmtDateLong(iso))}">
          <span class="calDay">${day}</span>
          <span class="calPct">${pct}%</span>
          <span class="calDur">${escapeHTML(fmtDurationMin(metrics.totalDurationDone))}</span>
        </button>
      `);
    }

    if (els.agendaCalendar) {
      els.agendaCalendar.innerHTML = `<div class="agendaCal">${cells.join("")}</div>`;
      $$('[data-day]', els.agendaCalendar).forEach(btn => {
        on(btn, "click", () => {
          state.agendaSelectedDay = btn.dataset.day;
          state.dateISO = btn.dataset.day;
          renderAgenda();
          renderSidebarDayMeta();
        });
      });
    }

    renderAgendaDayDetail(selected);
    renderAgendaSchedule(selected);
  }

  function renderAgendaDayDetail(iso) {
    if (!els.agendaDayDetail) return;
    const metrics = getDayMetrics(iso);
    const doneActs = getDoneActsForDay(iso);
    els.agendaDayDetail.innerHTML = `
      <div class="agendaDayHeader">
        <div>
          <div class="subTitle">${escapeHTML(fmtDateLong(iso))}</div>
          <div class="muted">Cumplimiento: ${escapeHTML(fmtPct01(metrics.pctAll))} · ${metrics.doneAll}/${metrics.totalAll}</div>
        </div>
        <button class="btn ghost" id="btnOpenSelectedDay" type="button">Ver en Hoy</button>
      </div>
      ${doneActs.length ? `
        <div class="scheduleList">
          ${doneActs.map(a => `<div class="scheduleItem"><div class="scheduleBar"></div><div class="scheduleInfo"><div class="scheduleName">${escapeHTML(a.name)}</div><div class="scheduleMeta"><span class="tag">${escapeHTML(a.category)}</span><span class="tag">${escapeHTML(a.type === "daily" ? "Diaria" : "Rotación")}</span></div></div></div>`).join("")}
        </div>
      ` : `<div class="emptyState">Ese día no tiene actividades marcadas.</div>`}
      ${metrics.notes ? `<div class="agendaNote" style="margin-top:10px">${escapeHTML(metrics.notes)}</div>` : ""}
    `;
    on(document.getElementById("btnOpenSelectedDay"), "click", () => setView("today"));
  }

  function renderAgendaSchedule(iso) {
    if (!els.agendaSchedule) return;
    const schedule = buildScheduleForDay(iso);
    const plan = getPlanFor(iso);

    /* El horario ahora muestra dos capas: lo previsto y lo que de verdad pasó. */
    const plannedHTML = plan.length
      ? `
        <div class="schedulePlanned">
          <div class="scheduleLayerLabel">Previsto</div>
          ${plan.map(block => {
            const activity = aById(block.activityId);
            if (!activity) return "";
            return `
              <div class="scheduleSlot isPlanned is-${escapeHTML(block.status)}">
                <div class="scheduleTime">${block.start ? escapeHTML(block.start) + (block.end ? " - " + escapeHTML(block.end) : "") : "En el día"}</div>
                <div class="scheduleBlock">
                  <div class="scheduleBlockTitle">${escapeHTML(activity.name)}</div>
                  <div class="scheduleBlockMeta">
                    <span class="tag">${escapeHTML(activity.category)}</span>
                    ${block.minutes ? `<span class="tag">${escapeHTML(fmtDurationMin(block.minutes))}</span>` : ""}
                    ${block.shared ? `<span class="tag tagShared">♥ Los dos</span>` : ""}
                    <span class="tag tagStatus">${escapeHTML(planStatusLabel(block.status))}</span>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `
      : "";

    if (!schedule.length) {
      els.agendaSchedule.innerHTML = plannedHTML
        ? plannedHTML + `<div class="scheduleEmpty">Todavía no hay nada registrado de este día.</div>`
        : `<div class="scheduleEmpty">Sin horario. Planea bloques desde Hoy, o registra horas para construirlo hacia atrás.</div>`;
      return;
    }

    els.agendaSchedule.innerHTML = plannedHTML + `
      <div class="scheduleTimeline">
        ${plan.length ? `<div class="scheduleLayerLabel">Lo que pasó</div>` : ""}
        ${schedule.map(item => `
          <div class="scheduleSlot">
            <div class="scheduleTime">${item.startText ? `${escapeHTML(item.startText)}${item.endText ? " - " + escapeHTML(item.endText) : ""}` : "Sin hora"}</div>
            <div class="scheduleBlock">
              <div class="scheduleBlockTitle">${escapeHTML(item.activity.name)}</div>
              <div class="scheduleBlockMeta">
                <span class="tag">${escapeHTML(item.activity.category)}</span>
                <span class="tag tagTime">${escapeHTML(fmtDurationMin(item.duration))}</span>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderWeek() {
    const start = state.weekStartISO || startOfWeekISO(todayISO());
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    if (els.weekSub) els.weekSub.textContent = `${fmtDateShort(days[0])} - ${fmtDateShort(days[6])}`;

    if (els.weekGrid) {
      els.weekGrid.innerHTML = days.map(iso => {
        const m = getDayMetrics(iso);
        return `
          <button class="dayCard" type="button" data-day="${iso}">
            <div class="dayName">${escapeHTML(dayNames[isoToDate(iso).getDay()])}</div>
            <div class="dayDate">${escapeHTML(fmtDateShort(iso))}</div>
            <div class="progress"><div class="bar" style="width:${Math.round(m.pctAll * 100)}%"></div></div>
            <div class="dayStats">${m.doneAll}/${m.totalAll} · ${escapeHTML(fmtDurationMin(m.totalDurationDone))}</div>
          </button>
        `;
      }).join("");
      $$('[data-day]', els.weekGrid).forEach(btn => {
        on(btn, "click", () => {
          state.dateISO = btn.dataset.day;
          state.agendaSelectedDay = btn.dataset.day;
          setView("today");
        });
      });
    }

    /* Plan de la semana: siete columnas donde se reparte lo que se quiere hacer. */
    if (els.weekPlanGrid) {
      els.weekPlanGrid.innerHTML = `
        <div class="weekPlan">
          ${days.map(iso => {
            const plan = getPlanFor(iso);
            const m = getPlanMetrics(iso);
            const isToday = iso === todayISO();

            return `
              <div class="weekPlanDay ${isToday ? "isToday" : ""}">
                <div class="weekPlanHead">
                  <span class="weekPlanName">${escapeHTML(dayNames[isoToDate(iso).getDay()])}</span>
                  <span class="weekPlanDate">${escapeHTML(fmtDateShort(iso))}</span>
                </div>

                ${plan.length
                  ? `<div class="weekPlanCount">${m.done}/${m.total}</div>`
                  : `<div class="weekPlanCount isEmpty">—</div>`
                }

                <div class="weekPlanList">
                  ${plan.map(block => {
                    const activity = aById(block.activityId);
                    if (!activity) return "";
                    return `
                      <div class="weekPlanItem is-${escapeHTML(block.status)}" title="${escapeHTML(activity.name)}">
                        ${block.start ? `<span class="weekPlanTime">${escapeHTML(block.start)}</span>` : ""}
                        <span class="weekPlanTitle">${escapeHTML(activity.name)}</span>
                        ${block.shared ? `<span class="weekPlanShared" title="Plan de los dos">♥</span>` : ""}
                      </div>
                    `;
                  }).join("")}
                </div>

                <button class="weekPlanAdd" type="button" data-week-plan="add" data-day="${escapeHTML(iso)}" title="Añadir al plan de este día">
                  + Añadir
                </button>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    /* Lo que la semana pide pero todavía no tiene día. */
    if (els.weekUnscheduled) {
      const loose = getUnscheduledForWeek(start);
      els.weekUnscheduled.innerHTML = loose.length
        ? `
          <div class="looseHint">Actividades de rotación que esta semana no se han hecho ni tienen día asignado.</div>
          <div class="looseList">
            ${loose.map(a => `
              <button class="looseItem" type="button" data-week-plan="assign" data-activity="${escapeHTML(a.id)}" title="Darle un día a esta actividad">
                <span class="looseName">${escapeHTML(a.name)}</span>
                <span class="tag">${escapeHTML(a.category)}</span>
                <span class="looseCta">Darle día</span>
              </button>
            `).join("")}
          </div>
        `
        : `<div class="emptyState">Todo lo de rotación ya está hecho o tiene día. Buena semana.</div>`;
    }

    bindWeekPlan();

    if (els.weekByDay) {
      els.weekByDay.innerHTML = days.map(iso => {
        const m = getDayMetrics(iso);
        return `<div class="row"><span>${escapeHTML(fmtDateShort(iso))}</span><strong>${m.doneAll}/${m.totalAll} · ${escapeHTML(fmtPct01(m.pctAll))}</strong></div>`;
      }).join("");
    }

    if (els.weekByCategory) {
      const metrics = computeMetrics({ rangeDays: 7 });
      els.weekByCategory.innerHTML = metrics.byCategory.length
        ? metrics.byCategory.map(c => `<div class="row"><span>${escapeHTML(c.cat)}</span><strong>${c.done}/${c.total} · ${escapeHTML(fmtPct01(c.pct))}</strong></div>`).join("")
        : `<div class="emptyState">No hay categorías todavía.</div>`;
    }

    if (els.weekInsight) {
      const avgWeek = avg(days.map(iso => getDayMetrics(iso).pctAll));
      els.weekInsight.textContent = `Promedio semanal: ${fmtPct01(avgWeek)}. ${avgWeek >= 0.7 ? "Semana bastante sostenida." : avgWeek >= 0.35 ? "Semana con movimiento, pero irregular." : "Semana bajita. No drama, pero sí lectura honesta."}`;
    }
  }

  /* Elegir a qué día de la semana mandar una actividad suelta. */
  function openAssignDayModal(activityId) {
    const activity = aById(activityId);
    if (!activity) return;

    const start = state.weekStartISO || startOfWeekISO(todayISO());
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

    modalOpen({
      title: `¿Qué día? · ${activity.name}`,
      desc: "Queda planeado para ese día, sin hora. Puedes darle hora después.",
      contentHTML: `
        <div class="assignDays">
          ${days.map(iso => `
            <button class="assignDay ${iso === todayISO() ? "isToday" : ""}" type="button" data-assign-day="${escapeHTML(iso)}">
              <span class="assignDayName">${escapeHTML(dayNames[isoToDate(iso).getDay()])}</span>
              <span class="assignDayDate">${escapeHTML(fmtDateShort(iso))}</span>
              <span class="assignDayCount">${getPlanFor(iso).length || 0} en el plan</span>
            </button>
          `).join("")}
        </div>
      `,
      actions: [{ label: "Cancelar", kind: "ghost", onClick: modalClose }],
    });

    $$("[data-assign-day]", els.modalContent).forEach(btn => {
      on(btn, "click", () => {
        const iso = btn.dataset.assignDay;
        addPlannedBlock(iso, { activityId, start: null, minutes: 0, note: "", shared: false });
        modalClose();
        renderWeek();
        toast(`${activity.name} quedó en el plan del ${fmtDateShort(iso)}.`, "ok");
      });
    });
  }

  function bindWeekPlan() {
    if (!els.viewWeek || els.viewWeek.__boundWeekPlan) return;
    els.viewWeek.__boundWeekPlan = true;

    on(els.viewWeek, "click", e => {
      const btn = e.target.closest("[data-week-plan]");
      if (!btn) return;

      if (btn.dataset.weekPlan === "add") {
        openPlanBlockModal(btn.dataset.day);
        return;
      }

      if (btn.dataset.weekPlan === "assign") {
        openAssignDayModal(btn.dataset.activity);
      }
    });
  }

  function renderHistory() {
    const rangeDays = safeNumber(els.historyRange?.value, 30);
    const metrics = computeMetrics({ rangeDays });

    if (els.historySummary) {
      els.historySummary.innerHTML = `
        <div class="summaryCard"><strong>Promedio diario:</strong> ${escapeHTML(fmtPct01(metrics.avgDaily))}</div>
        <div class="summaryCard"><strong>Días activos:</strong> ${metrics.activeDays}/${metrics.rangeDays}</div>
        <div class="summaryCard"><strong>Tiempo registrado:</strong> ${escapeHTML(fmtDurationMin(metrics.totalDuration))}</div>
        <div class="summaryCard"><strong>Días con notas:</strong> ${metrics.noteDays}</div>
      `;
    }

    if (els.historyTrendHint) els.historyTrendHint.textContent = `Tendencia de cumplimiento en los últimos ${rangeDays} días.`;
    drawLineChart(els.chartHistoryTrend, metrics.byDay.map(d => Math.round(d.pctAll * 100)));

    if (els.historyCalendar) {
      const rows = [];
      for (let i = 0; i < metrics.byDay.length; i += 7) {
        rows.push(`<div class="heatmapRow">${metrics.byDay.slice(i, i + 7).map(d => {
          const pct = Math.round(d.pctAll * 100);
          const lv = pct >= 85 ? "lv4" : pct >= 60 ? "lv3" : pct >= 30 ? "lv2" : pct > 0 ? "lv1" : "";
          return `<div class="heatCell ${lv}" title="${escapeHTML(fmtDateLong(d.iso))}: ${pct}%">${isoToDate(d.iso).getDate()}</div>`;
        }).join("")}</div>`);
      }
      els.historyCalendar.innerHTML = `<div class="heatmap">${rows.join("")}</div>`;
    }

    if (els.historyHighlights) {
      els.historyHighlights.innerHTML = `
        <div class="highlightItem good"><strong>Mejor día:</strong> ${metrics.bestDay ? `${escapeHTML(fmtDateShort(metrics.bestDay.iso))} · ${escapeHTML(fmtPct01(metrics.bestDay.pctAll))}` : "—"}</div>
        <div class="highlightItem bad"><strong>Día más bajo:</strong> ${metrics.worstDay ? `${escapeHTML(fmtDateShort(metrics.worstDay.iso))} · ${escapeHTML(fmtPct01(metrics.worstDay.pctAll))}` : "—"}</div>
        <div class="highlightItem warn"><strong>Días vacíos:</strong> ${metrics.emptyDays}</div>
      `;
    }

    if (els.historyTimeline) {
      els.historyTimeline.innerHTML = metrics.byDay.slice().reverse().map(d => `
        <div class="timelineItem">
          <strong>${escapeHTML(fmtDateShort(d.iso))}</strong> · ${d.doneAll}/${d.totalAll} · ${escapeHTML(fmtPct01(d.pctAll))}
          ${d.notes ? `<div class="tiny">${escapeHTML(d.notes)}</div>` : ""}
        </div>
      `).join("");
    }

    if (els.historyTopActivities) {
      els.historyTopActivities.innerHTML = metrics.topActivities.slice(0, 8).map(a => `
        <div class="topItem"><strong>${escapeHTML(a.name)}</strong><div class="tiny">${a.done}/${a.total} · ${escapeHTML(a.cat)}</div></div>
      `).join("") || `<div class="emptyState">Todavía no hay actividades.</div>`;
    }
  }

  function renderStats() {
    const rangeDays = safeNumber(els.statsRange?.value, 30);
    const metrics = computeMetrics({ rangeDays });

    if (els.statsConsistency) {
      els.statsConsistency.innerHTML = `
        <div class="statCard"><strong>Promedio diarias:</strong> ${escapeHTML(fmtPct01(metrics.avgDaily))}</div>
        <div class="statCard"><strong>Racha actual:</strong> ${metrics.streakCurrent} días</div>
        <div class="statCard"><strong>Mejor racha:</strong> ${metrics.streakBest} días</div>
        <div class="statCard"><strong>Días activos:</strong> ${metrics.activeDays}/${metrics.rangeDays}</div>
      `;
    }

    drawBarsChart(els.chartDone, [metrics.activeDays, metrics.emptyDays], ["Activos", "Vacíos"]);

    if (els.statsByCategory) {
      els.statsByCategory.innerHTML = metrics.byCategory.length
        ? metrics.byCategory.map(c => `<div class="row"><span>${escapeHTML(c.cat)}</span><strong>${c.done}/${c.total} · ${escapeHTML(fmtPct01(c.pct))}</strong></div>`).join("")
        : `<div class="emptyState">No hay categorías todavía.</div>`;
    }

    drawBarsChart(els.chartBalance, [Math.round(metrics.balance.carga * 10), Math.round(metrics.balance.descanso * 10)], ["Carga", "Descanso"]);
    if (els.chartBalanceHint) els.chartBalanceHint.textContent = `Descanso aproximado: ${fmtPct01(metrics.balance.restRatio)}.`;

    drawBarsChart(els.chartEnergy, [metrics.energy.low, metrics.energy.mid, metrics.energy.high, metrics.energy.none], ["Baja", "Media", "Alta", "N/A"]);
    if (els.chartEnergyHint) els.chartEnergyHint.textContent = "Distribución de energía de las actividades activas.";

    if (els.statsAvoided) {
      els.statsAvoided.innerHTML = metrics.avoidedActivities.slice(0, 8).map(a => `
        <div class="topItem"><strong>${escapeHTML(a.name)}</strong><div class="tiny">${a.done}/${a.total} · ${escapeHTML(fmtPct01(a.pct))}</div></div>
      `).join("") || `<div class="emptyState">Nada olvidado todavía. Sospechoso, pero bonito.</div>`;
    }

    if (els.statsTopActivities) {
      els.statsTopActivities.innerHTML = metrics.topActivities.slice(0, 8).map(a => `
        <div class="topItem"><strong>${escapeHTML(a.name)}</strong><div class="tiny">${a.done}/${a.total} · ${escapeHTML(fmtPct01(a.pct))}</div></div>
      `).join("") || `<div class="emptyState">Todavía no hay top.</div>`;
    }

    if (els.statsNarrative) {
      const msg = metrics.avgAll >= 0.7
        ? "El período se ve bastante sostenido. No perfecto, porque eso suena agotador, pero sí consistente."
        : metrics.avgAll >= 0.35
          ? "Hay movimiento, pero también bastante variación. Sirve revisar qué categorías se caen primero."
          : "El período está bajo. Más que regañarse, conviene simplificar la lista y dejar lo esencial.";
      els.statsNarrative.innerHTML = `<div class="narrativeBox">${escapeHTML(msg)}</div>`;
    }
  }

  function renderManage() {
    if (!els.manageList) return;
    const list = getFilteredActivities({ forManage: true });
    els.manageList.innerHTML = list.length ? list.map(a => `
      <div class="manageItem ${a.status === "archived" ? "isArchived" : ""}">
        <div>
          <div class="manageName">${escapeHTML(a.name)}</div>
          <div class="manageMeta">${escapeHTML(a.category)}${a.subcategory ? " · " + escapeHTML(a.subcategory) : ""} · ${a.type === "daily" ? "Diaria" : "Rotación semanal"}${a.energy ? " · " + escapeHTML(energyLabel(a.energy)) : ""}${a.status === "archived" ? " · Archivada" : ""}</div>
        </div>
        <div class="smallBtns">
          <button class="small" type="button" data-action="edit" data-id="${escapeHTML(a.id)}">Editar</button>
          <button class="small" type="button" data-action="toggle-archive" data-id="${escapeHTML(a.id)}">${a.status === "archived" ? "Restaurar" : "Archivar"}</button>
          <button class="small danger" type="button" data-action="delete" data-id="${escapeHTML(a.id)}">Borrar</button>
        </div>
      </div>
    `).join("") : `<div class="emptyState">No hay actividades. Firebase está vacío o el filtro se pasó de intenso.</div>`;

    $$('[data-action]', els.manageList).forEach(btn => {
      on(btn, "click", () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === "edit") openEdit(id);
        if (action === "toggle-archive") toggleArchive(id);
        if (action === "delete") confirmDeleteActivity(id);
      });
    });
  }

  function openAdd() {
    state.editId = null;
    if (els.manageForm) els.manageForm.classList.remove("hidden");
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
    if (els.manageForm) els.manageForm.classList.remove("hidden");
    if (els.mName) els.mName.value = a.name;
    if (els.mCategory) els.mCategory.value = a.category;
    if (els.mType) els.mType.value = a.type;
    if (els.mSub) els.mSub.value = a.subcategory || "";
    if (els.mEnergy) els.mEnergy.value = a.energy || "__none__";
    els.mName?.focus();
  }

  function closeForm() {
    state.editId = null;
    els.manageForm?.classList.add("hidden");
  }

  function saveActivityFromForm() {
    const data = normalizeActivity({
      id: state.editId || uid(),
      name: els.mName?.value,
      category: els.mCategory?.value,
      type: els.mType?.value,
      subcategory: els.mSub?.value,
      energy: els.mEnergy?.value === "__none__" ? undefined : els.mEnergy?.value,
      status: state.editId ? aById(state.editId)?.status : "active",
    });

    if (!data.name || data.name === "Sin nombre") return toast("Ponle nombre a la actividad, tampoco pidamos telepatía.", "warn");

    const idx = db.activities.findIndex(a => a.id === data.id);
    if (idx >= 0) db.activities[idx] = { ...db.activities[idx], ...data };
    else db.activities.push(data);

    closeForm();
    rebuildCategoryFilter();
    saveDB();
    renderManage();
    renderToday();
    toast("Actividad guardada en Firebase.", "ok");
  }

  function toggleArchive(id) {
    const a = aById(id);
    if (!a) return;
    a.status = a.status === "archived" ? "active" : "archived";
    a.archivedAt = a.status === "archived" ? nowISODate() : null;
    saveDB();
    rebuildCategoryFilter();
    renderManage();
    renderToday();
  }

  function confirmDeleteActivity(id) {
    const a = aById(id);
    if (!a) return;
    modalOpen({
      title: "Borrar actividad",
      desc: `Esto borrará "${a.name}" de la lista. Los registros históricos pueden quedar con referencias antiguas. Qué delicado todo, como cirugía con CSS.`,
      actions: [
        { label: "Cancelar", kind: "ghost", onClick: modalClose },
        {
          label: "Borrar",
          kind: "danger",
          onClick: () => {
            db.activities = db.activities.filter(x => x.id !== id);
            saveDB();
            modalClose();
            rebuildCategoryFilter();
            renderManage();
            renderToday();
            toast("Actividad borrada.", "ok");
          },
        },
      ],
    });
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(migrateDB(db), null, 2)], { type: "application/json;charset=utf-8" });
    downloadBlob(blob, `bitacora-firebase-${todayISO()}.json`);
  }

  function exportCSV() {
    const rows = [["perfil", "fecha", "actividad", "categoria", "tipo", "hecha", "hora", "minutos", "notas"]];
    PROFILES.forEach(profile => {
      const oldProfile = state.profile;
      state.profile = profile;
      const pd = activeProfileData();
      Object.keys(pd.logs || {}).sort().forEach(iso => {
        activeActivities().forEach(a => {
          rows.push([
            profile,
            iso,
            a.name,
            a.category,
            a.type,
            isDoneFor(iso, a) ? "sí" : "no",
            getDoneTimeFor(iso, a) || "",
            getLoggedDuration(iso, a.id) || 0,
            pd.logs[iso]?.notes || "",
          ]);
        });
      });
      state.profile = oldProfile;
    });
    const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `bitacora-${todayISO()}.csv`);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importJSONFile(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      db = migrateDB(parsed);
      touchMeta();
      await saveDB();
      rebuildCategoryFilter();
      renderCurrentView();
      toast("JSON importado y guardado en Firebase.", "ok");
    } catch (error) {
      console.warn("[Bitácora] import error:", error);
      toast("No se pudo importar el JSON. Revisa el archivo.", "err");
    }
  }

  function wipeAll() {
    modalOpen({
      title: "Borrar datos de Firebase",
      desc: "Esto borra la base actual en Firebase para esta app. No hay respaldo mágico escondido en el navegador, porque quedamos en portarnos serios.",
      actions: [
        { label: "Cancelar", kind: "ghost", onClick: modalClose },
        {
          label: "Borrar Firebase",
          kind: "danger",
          onClick: async () => {
            try {
              if (window.BitacoraCloud?.wipe) await window.BitacoraCloud.wipe();
              else await window.BitacoraCloud.save(null);
              db = emptyDB();
              modalClose();
              rebuildCategoryFilter();
              renderCurrentView();
              setCloudStatus("empty");
              toast("Datos borrados de Firebase.", "ok");
            } catch (error) {
              console.warn("[Bitácora] wipe error:", error);
              toast("No se pudo borrar Firebase.", "err");
            }
          },
        },
      ],
    });
  }

  function renderSettings() {
    if (els.appInfo) {
      const updatedAt = db?.meta?.updatedAt ? new Date(db.meta.updatedAt).toLocaleString("es-CO") : "sin registro";
      els.appInfo.textContent = `Firebase · esquema v${DB_SCHEMA} · ${db.activities.length} actividades · bloques de ${DURATION_STEP} min · última actualización: ${updatedAt}`;
    }
    const hasLogs = Object.values(db.profiles || {}).some(p => Object.keys(p?.logs || {}).length);
    if (!db.activities?.length && !hasLogs) setCloudStatus("empty");
    else setCloudStatus("ready");
  }

  function renderCurrentView() {
    if (!db) return;
    updateProfileToggleUI();
    renderSidebarDayMeta();
    updateTabsUI(state.view);
    if (state.view === "today") renderToday();
    else if (state.view === "agenda") renderAgenda();
    else if (state.view === "week") renderWeek();
    else if (state.view === "history") renderHistory();
    else if (state.view === "stats") renderStats();
    else if (state.view === "manage") renderManage();
    else if (state.view === "settings") renderSettings();
    else renderToday();
  }

  function bindEvents() {
    Object.entries(TAB_MAP).forEach(([key, obj]) => on(obj.btn, "click", () => setView(key)));
    bindTabsKeyboard();

    on(els.btnProfileAlek, "click", () => setProfile("alek"));
    on(els.btnProfileCata, "click", () => setProfile("cata"));

    on(els.prevDay, "click", () => {
      state.dateISO = addDays(state.dateISO, -1);
      state.agendaSelectedDay = state.dateISO;
      renderCurrentView();
    });

    on(els.nextDay, "click", () => {
      state.dateISO = addDays(state.dateISO, 1);
      state.agendaSelectedDay = state.dateISO;
      renderCurrentView();
    });

    on(els.search, "input", () => renderToday());
    on(els.categoryFilter, "change", () => renderToday());
    on(els.modeFilter, "change", () => renderToday());
    on(els.energyFilter, "change", () => renderToday());

    on(els.chipPending, "click", () => {
      state.pendingFirst = !getChipPressed(els.chipPending);
      renderToday();
    });

    on(els.chipShowDone, "click", () => {
      state.showDone = !getChipPressed(els.chipShowDone);
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
      renderToday();
    });

    on(els.btnCollapseDone, "click", () => {
      state.collapseDone = !state.collapseDone;
      renderToday();
    });

    on(els.btnCheckAll, "click", () => bulkToggle("check"));
    on(els.btnUncheckAll, "click", () => bulkToggle("uncheck"));

    on(els.prevMonth, "click", () => {
      const d = new Date(state.agendaYear, state.agendaMonth - 1, 1);
      state.agendaYear = d.getFullYear();
      state.agendaMonth = d.getMonth();
      state.agendaSelectedDay = `${state.agendaYear}-${String(state.agendaMonth + 1).padStart(2, "0")}-01`;
      state.dateISO = state.agendaSelectedDay;
      renderAgenda();
    });

    on(els.nextMonth, "click", () => {
      const d = new Date(state.agendaYear, state.agendaMonth + 1, 1);
      state.agendaYear = d.getFullYear();
      state.agendaMonth = d.getMonth();
      state.agendaSelectedDay = `${state.agendaYear}-${String(state.agendaMonth + 1).padStart(2, "0")}-01`;
      state.dateISO = state.agendaSelectedDay;
      renderAgenda();
    });

    on(els.prevWeek, "click", () => {
      state.weekStartISO = addDays(state.weekStartISO, -7);
      renderWeek();
    });

    on(els.nextWeek, "click", () => {
      state.weekStartISO = addDays(state.weekStartISO, 7);
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

  async function init() {
    try {
      state = createDefaultState();
      applyTheme();
      updateProfileToggleUI();
      updateTabsUI(state.view);
      bindEvents();
      db = await loadDBFromCloud();
      db = migrateDB(db);
      rebuildCategoryFilter();
      renderCurrentView();
      if (db.meta?.needsDefaultActivitySync) {
        db.meta.needsDefaultActivitySync = false;
        saveDB();
      }
    } catch (error) {
      console.warn("[Bitácora] init error:", error);
      db = emptyDB();
      setCloudStatus("error", "No se pudo cargar Firebase. La app queda vacía para evitar mezclar datos raros.");
      rebuildCategoryFilter();
      renderCurrentView();
      toast("No se pudo cargar Firebase. Revisa firebase.js, reglas o consola.", "err");
    } finally {
      hideBoot();
    }
  }

  init();
})();

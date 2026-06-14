/* Bitacora utils: funciones puras reutilizables. */
(() => {
  "use strict";

  window.BitacoraModules = window.BitacoraModules || {};

  const { DURATION_STEP, monthNamesShort } = window.BitacoraModules.config;

  function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function nowISODate() {
    return new Date().toISOString();
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
    d.setDate(d.getDate() - d.getDay());
    return todayISO(d);
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

  function sortByLocale(a, b) {
    return String(a).localeCompare(String(b), "es");
  }

  function unique(arr) {
    return [...new Set(arr)];
  }

  function sum(arr) {
    return arr.reduce((acc, n) => acc + safeNumber(n, 0), 0);
  }

  function avg(arr) {
    return arr.length ? sum(arr) / arr.length : 0;
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

  function nowHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function parseDoneTime(val) {
    if (typeof val === "string" && /^\d{2}:\d{2}$/.test(val)) return val;
    return null;
  }

  function clockToMinutes(hhmm) {
    const t = parseDoneTime(hhmm);
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function toClock(totalMinutes) {
    const mins = ((safeNumber(totalMinutes, 0) % 1440) + 1440) % 1440;
    const h = String(Math.floor(mins / 60)).padStart(2, "0");
    const m = String(mins % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  function energyLabel(v) {
    if (v === "low") return "Energía baja";
    if (v === "mid") return "Energía media";
    if (v === "high") return "Energía alta";
    return "Sin energía";
  }

  window.BitacoraModules.utils = {
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
    roundToStep,
    ensureStep,
    fmtDurationMin,
    nowHHMM,
    parseDoneTime,
    clockToMinutes,
    toClock,
    energyLabel,
  };
})();

/* Bitacora config: datos base y constantes compartidas. */
(() => {
  "use strict";

  window.BitacoraModules = window.BitacoraModules || {};

  window.BitacoraModules.config = {
    DB_SCHEMA: 7,
    PROFILES: ["alek", "cata"],
    DURATION_STEP: 15,
    MAX_ENTRY_MINUTES: 24 * 60,
    RUNTIME_ID: `session_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`,
    DEFAULT_ACTIVITIES: [
      { id: "default_sleep", name: "Dormir", category: "Descanso", subcategory: "Sueño", type: "daily", energy: "low" },
      { id: "default_breakfast", name: "Desayunar", category: "Comida", subcategory: "Desayuno", type: "daily", energy: "mid" },
      { id: "default_lunch", name: "Almorzar", category: "Comida", subcategory: "Almuerzo", type: "daily", energy: "mid" },
      { id: "default_dinner", name: "Cenar", category: "Comida", subcategory: "Cena", type: "daily", energy: "low" },
    ],
    ROUTINE_PROMPTS: [
      { key: "breakfast", activityId: "default_breakfast", label: "desayunar", question: "A esta hora sueles desayunar. ¿Ya desayunaste?", start: "09:00", end: "11:00", minutes: 30 },
      { key: "lunch", activityId: "default_lunch", label: "almorzar", question: "A esta hora sueles almorzar. ¿Ya almorzaste?", start: "12:00", end: "14:00", minutes: 60 },
      { key: "dinner", activityId: "default_dinner", label: "cenar", question: "A esta hora sueles cenar. ¿Ya cenaste?", start: "20:00", end: "22:00", minutes: 45 },
    ],
    dayNames: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    monthNamesShort: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    monthNamesFull: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
  };
})();

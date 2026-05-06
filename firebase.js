/* firebase.js — Planeación Morchis
   Firebase Compat SDK (sin bundler, vía CDN)
   Proyecto: bitacora-de-planeacion-morchis
   ---
   Expone window.BitacoraCloud con:
     .ready       → boolean
     .load()      → Promise<data|null>
     .save(data)  → Promise<void>
     .wipe()      → Promise<void>
*/

(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyAcSUZDZDy3BEsf8aCzBSUGSUL4WMgMnQo",
    authDomain: "bitacora-de-planeacion-morchis.firebaseapp.com",
    projectId: "bitacora-de-planeacion-morchis",
    storageBucket: "bitacora-de-planeacion-morchis.firebasestorage.app",
    messagingSenderId: "975319732972",
    appId: "1:975319732972:web:b651c76fac942fcb1f4bc9",
  };

  const NOOP = () => {};
  const fallback = {
    ready: false,
    load: async () => null,
    save: async () => NOOP(),
    wipe: async () => NOOP(),
  };

  try {
    if (typeof firebase === "undefined") {
      console.warn("[BitacoraCloud] Firebase SDK no cargó. Modo offline.");
      window.BitacoraCloud = fallback;
      return;
    }

    // Evita inicializar dos veces (hot-reload)
    const app =
      firebase.apps.length
        ? firebase.apps[0]
        : firebase.initializeApp(firebaseConfig);

    const fs = firebase.firestore(app);
    const DOC = fs.doc("bitacora/main");

    window.BitacoraCloud = {
      ready: true,

      async load() {
        try {
          const snap = await DOC.get();
          return snap.exists ? snap.data() : null;
        } catch (e) {
          console.warn("[BitacoraCloud] load error:", e.message);
          throw e;
        }
      },

      async save(data) {
        try {
          // Firestore no acepta undefined → limpiar antes de escribir
          const clean = JSON.parse(JSON.stringify(data));
          await DOC.set(clean);
        } catch (e) {
          console.warn("[BitacoraCloud] save error:", e.message);
          throw e;
        }
      },

      async wipe() {
        try {
          await DOC.delete();
        } catch (e) {
          console.warn("[BitacoraCloud] wipe error:", e.message);
          throw e;
        }
      },
    };

    console.log("[BitacoraCloud] Firebase listo ✅");
  } catch (e) {
    console.warn("[BitacoraCloud] Error al inicializar Firebase:", e.message);
    window.BitacoraCloud = fallback;
  }
})();

// seed.js
// Bitácora - Alek & Cata
// Seed inicial.
// Si ya existe data guardada en localStorage, esto NO la pisa.
// Solo sirve como base para primeras cargas o reinicios.

(function () {
  const seed = [
    /* ======================================================
       TRABAJO / PROYECTOS
    ====================================================== */
    {
      name: "Musicala",
      category: "Trabajo",
      subcategory: "Musicala",
      type: "daily",
      energy: "high",
      duration: 120,
    },
    {
      name: "Planeación",
      category: "Trabajo",
      subcategory: "Organización",
      type: "complement",
      energy: "mid",
      duration: 45,
    },
    {
      name: "Administración",
      category: "Trabajo",
      subcategory: "Gestión",
      type: "complement",
      energy: "high",
      duration: 60,
    },
    {
      name: "Finanzas",
      category: "Trabajo",
      subcategory: "Control",
      type: "complement",
      energy: "high",
      duration: 40,
    },

    /* ======================================================
       APRENDIZAJE / CREACIÓN
    ====================================================== */
    {
      name: "Música",
      category: "Aprendizaje",
      subcategory: "Música",
      type: "daily",
      energy: "mid",
      duration: 45,
    },
    {
      name: "Arte",
      category: "Aprendizaje",
      subcategory: "Arte",
      type: "complement",
      energy: "mid",
      duration: 45,
    },
    {
      name: "Dibujo",
      category: "Aprendizaje",
      subcategory: "Visual",
      type: "complement",
      energy: "mid",
      duration: 40,
    },
    {
      name: "Animación",
      category: "Aprendizaje",
      subcategory: "Visual",
      type: "complement",
      energy: "high",
      duration: 60,
    },
    {
      name: "Programación",
      category: "Aprendizaje",
      subcategory: "Tecnología",
      type: "complement",
      energy: "high",
      duration: 60,
    },
    {
      name: "Pedagogía",
      category: "Aprendizaje",
      subcategory: "Formación",
      type: "complement",
      energy: "mid",
      duration: 40,
    },
    {
      name: "Psicología",
      category: "Aprendizaje",
      subcategory: "Humano",
      type: "complement",
      energy: "mid",
      duration: 35,
    },
    {
      name: "Tejer",
      category: "Aprendizaje",
      subcategory: "Manual",
      type: "complement",
      energy: "low",
      duration: 40,
    },
    {
      name: "Pepitas",
      category: "Aprendizaje",
      subcategory: "Curiosidad",
      type: "complement",
      energy: "low",
      duration: 20,
    },

    /* ======================================================
       IDIOMAS
    ====================================================== */
    {
      name: "Idiomas",
      category: "Idiomas",
      subcategory: "General",
      type: "complement",
      energy: "mid",
      duration: 30,
    },
    {
      name: "Francés",
      category: "Idiomas",
      subcategory: "Francés",
      type: "complement",
      energy: "mid",
      duration: 30,
    },
    {
      name: "Inglés",
      category: "Idiomas",
      subcategory: "Inglés",
      type: "complement",
      energy: "mid",
      duration: 30,
    },
    {
      name: "Italiano",
      category: "Idiomas",
      subcategory: "Italiano",
      type: "complement",
      energy: "mid",
      duration: 30,
    },

    /* ======================================================
       SALUD / CUERPO / CUIDADO
    ====================================================== */
    {
      name: "Deporte",
      category: "Salud",
      subcategory: "Movimiento",
      type: "complement",
      energy: "high",
      duration: 45,
    },
    {
      name: "Patinar",
      category: "Salud",
      subcategory: "Movimiento",
      type: "complement",
      energy: "high",
      duration: 50,
    },
    {
      name: "Meditación",
      category: "Salud",
      subcategory: "Mental",
      type: "complement",
      energy: "low",
      duration: 15,
    },
    {
      name: "Citas médicas",
      category: "Salud",
      subcategory: "Cuidado",
      type: "complement",
      energy: "mid",
      duration: 60,
    },

    /* ======================================================
       ALIMENTACIÓN
    ====================================================== */
    {
      name: "Desayuno consciente",
      category: "Alimentación",
      subcategory: "Desayuno",
      type: "daily",
      energy: "low",
      duration: 20,
    },
    {
      name: "Almuerzo consciente",
      category: "Alimentación",
      subcategory: "Almuerzo",
      type: "daily",
      energy: "low",
      duration: 30,
    },
    {
      name: "Comida / Cena",
      category: "Alimentación",
      subcategory: "Cena",
      type: "daily",
      energy: "low",
      duration: 25,
    },

    /* ======================================================
       HOGAR / VIDA PRÁCTICA
    ====================================================== */
    {
      name: "Limpieza",
      category: "Hogar",
      subcategory: "Orden",
      type: "complement",
      energy: "mid",
      duration: 30,
    },
    {
      name: "Organización",
      category: "Hogar",
      subcategory: "Orden",
      type: "complement",
      energy: "mid",
      duration: 25,
    },
    {
      name: "Transporte",
      category: "Hogar",
      subcategory: "Movilidad",
      type: "complement",
      energy: "mid",
      duration: 30,
    },

    /* ======================================================
       VÍNCULO / AFECTO / VIDA COMPARTIDA
    ====================================================== */
    {
      name: "Compartir",
      category: "Relación",
      subcategory: "Tiempo juntos",
      type: "daily",
      energy: "low",
      duration: 30,
    },
    {
      name: "B'shert",
      category: "Relación",
      subcategory: "Afecto",
      type: "complement",
      energy: "low",
      duration: 20,
    },

    /* ======================================================
       DESCANSO / DISFRUTE
    ====================================================== */
    {
      name: "Videojuegos",
      category: "Disfrute",
      subcategory: "Videojuegos",
      type: "daily",
      energy: "low",
      duration: 45,
    },
    {
      name: "Juegos de mesa",
      category: "Disfrute",
      subcategory: "Juegos de mesa",
      type: "complement",
      energy: "low",
      duration: 60,
    },
    {
      name: "Lectura",
      category: "Disfrute",
      subcategory: "Lectura",
      type: "daily",
      energy: "low",
      duration: 25,
    },
    {
      name: "Escritura",
      category: "Disfrute",
      subcategory: "Escritura",
      type: "complement",
      energy: "mid",
      duration: 30,
    },
    {
      name: "Series / Películas",
      category: "Disfrute",
      subcategory: "Audiovisual",
      type: "complement",
      energy: "low",
      duration: 60,
    },
    {
      name: "Dispersión",
      category: "Disfrute",
      subcategory: "Recreación",
      type: "complement",
      energy: "low",
      duration: 30,
    },
    {
      name: "Descanso",
      category: "Descanso",
      subcategory: "Recuperación",
      type: "daily",
      energy: "low",
      duration: 20,
    },

    /* ======================================================
       CUIDADO / OTROS SERES
    ====================================================== */
    {
      name: "Mascotas",
      category: "Cuidado",
      subcategory: "Mascotas",
      type: "daily",
      energy: "low",
      duration: 20,
    },

    /* ======================================================
       META / REGISTRO ESPECIAL
    ====================================================== */
    {
      name: "Tiempo de error",
      category: "Registro",
      subcategory: "Tiempo de error",
      type: "daily",
      energy: "low",
      duration: 10,
    },
  ];

  // Nombre nuevo principal
  window.BITACORA_SEED = seed;

  // Alias de compatibilidad con versiones viejas del app.js
  window.RITUAL_SEED = seed;
})();
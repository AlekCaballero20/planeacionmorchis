// seed.js
// Si ya existe data guardada, no pisa nada.

window.RITUAL_SEED = [
  // Trabajo
  { name: "Musicala", category: "Trabajo", subcategory: "Musicala", type: "daily" },
  
  // Entretenimiento
  { name: "Videojuegos", category: "Entretenimiento", subcategory: "Videojuegos", type: "daily" },
  { name: "Juegos de mesa", category: "Entretenimiento", subcategory: "Juegos de mesa", type: "daily" },
  { name: "Lectura", category: "Entretenimiento", subcategory: "Lectura", type: "daily" },
  { name: "Escritura", category: "Entretenimiento", subcategory: "Escritura", type: "daily" },
  { name: "Series/Películas", category: "Entretenimiento", subcategory: "Series/Películas", type: "daily" },
  
  // Educación (complementario por defecto según tu lista)
  { name: "Arte", category: "Educación", subcategory: "Arte", type: "complement" },
  { name: "Música", category: "Educación", subcategory: "Música", type: "daily" },
  { name: "Dibujo", category: "Educación", subcategory: "Dibujo", type: "complement" },
  { name: "Animación", category: "Educación", subcategory: "Animación", type: "complement" },
  { name: "Tejer", category: "Educación", subcategory: "Tejer", type: "complement" },
  { name: "Pepitas", category: "Educación", subcategory: "Pepitas", type: "complement" },
  { name: "Pedagogía", category: "Educación", subcategory: "Pedagogía", type: "complement" },
  { name: "Administración", category: "Educación", subcategory: "Administración", type: "complement" },
  { name: "Idiomas", category: "Educación", subcategory: "Idiomas", type: "complement" },
  { name: "Francés", category: "Educación", subcategory: "Francés", type: "complement" },
  { name: "Inglés", category: "Educación", subcategory: "Inglés", type: "complement" },
  { name: "Italiano", category: "Educación", subcategory: "Italiano", type: "complement" },
  { name: "Programación", category: "Educación", subcategory: "Programación", type: "complement" },
  { name: "Psicología", category: "Educación", subcategory: "Psicología", type: "complement" },
  
  // Salud
  { name: "Deporte", category: "Salud", subcategory: "Deporte", type: "complement" },
  { name: "Patinar", category: "Salud", subcategory: "Patinar", type: "complement" },
  { name: "Meditación", category: "Salud", subcategory: "Meditación", type: "complement" },
  { name: "Citas médicas", category: "Salud", subcategory: "Citas médicas", type: "complement" },
  
  // Alimentación
  { name: "Alimentación: Desayuno", category: "Alimentación", subcategory: "Desayuno", type: "complement" },
  { name: "Alimentación: Almuerzo", category: "Alimentación", subcategory: "Almuerzo", type: "complement" },
  { name: "Comida", category: "Alimentación", subcategory: "Comida", type: "complement" },
  
  // Hogar
  { name: "Limpieza", category: "Hogar", subcategory: "Limpieza", type: "complement" },
  { name: "Organización", category: "Hogar", subcategory: "Organización", type: "complement" },
  { name: "Compartir", category: "Hogar", subcategory: "Compartir", type: "complement" },
  { name: "Planeación", category: "Hogar", subcategory: "Planeación", type: "complement" },
  { name: "Finanzas", category: "Hogar", subcategory: "Finanzas", type: "complement" },
  
  // Dispersión / descanso / sentimental / transporte / mascotas
  { name: "Dispersión", category: "Dispersión", subcategory: "Dispersión", type: "complement" },
  { name: "Descanso", category: "Descanso", subcategory: "Descanso", type: "complement" },
  { name: "B'shert", category: "Sentimental", subcategory: "B'shert", type: "complement" },
  { name: "Transporte", category: "Transporte", subcategory: "Transporte", type: "complement" },
  { name: "Mascotas", category: "Mascotas", subcategory: "Mascotas", type: "complement" },
  
  // Tiempo de error (diario según tu lista)
  { name: "Tiempo de error", category: "Tiempo de error", subcategory: "Tiempo de error", type: "daily" },
];
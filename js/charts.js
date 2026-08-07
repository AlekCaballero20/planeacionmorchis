/* Bitacora charts: renderizado canvas sin dependencia del estado de la app. */
(() => {
  "use strict";

  window.BitacoraModules = window.BitacoraModules || {};

  const { safeNumber } = window.BitacoraModules.utils;

  /* Paleta de bitácora: tinta sobre papel, no gráficos de tablero oscuro. */
  const INK = {
    grid: "rgba(139,126,96,.28)",
    axis: "rgba(139,126,96,.5)",
    line: "#6C4CA8",
    point: "#BE4A88",
    barA: "#6C4CA8",
    barB: "#5C7C9E",
    label: "rgba(69,60,88,.8)"
  };

  function clearCanvas(canvas) {
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || canvas.width || 800));
    const height = Math.max(180, Math.floor(rect.height || canvas.height || 280));
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }

  function drawLineChart(canvas, values = []) {
    const setup = clearCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const pad = 24;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;

    ctx.strokeStyle = INK.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = pad + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(width - pad, y);
      ctx.stroke();
    }

    if (!values.length) return;
    const max = Math.max(100, ...values);
    const stepX = values.length > 1 ? innerW / (values.length - 1) : innerW;

    ctx.strokeStyle = INK.line;
    ctx.lineWidth = 3;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad + stepX * i;
      const y = pad + innerH - (safeNumber(v) / max) * innerH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    values.forEach((v, i) => {
      const x = pad + stepX * i;
      const y = pad + innerH - (safeNumber(v) / max) * innerH;
      ctx.fillStyle = INK.point;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawBarsChart(canvas, values = [], labels = []) {
    const setup = clearCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const pad = 24;
    const baseY = height - 34;
    const innerW = width - pad * 2;
    const max = Math.max(1, ...values.map(v => safeNumber(v, 0)));
    const gap = 12;
    const barW = values.length ? Math.max(18, (innerW - gap * (values.length - 1)) / values.length) : 24;

    ctx.strokeStyle = INK.axis;
    ctx.beginPath();
    ctx.moveTo(pad, baseY);
    ctx.lineTo(width - pad, baseY);
    ctx.stroke();

    values.forEach((v, i) => {
      const n = safeNumber(v, 0);
      const h = Math.max(2, (n / max) * (height - 80));
      const x = pad + i * (barW + gap);
      const y = baseY - h;
      ctx.fillStyle = i % 2 ? INK.barB : INK.barA;
      ctx.fillRect(x, y, barW, h);
      ctx.fillStyle = INK.label;
      ctx.font = '11px "Instrument Sans", system-ui, sans-serif';
      ctx.fillText(String(labels[i] || ""), x, height - 12);
    });
  }

  window.BitacoraModules.charts = { clearCanvas, drawLineChart, drawBarsChart };
})();

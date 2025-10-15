// /alfa/dashboard.js
(async function () {
  if (!window.AIOT) { console.error("api.js nu e încărcat"); return; }

  // ---- CONFIG pentru echipa ALFA (ajustezi semnalele/app-urile aici) ----
  // Ordinea cardurilor în HTML: 1) Soil, 2) Light, 3) Temp, 4) AQI
  const CARD_SIGNALS = [
    { app: "glove", signal: "Roll", unit: "%"   }, // 1
    { app: "env",  signal: "light",         unit: "lux" }, // 2
    { app: "env",  signal: "temperature",   unit: "°C"  }, // 3
    { app: "env",  signal: "aqi",           unit: "AQI" }, // 4
  ];


  /*

  *app trebuie să fie unul din: agri, env, energy, mountain, etc — exact cum ai în routere.

  *signal trebuie să fie fix numele din DB (ce puneți pe topic și în measurements.signal).

  *unit e doar textul afișat (nu afectează backend).
*/


  // Canvases EXISTENTE în pagină (nu schimbăm nimic în scriptul lor)
  //CHARTS – leagă fiecare <canvas id="..."> de semnalul corect:
  const CHARTS = [
    { canvasId: "tempChart",  app: "env",  signal: "temperature" },
    { canvasId: "soilChart",  app: "agri", signal: "soil_moisture" },
    { canvasId: "lightChart", app: "env",  signal: "light" },
    { canvasId: "airChart",   app: "env",  signal: "aqi" },
  ];

  const REFRESH_MS = 10_000;   // reîmprospătare carduri
  const HISTORY_MIN = 60;      // istoric grafice (minute)
  const STEP = "1m";

  const lastPath  = app => `/api/${app}/value`;
  const rangePath = app => `/api/${app}`;

  // ---- Helpers ----
  function getCardValueNodesInOrder() {
    // ia a 2-a div din fiecare card (cea cu valoarea) în ORDINEA din HTML
    return Array.from(document.querySelectorAll(".card-custom .card-value"));
  }

  async function refreshCards() {
    const nodes = getCardValueNodesInOrder();
    if (nodes.length < CARD_SIGNALS.length) return;

    try {
      const jobs = CARD_SIGNALS.map(c =>
        AIOT.apiGet(lastPath(c.app), { signal: c.signal }).then(r => ({c, r}))
      );
      const results = await Promise.all(jobs);
      results.forEach(({c, r}, idx) => {
        if (!r || r.value == null) return;
        nodes[idx].textContent = `${r.value} ${c.unit || ""}`.trim();
      });
    } catch (e) {
      console.warn("[cards] error:", e);
    }
  }

  function getChartByCanvasId(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    return typeof Chart.getChart === "function" ? Chart.getChart(el) : (el._chart || null);
  }

  function pushPoint(chart, x, y, maxPoints = 60) {
    chart.data.labels.push(x);
    chart.data.datasets[0].data.push(y);
    if (chart.data.labels.length > maxPoints) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    chart.update();
  }

  async function loadHistoryIntoCharts() {
    try {
      const now = new Date();
      const from = new Date(now.getTime() - HISTORY_MIN * 60 * 1000).toISOString();
      const to   = now.toISOString();

      const jobs = CHARTS.map(ch =>
        AIOT.apiGet(rangePath(ch.app), { signal: ch.signal, from_ts: from, to_ts: to, step: STEP })
          .then(data => ({ ch, data: data || [] }))
      );
      const res = await Promise.all(jobs);

      res.forEach(({ch, data}) => {
        const chart = getChartByCanvasId(ch.canvasId);
        if (!chart) return; // graficul e creat de scriptul lor, noi doar îl populăm
        data.forEach(p => pushPoint(chart, new Date(p.ts).toLocaleTimeString(), p.value));
      });
    } catch (e) {
      console.warn("[history] error:", e);
    }
  }

  // ---- Rulează după ce pagina a creat graficele lor ----
  window.addEventListener("load", async () => {
    await refreshCards();
    await loadHistoryIntoCharts();
    if (REFRESH_MS > 0) setInterval(refreshCards, REFRESH_MS);
  });

  // (opțional) dacă vei avea endpoint POST pentru irigație, îl poți lega aici
  // document.getElementById("irrigationBtn")?.addEventListener("click", async () => {
  //   await AIOT.apiPost("/api/agri/irrigation", { on: true/false });
  // });
})();

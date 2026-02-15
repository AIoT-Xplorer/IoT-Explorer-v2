// /alfa/dashboard.js
(async function () {
  if (!window.AIOT) { console.error("api.js nu e încărcat"); return; }

  // ---- CONFIG pentru echipa ALFA ----
  const CARD_SIGNALS = [
    { app: "mountain", signal: "temperature", unit: "°C",  valueId: "tempValue",     canvasId: "tempChart",     label: "Temperature" },
    { app: "mountain", signal: "pressure",    unit: "hPa", valueId: "pressureValue", canvasId: "pressureChart", label: "Pressure"    },
    { app: "mountain", signal: "humidity",    unit: "%",   valueId: "humidityValue", canvasId: "humidityChart", label: "Humidity"    },
  ];

  const REFRESH_MS  = 10_000;  // reîmprospătare
  const HISTORY_MIN = 60;      // istoric grafice (minute)
  const STEP        = "1m";    // pas query backend (agregare)

  const lastPath  = app => `/api/${app}/value`;
  const rangePath = app => `/api/${app}/history`;

  // --- Chart helpers ---
  function ensureChart(canvasId, datasetLabel, unit) {
    const el = document.getElementById(canvasId);
    if (!el) return null;
    const existing = typeof Chart.getChart === "function" ? Chart.getChart(el) : (el._chart || null);
    if (existing) return existing;

    const chart = new Chart(el, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: `${datasetLabel} ${unit ? `(${unit})` : ""}`.trim(),
          data: [],
          fill: true,
          tension: 0.4,
          borderColor: "rgba(21,101,192,1)",
          backgroundColor: "rgba(21,101,192,0.15)",
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        animation: false,
        scales: {
          x: { ticks: { autoSkip: true, maxTicksLimit: 8 } },
          y: { beginAtZero: false }
        },
        plugins: {
          legend: { labels: { boxWidth: 12 } },
          tooltip: { mode: 'index', intersect: false }
        }
      }
    });

    // mic UX: click pe grafic -> pagina detalii (dacă există)
    el.addEventListener("click", () => {
      const map = {
        tempChart: "temperature-details.html",
        pressureChart: "pressure-details.html",
        humidityChart: "humidity-details.html",
      };
      if (map[canvasId]) window.location.href = map[canvasId];
    });

    return chart;
  }

  function getChartByCanvasId(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    return typeof Chart.getChart === "function" ? Chart.getChart(el) : (el._chart || null);
  }

  function pushPoint(chart, xLabel, y, maxPoints = 300) {
    chart.data.labels.push(xLabel);
    chart.data.datasets[0].data.push(y);
    if (chart.data.labels.length > maxPoints) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    chart.update();
  }

  // --- Cards ---
  async function refreshCards() {
    try {
      const jobs = CARD_SIGNALS.map(c => AIOT.apiGet(lastPath(c.app), { signal: c.signal }).then(r => ({ c, r })));
      const res  = await Promise.all(jobs);
      res.forEach(({ c, r }) => {
        const node = document.getElementById(c.valueId);
        if (!node || !r || r.value == null) return;
        node.textContent = `${r.value} ${c.unit || ""}`.trim();
      });
    } catch (e) {
      console.warn("[cards] error:", e);
    }
  }

  // --- History load ---
  async function loadHistoryIntoCharts() {
    try {
      const now  = new Date();
      const from = new Date(now.getTime() - HISTORY_MIN * 60 * 1000).toISOString();
      const to   = now.toISOString();

      const jobs = CARD_SIGNALS.map(c =>
        AIOT.apiGet(rangePath(c.app), { signal: c.signal, from_ts: from, to_ts: to, step: STEP })
          .then(data => ({ c, data: data || [] }))
      );
      const res = await Promise.all(jobs);

      res.forEach(({ c, data }) => {
        const chart = ensureChart(c.canvasId, c.label, c.unit);
        if (!chart) return;
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        data.forEach(p => {
          const lbl = new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          pushPoint(chart, lbl, p.value);
        });
      });
    } catch (e) {
      console.warn("[history] error:", e);
    }
  }

  // --- Live update (dedupe) ---
  const LAST_SAMPLE = new Map();
  const keyOf = (app, signal) => `${app}::${signal}`;

  async function refreshChartsLive() {
    try {
      const jobs = CARD_SIGNALS.map(c =>
        AIOT.apiGet(lastPath(c.app), { signal: c.signal }).then(r => ({ c, r }))
      );
      const res = await Promise.all(jobs);

      res.forEach(({ c, r }) => {
        console.log("[LIVE API]", c.signal,r);
        if (!r || r.value == null) return;
        const chart = getChartByCanvasId(c.canvasId) || ensureChart(c.canvasId, c.label, c.unit);
        if (!chart) return;

        const ts = r.ts || new Date().toISOString();
        const k  = keyOf(c.app, c.signal);
        const prev = LAST_SAMPLE.get(k);
        if (prev && prev.ts === ts && prev.value === r.value) return; // evită duplicate

        LAST_SAMPLE.set(k, { ts, value: r.value });
        const lbl = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        pushPoint(chart, lbl, r.value);
      });
    } catch (e) {
      console.warn("[live] error:", e);
    }
  }

  // --- Boot ---
  window.addEventListener("load", async () => {
    // asigură graficele goale (în caz că nu există încă)
    CARD_SIGNALS.forEach(c => ensureChart(c.canvasId, c.label, c.unit));

    await refreshCards();
    await loadHistoryIntoCharts();
    if (REFRESH_MS > 0) {
      setInterval(refreshCards, REFRESH_MS);
      setInterval(refreshChartsLive, REFRESH_MS);
    }
  });
})();

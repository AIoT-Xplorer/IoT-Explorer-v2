(async function () {
  if (!window.AIOT) { console.error("api.js nu exista"); return; }

  const CARD_SIGNALS = [
    { app: "medical", signal: "gsr",            unit: "Ω"   },
    { app: "medical", signal: "tmp007",         unit: "°C"  },
    { app: "medical", signal: "max30102_spo2",  unit: "%"   },
    { app: "medical", signal: "max30102_bpm",   unit: "bpm" },
  ];

  const CHARTS = [
    { canvasId: "gsrChart",            app: "medical", signal: "gsr" },
    { canvasId: "tmp007Chart",         app: "medical", signal: "tmp007" },
    { canvasId: "max30102_spo2Chart",  app: "medical", signal: "max30102_spo2" },
    { canvasId: "max30102_bpmChart",   app: "medical", signal: "max30102_bpm" },
  ];

  const REFRESH_MS = 10_000;   // reîmprospătare carduri & live
  const HISTORY_MIN = 60;      // istoric grafice (minute)
  const STEP = "1m";

  const lastPath  = app => `/api/${app}/value`;
  const rangePath = app => `/api/${app}/history`;

  function getCardValueNodesInOrder() {
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

  function pushPoint(chart, x, y, maxPoints = 300) {
    chart.data.labels.push(x);
    chart.data.datasets[0].data.push(y);
    if (chart.data.labels.length > maxPoints) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    chart.update();
  }

  const LAST_SAMPLE = new Map();
  const keyOf = (app, signal) => `${app}::${signal}`;
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  async function refreshChartsLive() {
    try {
      const res = await Promise.all(
        CHARTS.map(ch => AIOT.apiGet(lastPath(ch.app), { signal: ch.signal }).then(r => ({ ch, r })))
      );
      res.forEach(({ ch, r }) => {
        if (!r || r.value == null) return;
        const chart = getChartByCanvasId(ch.canvasId);
        if (!chart) return;
        const ts = r.ts || new Date().toISOString();
        const k = keyOf(ch.app, ch.signal);
        const prev = LAST_SAMPLE.get(k);
        if (prev && prev.ts === ts && prev.value === r.value) return; // evita duplicate
        LAST_SAMPLE.set(k, { ts, value: r.value });
        pushPoint(chart, fmtTime(ts), r.value, 300);
      });
    } catch (e) {
      console.warn("[live] error:", e);
    }
  }

  async function loadHistoryIntoCharts() {
    try {
      const now = new Date();
      const from = new Date(now.getTime() - HISTORY_MIN * 60 * 1000).toISOString();
      const to   = now.toISOString();
      const res = await Promise.all(
        CHARTS.map(ch =>
          AIOT.apiGet(rangePath(ch.app), { signal: ch.signal, from_ts: from, to_ts: to, step: STEP })
            .then(data => ({ ch, data: data || [] }))
        )
      );
      res.forEach(({ch, data}) => {
        const chart = getChartByCanvasId(ch.canvasId);
        if (!chart) return;
        data.forEach(p => pushPoint(chart, fmtTime(p.ts), p.value, 300));
      });
    } catch (e) {
      console.warn("[history] error:", e);
    }
  }

  window.addEventListener("load", async () => {
    await loadHistoryIntoCharts();  // umple cu istoric
    await refreshChartsLive();      // aduce ultimul sample
    if (REFRESH_MS > 0) {
      setInterval(refreshChartsLive, REFRESH_MS);
      // dacă vrei să și afișezi 4 carduri cu valori curente, decomentează linia de mai jos și adaugă acele carduri în HTML:
      // setInterval(refreshCards, REFRESH_MS);
    }
  });
})();
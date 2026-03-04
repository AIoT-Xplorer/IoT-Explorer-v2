// /alfa/dashboard.js
(async function () {
  if (!window.AIOT) { console.error("api.js nu e încărcat"); return; }

  // ---- CONFIG pentru echipa ALFA (ajustezi semnalele/app-urile aici) ----
  // Ordinea cardurilor în HTML: 1) Soil, 2) Light, 3) Temp, 4) AQI
  const CARD_SIGNALS = [
    { app: "agri",  signal: "soil",         unit: "%"   }, // 1
    { app: "agri",  signal: "temperature",  unit: "°C"  }, // 2
    { app: "agri",  signal: "humidity",     unit: "%" }, // 3
  ];


  /*

  *app trebuie să fie unul din: agri, env, energy, mountain, etc — exact cum ai în routere.

  *signal trebuie să fie fix numele din DB (ce puneți pe topic și în measurements.signal).

  *unit e doar textul afișat (nu afectează backend).
*/


  // Canvases EXISTENTE în pagină (nu schimbăm nimic în scriptul lor)
  //CHARTS – leagă fiecare <canvas id="..."> de semnalul corect:
  const CHARTS = [
    { canvasId: "tempChart",  app: "agri",  signal: "temperature" },
    { canvasId: "soilChart",  app: "agri", signal: "soil" },
    { canvasId: "humidityChart",   app: "agri",  signal: "humidity" },
  ];

  const REFRESH_MS = 10_000;   // reîmprospătare carduri
  const HISTORY_MIN = 60;      // istoric grafice (minute)
  const STEP = "1m";

  const lastPath  = app => `/api/${app}/value`;
  const rangePath = app => `/api/${app}/history`;

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

  // reține ultimul timestamp împins per (app,signal) ca să nu bagi duplicate
// --- dedupe live points per (app, signal)
const LAST_SAMPLE = new Map();
const keyOf = (app, signal) => `${app}::${signal}`;


function fmtTime(ts) {
  const d = new Date(ts);
  // ora:minut:secundă cu 2 cifre
  return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

// ia ultimul value pentru fiecare grafic și îl împinge dacă e nou
function nowISO() { return new Date().toISOString(); }


async function refreshChartsLive() {
  try {
    const res = await Promise.all(
      CHARTS.map(ch => AIOT.apiGet(lastPath(ch.app), { signal: ch.signal }).then(r => ({ ch, r })))
    );

    res.forEach(({ ch, r }) => {
      console.log("[LIVE API]", ch.signal, r); // vezi structura răspunsului

      if (!r || r.value == null) return;
      const chart = getChartByCanvasId(ch.canvasId);
      if (!chart) return;

      const ts = r.ts || new Date().toISOString(); // fallback dacă API nu dă ts
      const k = keyOf(ch.app, ch.signal);
      const prev = LAST_SAMPLE.get(k);
      if (prev && prev.ts === ts && prev.value === r.value) return; // evită duplicate

      LAST_SAMPLE.set(k, { ts, value: r.value });
      pushPoint(
        chart,
        new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        r.value,
        300
      );
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
    if (REFRESH_MS > 0) {
    setInterval(refreshCards, REFRESH_MS);
    setInterval(refreshChartsLive, REFRESH_MS);   // <- ADĂUGAT
  }
  });

  // (opțional) dacă vei avea endpoint POST pentru irigație, îl poți lega aici
  // document.getElementById("irrigationBtn")?.addEventListener("click", async () => {
  //   await AIOT.apiPost("/api/agri/irrigation", { on: true/false });
  // });
})();



////
(function () {
  const sel = document.getElementById('plantSelect');

  async function sendPlantChoiceText(plantName) {
    try {
      const res = await fetch('/api/agri/selectPlant', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: plantName,              // <- doar text, fără JSON
        credentials: 'same-origin'
      });

      const ct = res.headers.get('content-type') || '';
      const body = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${typeof body==='string' ? body.slice(0,200) : JSON.stringify(body)}`);

      console.log('[selectPlant OK]', body);
      notify(`Sent plant: ${plantName}`, true);
      localStorage.setItem('alpha.selectedPlant', plantName);
    } catch (e) {
      console.error('selectPlant error', e);
      notify('Could not send plant selection.', false);
    }
  }

  // pornim cu alegerea salvată (opțional)
  const saved = localStorage.getItem('alpha.selectedPlant');
  if (saved && Array.from(sel.options).some(o => o.value === saved)) {
    sel.value = saved;
  }

  sel.addEventListener('change', () => {
    const plant = sel.value;
    if (plant) sendPlantChoiceText(plant);
  });

  function notify(msg, ok) {
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position:'fixed', right:'16px', bottom:'16px', padding:'10px 14px',
      borderRadius:'12px', zIndex:9999, color:'#fff', fontSize:'14px',
      background: ok ? 'rgba(0,255,195,.2)' : 'rgba(255,77,77,.2)',
      border:    ok ? '1px solid #00ffc3' : '1px solid #ff4d4d',
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }
})();
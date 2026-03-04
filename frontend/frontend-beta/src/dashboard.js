// /alfa/dashboard.js – compatibil cu Glove Dashboard (flexRealtime + flexBars)
(function () {
  if (!window.AIOT) { console.error("[AIOT] api.js nu e încărcat"); return; }
  if (typeof window.pushFlex !== "function" || typeof window.updateRecognition !== "function") {
    console.error("[AIOT] Nu găsesc pushFlex()/updateRecognition() din HTML.");
    return;
  }

  // IMPORTANT: ordinea trebuie să corespundă cu fingerNames din HTML:
  // const fingerNames = ["Roll","Pitch","Yaw","Ring","Pinky"];
  // În DB semnalele ultimelor două pot fi RING_FINGER / LITTLE_FINGER.
 // ordinea trebuie să rămână identică cu 'fingerNames' din HTML
const SIGNALS = [
  { app: "glove", signal: "Roll" },
  { app: "glove", signal: "Pitch" },
  { app: "glove", signal: "Yaw" },
  { app: "glove", signal: "THUMB" },
  { app: "glove", signal: "INDEX_FINGER" },
  { app: "glove", signal: "MIDDLE_FINGER" },
  { app: "glove", signal: "RING_FINGER" },
  { app: "glove", signal: "LITTLE_FINGER" },
];

  const CHAR_SIGNAL = { app: "glove", signal: "char" }; // dacă ai salvat ultimul caracter în DB

  // Cât de des cerem ultima valoare (ms)
  const REFRESH_MS = 2000;

  // Helpers
  const lastPath  = app => `/api/${app}/value`;
  const rangePath = app => `/api/${app}/history`; // ajustează dacă la tine e altă rută

  function clamp01x100(x) {
    const v = Number(x);
    if (!isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  }

  async function fetchLastValue(app, signal) {
    // AIOT.apiGet adaugă headerul de tenant etc. (presupunând că e făcut în api.js)
    const r = await AIOT.apiGet(lastPath(app), { signal });
    return r?.value;
  }

  async function refreshTick() {
    try {
      // 1) Flex: ia ultimele valori în ordinea SIGNALS și împinge într-un singur frame
      const vals = await Promise.all(
        SIGNALS.map(s => fetchLastValue(s.app, s.signal))
      );
      const flex = vals.map(clamp01x100); // 0..100
      window.pushFlex(flex);

      // 2) Caracter recunoscut (opțional)
      try {
        const charRes = await AIOT.apiGet(lastPath(CHAR_SIGNAL.app), { signal: CHAR_SIGNAL.signal });
        if (charRes && (charRes.value || charRes.extra)) {
          window.updateRecognition(
            charRes.value || null,
            (charRes.extra?.confidence ?? 0),
            (charRes.extra?.latency ?? charRes.extra?.latencyMs ?? 0)
          );
        }
      } catch (e) {
        // dacă nu ai semnalul 'char' în DB, ignorăm
      }
    } catch (err) {
      console.warn("[AIOT] refreshTick error:", err);
    }
  }

  // (opțional) încărcare istoric în graficul de linii
  async function loadHistory() {
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // 10 minute
      const to   = now.toISOString();

      // pentru istoric, luăm valori agregate pe aceeași scară de timp pentru toate semnalele
      // și „reconstruim” frame-uri sincronizate; dacă backendul întoarce vectori aliniați pe step, e simplu
      const step = "30s";

      const series = await Promise.all(
        SIGNALS.map(s =>
          AIOT.apiGet(rangePath(s.app), { signal: s.signal, from_ts: from, to_ts: to, step })
        )
      );

      // normalizăm la un index temporal comun după 'ts'
      // construim un map ts -> [v1..v5]
      const byTs = new Map();
      series.forEach((arr, idx) => {
        (arr || []).forEach(p => {
          const ts = p.ts;
          const val = clamp01x100(p.value);
          if (!byTs.has(ts)) byTs.set(ts, Array(SIGNALS.length).fill(0));
          byTs.get(ts)[idx] = val;
        });
      });

      // sortăm cronologic și împingem în grafice
      Array.from(byTs.entries())
        .sort((a, b) => new Date(a[0]) - new Date(b[0]))
        .forEach(([_, vector]) => window.pushFlex(vector));
    } catch (e) {
      console.warn("[AIOT] loadHistory error:", e);
    }
  }

  window.addEventListener("load", () => {
    // Dacă vrei și istoric (poate fi comentat dacă nu ai endpointul):
    loadHistory();

    // Polling live
    refreshTick();
    setInterval(refreshTick, REFRESH_MS);
  });
})();

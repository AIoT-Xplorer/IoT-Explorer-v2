function detectTenant() {
  const segs = (location.pathname || "/").split("/").filter(Boolean);
  const first = segs.length ? segs[0] : "default";
  if (first.startsWith("frontend-")) return first.replace("frontend-", "");
  return first;
}

const TENANT = detectTenant();
const API_BASE = "https://api.aiot-xplorer.eu";

async function apiGet(path, params = {}) {
  const url = new URL(path, API_BASE);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: { "X-Tenant-ID": TENANT }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

window.AIOT = { TENANT, apiGet };
console.log("[AIOT] Tenant detectat:", TENANT);

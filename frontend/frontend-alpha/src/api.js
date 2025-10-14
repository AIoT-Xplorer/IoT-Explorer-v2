// detect tenant from URL (/alfa/energy.html -> "alfa")
function detectTenant() {
  const segs = (location.pathname || "/").split("/").filter(Boolean);
  return segs.length ? segs[0] : "default";
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

// expunem global
window.AIOT = { TENANT, apiGet};
// Docker HEALTHCHECK: the LAN listener answers /api/health.

const host = !process.env.UI_BIND || process.env.UI_BIND === "0.0.0.0" ? "127.0.0.1" : process.env.UI_BIND;
const port = process.env.UI_PORT || "8098";

fetch(`http://${host.includes(":") ? `[${host}]` : host}:${port}/api/health`, { signal: AbortSignal.timeout(4000) })
  .then((res) => process.exit(res.ok ? 0 : 1))
  .catch(() => process.exit(1));

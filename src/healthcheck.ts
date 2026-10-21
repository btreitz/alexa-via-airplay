const HEALTHCHECK_TIMEOUT_MS = 4000;

function uiHost(): string {
  const bind = process.env.UI_BIND;
  const host = !bind || bind === "0.0.0.0" ? "127.0.0.1" : bind;
  return host.includes(":") ? `[${host}]` : host;
}

const port = process.env.UI_PORT || "8098";

fetch(`http://${uiHost()}:${port}/api/health`, { signal: AbortSignal.timeout(HEALTHCHECK_TIMEOUT_MS) })
  .then((res) => process.exit(res.ok ? 0 : 1))
  .catch(() => process.exit(1));

// @ts-check
// Web UI for alexa-via-airplay: plain DOM, no framework, no build step.
// Polls /api/status and renders it. All text goes in via textContent.

/** @typedef {{ status: string, loginUrl?: string, error?: string }} AlexaState */
/** @typedef {{ serial: string, name: string, family: string, online: boolean, selected: boolean }} Device */

const POLL_MS = 2000;
const DEVICES_EVERY = 5; // polls

/** @type {any} Latest /api/status answer. */
let snap = null;
/** @type {Device[]} */
let devices = [];
let pollCount = 0;
let echoTableKey = "";
/** @type {Set<string>} serials with a request in progress */
const busy = new Set();

// ---------------------------------------------------------------- helpers

/** @param {string} id */
function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

/** @param {string} id */
function input(id) {
  return /** @type {HTMLInputElement} */ ($(id));
}

/**
 * Creates an element. Strings become text nodes; never HTML.
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {...(Node|string|number|null|undefined|false)} children
 * @returns {HTMLElement}
 */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
    else if (key === "class") el.className = value;
    else if (key === "value") /** @type {HTMLInputElement} */ (el).value = String(value); // textarea has no value attribute
    else if (key in el && typeof value !== "string") /** @type {any} */ (el)[key] = value;
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === "string" || typeof child === "number" ? document.createTextNode(String(child)) : child);
  }
  return el;
}

/** @param {HTMLElement} el @param {...(Node|string|null|undefined|false)} children */
function fill(el, ...children) {
  el.replaceChildren(...children.filter((c) => c !== null && c !== undefined && c !== false).map((c) => (typeof c === "string" ? document.createTextNode(c) : /** @type {Node} */ (c))));
}

/**
 * @param {string} method
 * @param {string} path
 * @param {unknown} [body]
 */
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: method === "GET" ? {} : { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** Runs an action, shows errors, refreshes the status. @param {() => Promise<unknown>} action */
async function act(action) {
  try {
    await action();
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err));
  }
  await refresh();
}

/** @param {number|null|undefined} iso */
function ago(iso) {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

/** Marks a form as being edited so polling doesn't overwrite it. @param {HTMLFormElement} form */
function trackDirty(form) {
  form.addEventListener("input", () => (form.dataset.dirty = "1"));
}

/** @param {HTMLFormElement} form */
function isDirty(form) {
  return form.dataset.dirty === "1" || form.contains(document.activeElement);
}

/** Clipboard API needs HTTPS; on plain-HTTP LAN pages fall back to execCommand. @param {HTMLTextAreaElement} area */
async function copyText(area) {
  try {
    await navigator.clipboard.writeText(area.value);
    return true;
  } catch {
    area.focus();
    area.select();
    return document.execCommand("copy");
  }
}

// ---------------------------------------------------------------- rendering

function renderPills() {
  const pills = [];
  const alexa = /** @type {AlexaState} */ (snap.alexa);
  const amazon = { ready: ["ok", "Amazon signed in"], "waiting-for-login": ["warn", "Amazon login open"], connecting: ["warn", "Amazon connecting"], "logged-out": ["bad", "Amazon signed out"], error: ["bad", "Amazon error"] }[alexa.status] || ["bad", alexa.status];
  pills.push(amazon);

  const check = snap.publicUrlCheck;
  if (!snap.settings.publicBaseUrl) pills.push(["bad", "No public URL"]);
  else if (!check) pills.push(["warn", "Public URL not checked"]);
  else pills.push(check.ok ? ["ok", "Public URL reachable"] : ["bad", "Public URL unreachable"]);

  const access = snap.publicAccess;
  if (!access.restrictToHomeIp) pills.push(["warn", "Home IP check off"]);
  else if (access.homeIp.ipv4.usable || access.homeIp.ipv6.usable) pills.push(["ok", "Home IP known"]);
  else pills.push(["bad", "Home IP unknown"]);

  if (snap.tunnel.enabled) pills.push(snap.tunnel.connections > 0 ? ["ok", `Tunnel up (${snap.tunnel.connections})`] : ["bad", "Tunnel down"]);

  const playing = snap.receivers.filter((/** @type {any} */ r) => r.listeners.length > 0).length;
  pills.push([snap.receivers.length ? "ok" : "warn", `${snap.receivers.length} receiver${snap.receivers.length === 1 ? "" : "s"}${playing ? `, ${playing} playing` : ""}`]);

  fill($("pills"), ...pills.map(([cls, text]) => h("span", { class: `pill ${cls}` }, text)));

  const problems = [];
  if (access.restrictToHomeIp && access.homeIpUnknownSince) problems.push("Streams are refused: this home's public IP is unknown (see Diagnostics).");
  for (const c of snap.checks || []) if (!c.ok) problems.push(c.message);
  for (const p of (snap.system && snap.system.problems) || []) problems.push(p);
  const banner = $("banner");
  banner.hidden = problems.length === 0;
  fill(banner, ...problems.map((p) => h("div", {}, p)));
}

function renderPublic() {
  const form = /** @type {HTMLFormElement} */ ($("public-form"));
  const url = input("public-url");
  const fromEnv = snap.settings.publicBaseUrlFromEnv;
  if (!isDirty(form)) url.value = snap.settings.publicBaseUrl || "";
  url.disabled = fromEnv;
  /** @type {HTMLButtonElement} */ (form.querySelector("button[type=submit]")).disabled = fromEnv;

  const check = snap.publicUrlCheck;
  fill(
    $("public-result"),
    fromEnv ? h("p", { class: "hint" }, "Set by PUBLIC_BASE_URL in the environment.") : null,
    check
      ? h("div", { class: `result ${check.ok ? (check.homeIpMatch === false ? "warn" : "ok") : "bad"}` }, check.message, h("div", { class: "muted small-text" }, `Checked ${ago(check.checkedAt)}`))
      : null,
  );

  const ip = snap.publicAccess.homeIp;
  /** @param {any} f */
  const family = (f) => (f.ip ? `${f.ip}${f.usable ? "" : " (stale)"} · ${ago(f.checkedAt)}` : f.error ? `unknown (${f.error})` : "unknown");
  const facts = [
    ["Home IPv4", family(ip.ipv4)],
    ["Home IPv6", `${family(ip.ipv6)}${ip.ipv6.ip ? ` · /${ip.ipv6PrefixLength}` : ""}`],
    ["Client IP from", snap.publicAccess.clientIpHeader ? `${snap.publicAccess.clientIpHeader} (trusted: ${snap.publicAccess.trustedProxies.join(", ")})` : "connection address"],
  ];
  if (snap.tunnel.enabled) facts.push(["Built-in tunnel", snap.tunnel.connections > 0 ? `${snap.tunnel.connections} connections` : snap.tunnel.lastError || "not connected"]);
  fill($("public-facts"), ...facts.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]));
}

function renderAmazon() {
  const alexa = /** @type {AlexaState} */ (snap.alexa);
  const body = $("amazon-body");
  if (alexa.status === "ready") {
    fill(
      body,
      h("p", {}, "Signed in on ", h("b", {}, snap.amazonPage || "Amazon"), `. ${devices.length} Echo${devices.length === 1 ? "" : "s"} found.`),
      h("div", { class: "row" },
        h("button", { class: "secondary", onclick: () => act(async () => { await api("POST", "/api/devices/refresh"); await loadDevices(); }) }, "Refresh Echos"),
        h("button", { class: "danger", onclick: () => confirm("Sign out of Amazon? The bridge can't start Echos until you sign in again.") && act(() => api("POST", "/api/alexa/logout")) }, "Sign out"),
      ),
    );
    return;
  }
  if (alexa.status === "waiting-for-login" && alexa.loginUrl) {
    fill(
      body,
      h("p", {}, "Open the Amazon login, sign in (including two-step verification), then come back here. This page updates by itself."),
      h("p", {}, h("a", { class: "login-link", href: alexa.loginUrl, target: "_blank", rel: "noopener noreferrer" }, "Open Amazon login →")),
      h("p", { class: "hint" }, `The login runs through a small proxy on this bridge (${alexa.loginUrl}).`),
      h("button", { class: "secondary", onclick: () => act(() => api("POST", "/api/alexa/logout")) }, "Cancel"),
    );
    return;
  }
  if (alexa.status === "connecting") {
    fill(body, h("p", {}, "Connecting to Amazon…"));
    return;
  }
  if (body.querySelector("select") && body.contains(document.activeElement)) return; // user is choosing
  const select = /** @type {HTMLSelectElement} */ (h("select", { id: "amazon-page", "aria-label": "Amazon site" },
    h("option", { value: "" }, "Amazon site of your account…"),
    ...snap.amazonPages.map((/** @type {string} */ p) => h("option", { value: p, selected: p === snap.amazonPage }, p)),
  ));
  fill(
    body,
    alexa.status === "error" ? h("div", { class: "result bad" }, alexa.error || "Error") : null,
    h("p", {}, "Sign in with the Amazon account that owns your Echos. The bridge uses it to start the skill on an Echo and to set its volume."),
    h("div", { class: "row" },
      select,
      h("button", { onclick: () => {
        if (!select.value) return alert("Choose the Amazon site your account is registered on.");
        act(() => api("POST", "/api/alexa/login", { amazonPage: select.value }));
      } }, "Sign in"),
    ),
  );
}

let skillKey = "";
let skillShown = false;

function renderSkill() {
  const form = /** @type {HTMLFormElement} */ ($("invocation-form"));
  if (!isDirty(form)) input("invocation").value = snap.settings.invocationName;
  const key = `${snap.settings.publicBaseUrl}|${snap.settings.invocationName}`;
  const target = $("skill-files");
  if (!snap.settings.publicBaseUrl) {
    skillKey = "";
    fill(target, h("p", { class: "hint warn-text" }, "Set the public URL (step 1) first; the skill code contains it."));
    return;
  }
  if (skillShown && key !== skillKey) void loadSkill();
  if (!skillShown && !target.querySelector("button")) {
    fill(target, h("button", { class: "secondary", onclick: () => void loadSkill() }, "Show skill files"));
  }
}

async function loadSkill() {
  try {
    const skill = await api("GET", "/api/skill");
    skillShown = true;
    skillKey = `${snap.settings.publicBaseUrl}|${snap.settings.invocationName}`;
    /** @param {string} title @param {string} text @param {string} note */
    const file = (title, text, note) => {
      const area = /** @type {HTMLTextAreaElement} */ (h("textarea", { readonly: true, spellcheck: false, value: text }));
      const button = h("button", { class: "small", onclick: async () => {
        const ok = await copyText(area);
        button.textContent = ok ? "Copied" : "Copy failed: select and copy by hand";
        setTimeout(() => (button.textContent = "Copy"), 2000);
      } }, "Copy");
      return h("div", { class: "file" }, h("header", {}, h("span", {}, title), button), area, h("p", { class: "hint" }, note));
    };
    fill(
      $("skill-files"),
      h("p", { class: "hint" }, "The bridge starts the skill by saying ", h("b", {}, `"${skill.launchPhrase}"`), " to the Echo. Stream URL: ", h("code", {}, skill.streamUrl)),
      file("Interaction model (JSON Editor)", skill.interactionModel, "Paste in Build → Interaction Model → JSON Editor."),
      file("Skill code (lambda/index.js)", skill.indexJs, "Contains the signing secret: keep it private. Paste in Code → lambda/index.js."),
      h("div", { class: "row" },
        h("button", { class: "danger", onclick: () => confirm("Rotate the signing secret? Echos can't play until you paste the new skill code and deploy it.") && act(async () => { await api("POST", "/api/secret/rotate"); await loadSkill(); }) }, "Rotate secret"),
        h("span", { class: "hint" }, "Do this if the skill code leaked; then paste the new code."),
      ),
    );
  } catch (err) {
    fill($("skill-files"), h("div", { class: "result bad" }, err instanceof Error ? err.message : String(err)));
  }
}

/** @param {any} receiver */
function receiverState(receiver) {
  if (!receiver) return h("span", { class: "muted" }, "Not a receiver");
  const parts = [];
  if (receiver.process && !receiver.process.running) parts.push(h("div", { class: "bad-text" }, "AirPlay receiver not running"));
  const a = receiver.audio;
  if (a.active) {
    const pct = Math.max(0, Math.min(100, Math.round(((a.levelDb ?? -60) + 60) / 60 * 100)));
    const bar = h("i");
    bar.style.width = `${pct}%`; // CSSOM, allowed by the CSP (a style attribute isn't)
    parts.push(h("div", {}, "AirPlay playing ", h("span", { class: "level", title: `${a.levelDb} dB` }, bar)));
  } else if (receiver.session && receiver.session.active) {
    parts.push(h("div", {}, "AirPlay connected, paused"));
  } else {
    parts.push(h("div", { class: "muted" }, "AirPlay idle"));
  }
  if (receiver.listeners.length > 0) parts.push(h("div", { class: "ok-text" }, `Echo streaming (${receiver.listeners[0].seconds} s)`));
  parts.push(h("div", { class: receiver.mapped ? "muted small-text" : "warn-text small-text" }, receiver.mapped ? "Mapped" : "Not mapped yet: press Test"));
  if (receiver.session && receiver.session.suppressed) parts.push(h("div", { class: "muted small-text" }, "Stopped on the Echo; press play on the sender to restart"));
  if (receiver.session && receiver.session.lastError) parts.push(h("div", { class: "bad-text small-text" }, receiver.session.lastError));
  return h("div", {}, ...parts);
}

function renderEchos() {
  const target = $("echo-list");
  /** @type {Map<string, any>} */
  const receivers = new Map(snap.receivers.map((/** @type {any} */ r) => [r.serial, r]));
  /** @type {{ serial: string, name: string, online: boolean | null, family: string }[]} */
  const rows = devices.map((d) => ({ serial: d.serial, name: d.name, online: d.online, family: d.family }));
  for (const r of snap.receivers) if (!rows.some((row) => row.serial === r.serial)) rows.push({ serial: r.serial, name: r.echoName || r.serial, online: null, family: "" });

  if (rows.length === 0) {
    echoTableKey = "";
    fill(target, h("p", { class: "muted" }, snap.alexa.status === "ready" ? "No Echos found on this account." : "Sign in to Amazon (step 2) to list your Echos."));
    return;
  }

  const key = JSON.stringify(rows.map((r) => [r.serial, r.name, r.online, receivers.has(r.serial) && receivers.get(r.serial).name, [...busy].join()]));
  if (key === echoTableKey && target.querySelector("table")) {
    // Same structure: only refresh the live snap cells, keep inputs and sliders alone.
    for (const cell of target.querySelectorAll("td[data-state]")) {
      fill(/** @type {HTMLElement} */ (cell), receiverState(receivers.get(/** @type {HTMLElement} */ (cell).dataset.state || "")));
    }
    return;
  }
  if (target.contains(document.activeElement) && target.querySelector("table")) return; // don't yank an input mid-edit
  echoTableKey = key;

  const body = rows.map((row) => {
    const receiver = receivers.get(row.serial);
    const selected = Boolean(receiver);
    const isBusy = busy.has(row.serial);
    /** @param {() => Promise<unknown>} fn */
    const run = (fn) => {
      busy.add(row.serial);
      renderEchos();
      void act(fn).finally(() => { busy.delete(row.serial); echoTableKey = ""; renderEchos(); });
    };
    const toggle = h("input", { type: "checkbox", checked: selected, disabled: isBusy, "aria-label": `Expose ${row.name} via AirPlay`, onchange: () => run(() => (selected ? api("DELETE", `/api/receivers/${encodeURIComponent(row.serial)}`) : api("POST", "/api/receivers", { serial: row.serial }))) });
    const nameCell = selected
      ? h("input", { class: "name-input", type: "text", value: receiver.name, maxlength: 50, "aria-label": "AirPlay name", onchange: (/** @type {Event} */ e) => {
        const value = /** @type {HTMLInputElement} */ (e.target).value;
        run(() => api("PATCH", `/api/receivers/${encodeURIComponent(row.serial)}`, { name: value }));
      } })
      : h("span", { class: "muted" }, "—");
    const actions = selected
      ? h("td", { class: "actions" },
        h("button", { class: "small", disabled: isBusy || snap.alexa.status !== "ready", title: "Start the skill on this Echo", onclick: () => run(() => api("POST", `/api/receivers/${encodeURIComponent(row.serial)}/trigger`)) }, "Test"),
        h("button", { class: "small secondary", disabled: isBusy || snap.alexa.status !== "ready", onclick: () => run(() => api("POST", `/api/receivers/${encodeURIComponent(row.serial)}/stop`)) }, "Stop"),
        h("input", { type: "range", min: 0, max: 100, step: 5, value: receiver.session && receiver.session.volume != null ? receiver.session.volume : 30, title: "Echo volume", "aria-label": "Echo volume", disabled: snap.alexa.status !== "ready", onchange: (/** @type {Event} */ e) => {
          const volume = Number(/** @type {HTMLInputElement} */ (e.target).value);
          void act(() => api("POST", `/api/receivers/${encodeURIComponent(row.serial)}/volume`, { volume }));
        } }),
        receiver.mapped ? h("button", { class: "small secondary", title: "Forget which Alexa device ID belongs to this Echo", onclick: () => confirm("Forget the device mapping? Press Test afterwards to learn it again.") && run(() => api("DELETE", `/api/receivers/${encodeURIComponent(row.serial)}/mapping`)) }, "Forget mapping") : null,
      )
      : h("td", {});
    return h("tr", {},
      h("td", {}, toggle),
      h("td", {}, h("div", {}, row.name), h("div", { class: "muted small-text" }, row.online === null ? "not on this account" : row.online ? "online" : "offline")),
      h("td", {}, nameCell),
      h("td", { "data-state": row.serial }, receiverState(receiver)),
      actions,
    );
  });
  fill(target, h("div", { class: "table-wrap" }, h("table", {},
    h("thead", {}, h("tr", {}, h("th", {}, "AirPlay"), h("th", {}, "Echo"), h("th", {}, "AirPlay name"), h("th", {}, "Status"), h("th", {}, ""))),
    h("tbody", {}, ...body),
  )));
}

function renderSettings() {
  const form = /** @type {HTMLFormElement} */ ($("settings-form"));
  if (isDirty(form)) return;
  input("idle-timeout").value = String(snap.settings.idleTimeoutSeconds);
  input("forward-volume").checked = snap.settings.forwardVolume;
  input("restrict-ip").checked = snap.settings.restrictToHomeIp;
}

function renderDiagnostics() {
  const items = [];
  for (const c of snap.checks || []) items.push([c.ok ? "ok" : "bad", c.message]);
  if (snap.system) {
    for (const [name, label] of [["dbus", "D-Bus"], ["avahi", "Avahi (mDNS)"], ["nqptp", "NQPTP (AirPlay 2 timing)"]]) {
      items.push([snap.system[name] ? "ok" : "bad", `${label} ${snap.system[name] ? "running" : "not running"}`]);
    }
  }
  const check = snap.publicUrlCheck;
  items.push(check ? [check.ok ? "ok" : "bad", `Public URL: ${check.message}`] : ["warn", "Public URL not checked yet"]);
  if (snap.tunnel.enabled) items.push([snap.tunnel.connections > 0 ? "ok" : "bad", `Tunnel: ${snap.tunnel.connections} connections${snap.tunnel.lastError ? `, last error: ${snap.tunnel.lastError}` : ""}`]);

  const rejections = Object.entries(snap.publicAccess.rejections || {});
  const requests = snap.publicRequests || [];
  fill(
    $("diagnostics"),
    h("div", { class: "diag-grid" },
      h("div", {}, h("h3", {}, "Checks"), h("ul", { class: "checklist" }, ...items.map(([cls, text]) => h("li", { class: cls }, text)))),
      h("div", {}, h("h3", {}, "Refused public requests since start"),
        rejections.length ? h("dl", { class: "facts" }, ...rejections.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, String(v))])) : h("p", { class: "muted" }, "None."),
        h("p", { class: "hint" }, `Up ${Math.round(snap.uptimeSeconds / 60)} min.`)),
    ),
    h("h3", {}, "Last public requests"),
    requests.length
      ? h("div", { class: "table-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, h("th", {}, "Time"), h("th", {}, "Status"), h("th", {}, "Client"), h("th", {}, "User agent"), h("th", {}, "Result"))),
        h("tbody", {}, ...requests.map((/** @type {any} */ r) => h("tr", {},
          h("td", { class: "small-text" }, new Date(r.time).toLocaleTimeString()),
          h("td", { class: r.status < 400 ? "ok-text" : "bad-text" }, String(r.status)),
          h("td", { class: "small-text" }, r.remote || "?"),
          h("td", { class: "small-text" }, r.userAgent || ""),
          h("td", { class: "small-text" }, r.note),
        ))),
      ))
      : h("p", { class: "muted" }, "No requests yet."),
  );
}

function render() {
  if (!snap) return;
  renderPills();
  renderPublic();
  renderAmazon();
  renderSkill();
  renderEchos();
  renderSettings();
  renderDiagnostics();
}

// ---------------------------------------------------------------- data

async function loadDevices() {
  if (!snap || snap.alexa.status !== "ready") {
    devices = [];
    return;
  }
  try {
    devices = await api("GET", "/api/devices");
  } catch {
    // keep the last list
  }
}

let lastAlexaStatus = "";

async function refresh() {
  try {
    snap = await api("GET", "/api/status");
    $("banner").classList.remove("offline");
  } catch {
    const banner = $("banner");
    banner.hidden = false;
    fill(banner, "The bridge doesn't answer. Is the container running?");
    return;
  }
  if (snap.alexa.status !== lastAlexaStatus || pollCount % DEVICES_EVERY === 0) {
    lastAlexaStatus = snap.alexa.status;
    await loadDevices();
  }
  pollCount++;
  render();
}

// ---------------------------------------------------------------- forms

/** @param {HTMLFormElement} form @param {() => Promise<unknown>} action */
function onSubmit(form, action) {
  trackDirty(form);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void act(async () => {
      await action();
      delete form.dataset.dirty;
      /** @type {HTMLElement|null} */ (document.activeElement)?.blur();
    });
  });
}

onSubmit(/** @type {HTMLFormElement} */ ($("public-form")), () => api("PUT", "/api/settings", { publicBaseUrl: input("public-url").value.trim() }));
onSubmit(/** @type {HTMLFormElement} */ ($("invocation-form")), () => api("PUT", "/api/settings", { invocationName: input("invocation").value }));
onSubmit(/** @type {HTMLFormElement} */ ($("settings-form")), () => api("PUT", "/api/settings", {
  idleTimeoutSeconds: Number(input("idle-timeout").value),
  forwardVolume: input("forward-volume").checked,
  restrictToHomeIp: input("restrict-ip").checked,
}));

$("public-check").addEventListener("click", (e) => {
  const button = /** @type {HTMLButtonElement} */ (e.currentTarget);
  button.disabled = true;
  button.textContent = "Checking…";
  void act(() => api("POST", "/api/public-url/check")).finally(() => {
    button.disabled = false;
    button.textContent = "Check";
  });
});

void refresh();
setInterval(() => void refresh(), POLL_MS);

export {};

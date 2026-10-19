// Milestone 1 spike: can the bridge start the skill on one specific Echo
// without anyone speaking? Uses alexa-remote2 for login (proxy + 2FA in the
// user's browser), device list, text command and volume.
//
//   node alexa-control.ts login                 start the login proxy, wait for the browser login
//   node alexa-control.ts devices               list Echo devices
//   node alexa-control.ts text <serial> <text>  e.g. text G0911... "open my sound bridge"
//   node alexa-control.ts volume <serial> <0-100>
//   node alexa-control.ts stop <serial>
//
// The session (cookie + registration data) is stored in $DATA_DIR/alexa-session.json.
// Never commit that file.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AlexaRemote = require("alexa-remote2");

const DATA_DIR = process.env.DATA_DIR || "/data";
const SESSION_FILE = path.join(DATA_DIR, "alexa-session.json");
const AMAZON_PAGE = process.env.AMAZON_PAGE; // e.g. amazon.de, amazon.com
const PROXY_OWN_IP = process.env.PROXY_OWN_IP; // address the browser uses to reach this host
const PROXY_PORT = Number(process.env.PROXY_PORT || 3456);
const PROXY_LANGUAGE = process.env.PROXY_LANGUAGE || "en_US";
const VERBOSE = process.env.VERBOSE === "1";

function need(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`Missing environment variable ${name}`);
    process.exit(2);
  }
  return value;
}

function loadSession(): unknown {
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
  } catch {
    return undefined;
  }
}

function saveSession(data: unknown): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data), { mode: 0o600 });
}

function connect(allowProxy: boolean): Promise<any> {
  const alexa = new AlexaRemote();
  const session = loadSession();
  if (!session && !allowProxy) {
    console.error("No session yet. Run `login` first.");
    process.exit(2);
  }

  alexa.on("cookie", () => {
    if (alexa.cookieData) {
      saveSession(alexa.cookieData);
      console.log("[session] saved");
    }
  });

  return new Promise((resolve, reject) => {
    alexa.init(
      {
        cookie: session,
        proxyOnly: true,
        setupProxy: allowProxy,
        proxyOwnIp: allowProxy ? need("PROXY_OWN_IP", PROXY_OWN_IP) : undefined,
        proxyPort: PROXY_PORT,
        proxyListenBind: "0.0.0.0",
        proxyLogLevel: "warn",
        amazonPage: need("AMAZON_PAGE", AMAZON_PAGE),
        amazonPageProxyLanguage: PROXY_LANGUAGE,
        acceptLanguage: "en-US",
        useWsMqtt: false,
        cookieRefreshInterval: 0,
        bluetooth: false,
        notifications: false,
        logger: VERBOSE ? (msg: string) => console.log(`[alexa] ${redact(msg)}`) : undefined,
      },
      (err: Error | null) => {
        if (err) {
          // In proxy mode the first callback carries the "Please open ..." hint;
          // the callback fires again once the browser login completes.
          if (/Please open/.test(err.message)) {
            console.log(`\n>>> ${err.message.replace(/ The cookie.*$/, "")}\n`);
            return;
          }
          reject(err);
          return;
        }
        if (alexa.cookieData) saveSession(alexa.cookieData);
        resolve(alexa);
      },
    );
  });
}

// The library logs whole cookies and tokens in verbose mode; keep them out of the console.
function redact(msg: string): string {
  return msg
    .replace(/("?(?:cookie|localCookie|csrf|refreshToken|accessToken|access_token|macDms|adp_token|device_private_key|loginCookie|frc|map-md|token)"?\s*[:=]\s*)("[^"]*"|[^,;\s}]+)/gi, "$1<redacted>")
    .replace(/(Atna\||Atza\||x-main=|at-main=|sess-at-main=|session-id=|ubid-[a-z]+=)[^;"\s]+/gi, "$1<redacted>");
}

function deviceList(alexa: any) {
  return Object.values(alexa.serialNumbers as Record<string, any>)
    .filter((d) => d.capabilities && d.capabilities.includes("AUDIO_PLAYER"))
    .map((d) => ({
      serial: d.serialNumber,
      name: d.accountName,
      type: d.deviceType,
      family: d.deviceFamily,
      online: d.online,
    }));
}

function call<T>(fn: (cb: (err: Error | null, res: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => fn((err, res) => (err ? reject(err) : resolve(res))));
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "login": {
      const alexa = await connect(true);
      console.log("Logged in. Devices with AUDIO_PLAYER:");
      console.table(deviceList(alexa));
      break;
    }
    case "devices": {
      const alexa = await connect(false);
      console.table(deviceList(alexa));
      break;
    }
    case "text": {
      const [serial, ...words] = args;
      const alexa = await connect(false);
      const started = Date.now();
      await call((cb) => alexa.sendSequenceCommand(serial, "textCommand", words.join(" "), cb));
      console.log(`textCommand accepted after ${Date.now() - started} ms`);
      break;
    }
    case "volume": {
      const [serial, level] = args;
      const alexa = await connect(false);
      await call((cb) => alexa.sendSequenceCommand(serial, "volume", Number(level), cb));
      console.log(`volume ${level} accepted`);
      break;
    }
    case "stop": {
      const [serial] = args;
      const alexa = await connect(false);
      await call((cb) => alexa.sendSequenceCommand(serial, "deviceStop", null, cb));
      console.log("stop accepted");
      break;
    }
    default:
      console.error("usage: login | devices | text <serial> <text> | volume <serial> <0-100> | stop <serial>");
      process.exit(2);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(`Error: ${redact(String(err && err.message ? err.message : err))}`);
  process.exit(1);
});

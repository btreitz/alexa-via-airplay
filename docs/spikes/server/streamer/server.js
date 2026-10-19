// Spike stream server: turns each receiver's raw PCM FIFO into an MP3 live
// stream, serves a static test file, and logs every request so we can see
// whether the Echo itself (LAN IP) or an Amazon server fetches the stream.

const fs = require("node:fs");
const http = require("node:http");
const { spawn, execFileSync } = require("node:child_process");

const PORT = 8099;
const ROOMS = (process.env.ROOMS || "kitchen").split(",");
const SAMPLE_RATE = 44100;
const BYTES_PER_SECOND = SAMPLE_RATE * 2 * 2; // S16_LE stereo
const TICK_MS = 20;
const SILENCE_AFTER_MS = 200;
const TEST_FILE = "/data/test.mp3";
const MODE_FILE = "/data/mode";

const recentRequests = [];
const rooms = new Map();

function log(event) {
  const line = { time: new Date().toISOString(), ...event };
  console.log(JSON.stringify(line));
  return line;
}

function createTestFile() {
  if (fs.existsSync(TEST_FILE)) return;
  // 5 minutes of a 100 ms beep every second, handy for measuring latency later
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "sine=frequency=880:duration=300",
    "-af", "volume='if(lt(mod(t,1),0.1),0.8,0)':eval=frame",
    "-ar", String(SAMPLE_RATE), "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k",
    TEST_FILE,
  ]);
}

function startRoom(name) {
  const fifo = `/pipes/${name}`;
  if (!fs.existsSync(fifo)) execFileSync("mkfifo", [fifo]);

  const room = {
    name,
    clients: new Set(),
    pcmBytes: 0,
    lastPcmAt: 0,
    levelDb: null,
    peakSum: 0,
    sampleCount: 0,
  };
  rooms.set(name, room);

  const encoder = spawn("ffmpeg", [
    "-hide_banner", "-loglevel", "warning",
    "-f", "s16le", "-ar", String(SAMPLE_RATE), "-ac", "2", "-i", "pipe:0",
    "-c:a", "libmp3lame", "-b:a", "192k", "-flush_packets", "1", "-f", "mp3", "pipe:1",
  ], { stdio: ["pipe", "pipe", "inherit"] });
  encoder.on("exit", (code) => {
    log({ event: "encoder-exit", room: name, code });
    process.exit(1);
  });
  encoder.stdout.on("data", (chunk) => {
    for (const res of room.clients) res.write(chunk);
  });
  room.encoder = encoder;

  // O_RDWR keeps the FIFO open even while Shairport Sync isn't writing,
  // so we never see EOF between AirPlay sessions.
  const input = fs.createReadStream(fifo, { flags: fs.constants.O_RDWR });
  input.on("data", (chunk) => {
    room.pcmBytes += chunk.length;
    room.lastPcmAt = Date.now();
    measureLevel(room, chunk);
    encoder.stdin.write(chunk);
  });

  // Keep the MP3 stream flowing with silence while AirPlay is paused or idle,
  // otherwise the Echo drops the connection.
  const silence = Buffer.alloc(Math.round((BYTES_PER_SECOND * TICK_MS) / 1000 / 4) * 4);
  setInterval(() => {
    if (Date.now() - room.lastPcmAt > SILENCE_AFTER_MS) encoder.stdin.write(silence);
  }, TICK_MS);
}

function measureLevel(room, chunk) {
  for (let i = 0; i + 1 < chunk.length; i += 2) {
    const sample = chunk.readInt16LE(i) / 32768;
    room.peakSum += sample * sample;
    room.sampleCount++;
  }
  if (room.sampleCount >= SAMPLE_RATE * 2) {
    const rms = Math.sqrt(room.peakSum / room.sampleCount);
    room.levelDb = rms > 0 ? Math.round(20 * Math.log10(rms) * 10) / 10 : -96;
    room.peakSum = 0;
    room.sampleCount = 0;
  }
}

function currentMode() {
  try {
    return fs.readFileSync(MODE_FILE, "utf8").trim();
  } catch {
    return "test";
  }
}

function serveTestFile(req, res) {
  const size = fs.statSync(TEST_FILE).size;
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, {
      "Content-Type": "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": end - start + 1,
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(TEST_FILE, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Length": size, "Accept-Ranges": "bytes" });
  fs.createReadStream(TEST_FILE).pipe(res);
}

function serveLive(roomName, req, res) {
  const room = rooms.get(roomName);
  if (!room) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": "audio/mpeg",
    "Cache-Control": "no-cache, no-store",
    Connection: "close",
  });
  room.clients.add(res);
  const openedAt = Date.now();
  req.on("close", () => {
    room.clients.delete(res);
    log({ event: "live-closed", room: roomName, seconds: Math.round((Date.now() - openedAt) / 1000) });
  });
}

function status() {
  return {
    mode: currentMode(),
    rooms: [...rooms.values()].map((room) => ({
      name: room.name,
      pcmMegabytes: Math.round(room.pcmBytes / 1e5) / 10,
      pcmSecondsTotal: Math.round(room.pcmBytes / BYTES_PER_SECOND),
      lastPcmSecondsAgo: room.lastPcmAt ? Math.round((Date.now() - room.lastPcmAt) / 1000) : null,
      levelDb: room.levelDb,
      listeners: room.clients.size,
    })),
    recentRequests: recentRequests.slice(-20),
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const entry = log({
    event: "request",
    method: req.method,
    path: url.pathname + url.search,
    remote: req.socket.remoteAddress,
    realIp: req.headers["x-real-ip"] || null,
    cfConnectingIp: req.headers["cf-connecting-ip"] || null,
    cfIpCountry: req.headers["cf-ipcountry"] || null,
    forwardedFor: req.headers["x-forwarded-for"] || null,
    userAgent: req.headers["user-agent"] || null,
    range: req.headers.range || null,
  });
  if (url.pathname !== "/status") {
    recentRequests.push(entry);
    if (recentRequests.length > 100) recentRequests.shift();
  }

  // Through the tunnel only the audio is reachable, not /status or /mode.
  const viaTunnel = Boolean(req.headers["cf-connecting-ip"]);
  const isAudio = ["/play.mp3", "/test.mp3"].includes(url.pathname) || url.pathname.startsWith("/live/");
  if (viaTunnel && !isAudio) {
    res.writeHead(404).end();
  } else if (url.pathname === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(status(), null, 2));
  } else if (url.pathname === "/mode" && url.searchParams.has("set")) {
    fs.writeFileSync(MODE_FILE, url.searchParams.get("set"));
    res.writeHead(200).end(`mode=${currentMode()}\n`);
  } else if (url.pathname === "/test.mp3") {
    serveTestFile(req, res);
  } else if (url.pathname.startsWith("/live/") && url.pathname.endsWith(".mp3")) {
    serveLive(url.pathname.slice(6, -4), req, res);
  } else if (url.pathname === "/play.mp3") {
    // The skill always plays /play.mp3; switch the source without redeploying it.
    const mode = currentMode();
    if (mode.startsWith("live:")) serveLive(mode.slice(5), req, res);
    else serveTestFile(req, res);
  } else {
    res.writeHead(404).end();
  }
});

createTestFile();
ROOMS.forEach(startRoom);
server.listen(PORT, () => log({ event: "listening", port: PORT, rooms: ROOMS, mode: currentMode() }));

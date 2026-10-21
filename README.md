# alexa-via-airplay

A small self-hosted service that makes Amazon Echo speakers available as
AirPlay 2 receivers. You pick which Echos to expose, and each one shows up on
your iPhone or Mac like any other AirPlay speaker.

## How it works

```
iPhone/Mac ──AirPlay 2──▶ bridge (Shairport Sync per Echo) ──MP3──▶ public HTTPS URL ──▶ Echo
                              │                                                          ▲
                              └── Alexa web API: "open <your skill>", volume, stop ──────┘
```

- One container on your LAN runs one AirPlay 2 receiver (Shairport Sync 5.6)
  per selected Echo, sharing one NQPTP clock and one Avahi.
- When you play to such a receiver, the bridge tells that Echo to open your
  own private Alexa skill. The skill answers with a short-lived signed URL of
  the bridge's stream, which the Echo then plays.
- The stream must be reachable over public HTTPS (Amazon rejects LAN URLs);
  a Cloudflare Tunnel that you run next to the bridge is the easiest way.
  Only your own Echos can play it: signed URLs, your home's public IP, and
  active sessions only.
- Volume follows the sender; the Echo stops when you stop AirPlay.

Latency is 2–4 seconds: good for music, not for video.

## Quick start

You need a Linux host with Docker on the same network as your Apple
devices, a domain on Cloudflare (or another way to publish one port over
HTTPS), and the Amazon account that owns the Echos.

1. Create a Cloudflare Tunnel with a public hostname pointing to
   `http://localhost:8099`, and run cloudflared with its token on the same
   host with host networking (SETUP.md has a compose file for it).
2. `cp .env.example .env`, set `PUBLIC_BIND=127.0.0.1`, then
   `docker compose up -d --build` (or deploy this repository as a Portainer
   stack).
3. Open `http://<host>:8098/` and follow the steps there: check the public
   URL, sign in to Amazon, create your Alexa skill by pasting the two
   generated files, select your Echos.

The full walkthrough, including the security model, troubleshooting and
limits, is in **[SETUP.md](SETUP.md)**. All options are listed in
[`.env.example`](.env.example).

## Ports

| Port | Purpose | Exposure |
|---|---|---|
| 8098/tcp | Web UI and API | LAN only, never publish |
| 8099/tcp | Public stream (`/play.mp3` only) | Through the tunnel or your HTTPS proxy |
| 3456/tcp | Amazon login proxy, only while signing in | LAN |
| 7000+/tcp | AirPlay, one per receiver | LAN |
| 319, 320/udp | NQPTP (AirPlay 2 timing) | LAN |
| 5353/udp | mDNS | LAN |

The container needs `network_mode: host`.

## Development

A pnpm workspace: the bridge (TypeScript on Node ≥ 22.18, run directly
without a build step; `tsc` only type-checks) at the root, and the web UI
(Next.js with shadcn/ui) in `web/`.

```bash
pnpm install
pnpm check           # type-check bridge and UI, run the tests
pnpm build           # build the UI (static export to web/out)
```

The receivers and audio need Linux, Shairport Sync and ffmpeg, so they run
in the container. For the HTTP side (UI, API, public listener) on a laptop:

```bash
pnpm build
DATA_DIR=./data RUN_DIR=/tmp/avb MANAGE_RECEIVERS=false pnpm start
```

To work on the UI with hot reload, run `next dev` against a running bridge
(local as above, or on another host). The dev server proxies `/api` to it;
`UI_DEV_ORIGIN` lets the bridge accept the dev server's writes:

```bash
UI_DEV_ORIGIN=http://localhost:3000 DATA_DIR=./data RUN_DIR=/tmp/avb MANAGE_RECEIVERS=false pnpm start
BRIDGE_URL=http://localhost:8098 pnpm dev:web
```

In production the UI is a static export served by the bridge itself, on the
same origin as the API; no Next.js server runs. Its CSP lists the hashes of
the page's inline scripts instead of allowing inline scripts in general.

`src/` layout:

| Folder | Role |
|---|---|
| `main.ts`, `config.ts`, `state.ts` | Entry point, environment config, persisted settings |
| `lib/` | Logging, child-process supervision |
| `bridge/` | Orchestration: receiver selection, triggering Echos, device mapping, session logic (start/stop/volume) |
| `airplay/` | Shairport Sync per Echo, PCM → MP3 broadcast, dbus/Avahi/NQPTP, receiver events over loopback MQTT, host checks |
| `alexa/` | Amazon login and commands (alexa-remote2), generated skill code |
| `public/` | Public stream listener and its checks (signed URLs, home IP, client IP), URL check |
| `ui/` | LAN API, UI file serving, API types shared with `web/` |

Tests in `test/` mirror this layout.

## Status

Personal project, not affiliated with Amazon or Apple. It relies on
Amazon's unofficial web API, which can change without notice.

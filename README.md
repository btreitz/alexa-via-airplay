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
  a Cloudflare Tunnel is the easiest way and can run inside the container.
  Only your own Echos can play it: signed URLs, your home's public IP, and
  active sessions only.
- Volume follows the sender; the Echo stops when you stop AirPlay.

Latency is 2–4 seconds: good for music, not for video.

## Quick start

You need a Linux host with Docker on the same network as your Apple
devices, a domain on Cloudflare (or another way to publish one port over
HTTPS), and the Amazon account that owns the Echos.

1. Create a Cloudflare Tunnel with a public hostname pointing to
   `http://localhost:8099`, and copy its token.
2. `cp .env.example .env`, set `TUNNEL_TOKEN`, then
   `docker compose up -d --build`.
3. Open `http://<host>:8098/` and follow the steps there: check the public
   URL, sign in to Amazon, create your Alexa skill by pasting the two
   generated files, select your Echos.

The full walkthrough, including the security model, troubleshooting and
limits, is in **[docs/setup.md](docs/setup.md)**. All options are listed in
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

TypeScript on Node ≥ 22.18, run directly without a build step (Node strips
the types); `tsc` only type-checks.

```bash
npm install
npm run check        # type-check and tests
```

The receivers and audio need Linux, Shairport Sync and ffmpeg, so they run
in the container. For the HTTP side (UI, API, public listener) on a laptop:

```bash
DATA_DIR=./data RUN_DIR=/tmp/avb MANAGE_RECEIVERS=false npm start
```

`src/` overview:

| File | Role |
|---|---|
| `main.ts` | Wires everything together |
| `bridge.ts` | Receiver selection, triggering Echos, device mapping |
| `receiver.ts`, `audio.ts` | Shairport Sync per Echo, PCM → MP3 broadcast |
| `system-services.ts`, `supervisor.ts` | dbus, Avahi, NQPTP; process supervision |
| `event-bus.ts`, `session.ts` | Receiver events over loopback MQTT; start/stop/volume logic |
| `alexa.ts` | Amazon login and commands (alexa-remote2) |
| `public-server.ts`, `signing.ts`, `public-ip.ts`, `client-ip.ts` | Public listener and its checks |
| `skill.ts` | Generated skill code and interaction model |
| `ui-server.ts`, `web/` | LAN API and UI |
| `checks.ts`, `public-url-check.ts`, `tunnel.ts` | Startup checks, URL check, built-in cloudflared |

Background: [docs/PLAN.md](docs/PLAN.md) (design and decisions) and
[docs/spikes/](docs/spikes/) plus [spikes/](spikes/) (the experiments that
proved the approach).

## Status

Personal project, not affiliated with Amazon or Apple. It relies on
Amazon's unofficial web API, which can change without notice.

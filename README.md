# Alexa via AirPlay

**Turn your Amazon Echos into AirPlay 2 speakers.**

Your Echos show up in the AirPlay menu of your iPhone, iPad and Mac, right next to
your other speakers. Pick one, press play, and the music comes out of the Echo. No
Bluetooth pairing, no Alexa app, no "Alexa, connect my phone".

<p align="center">
  <em>iPhone or Mac &nbsp;→&nbsp; AirPlay &nbsp;→&nbsp; this bridge &nbsp;→&nbsp; your Echo</em>
</p>

## Why it's nice

- **Real AirPlay 2 speakers.** Every Echo you choose becomes its own AirPlay 2 receiver.
  It works from Control Center, from the lock screen, and from every app that can play to
  AirPlay: Apple Music, Spotify, Podcasts, Audible, YouTube, Safari.
- **Group them.** AirPlay 2 lets you pick several speakers at once: play to the kitchen
  and the bathroom Echo together, or add them to a group with your other AirPlay
  speakers.
- **It just follows along.** Start AirPlay and the Echo starts by itself. Change the
  volume on your phone and the Echo follows. Stop or switch speakers and the Echo stops.
- **Alexa still works.** Say "Alexa, stop" and your phone pauses. "Alexa, resume" plays
  again.
- **Close behind your phone.** The bridge measures each Echo's buffer and trims it, so
  the Echo plays about 1.5–2 seconds behind your phone. Great for music, podcasts and
  audiobooks.
- **Yours alone.** It runs on your own hardware. The stream is only served to your own
  Echos: short-lived signed links, only from your home's internet address, only while you
  play.
- **Guided setup.** A web UI walks you through every step and tests each one, down to a
  test chime on each Echo.

## How it works, in one paragraph

A small Docker container on your home network runs one AirPlay 2 receiver per Echo. When
you play to one, the bridge asks Amazon to open your own private Alexa skill on that Echo.
The skill hands the Echo a short-lived link to the bridge's audio stream, and the Echo
plays it. Echos only play audio from public HTTPS addresses, so the stream is reachable
through a public URL of yours, typically a free Cloudflare Tunnel. [SETUP.md](SETUP.md)
has a diagram.

## What you need

- A Linux machine that's always on, with Docker, on the same network as your iPhone or
  Mac: a Raspberry Pi, a small VM or an LXC container is plenty.
- A domain on Cloudflare (the free plan is fine), or another way to publish one port over
  HTTPS.
- The Amazon account your Echos belong to, and a free Amazon developer account with the
  same login.

## Get started

1. **Make one port reachable over HTTPS**: a Cloudflare Tunnel takes about five minutes.
2. **Start the container** with `docker compose up -d --build`, or as a Portainer stack.
3. **Open the web UI** at `http://<your server>:8098` and follow the four steps: public
   URL, Amazon sign-in, your Alexa skill, your Echos.

About 30 minutes in total, most of it clicking through Amazon's developer console. The
**[setup guide](SETUP.md)** takes you through it.

## Good to know

- The delay of about 1.5–2 seconds suits music and spoken word, but not video.
- An Echo in an AirPlay group plays slightly behind HomePods and other AirPlay speakers:
  fine in different rooms, noticeable in the same one.
- The bridge controls Echos through Amazon's unofficial web API, which can change without
  notice.
- This is a personal project, not affiliated with Amazon or Apple.

---

## For developers

The bridge is TypeScript on Node ≥ 22.18, run directly without a build step. The web UI
is Next.js with shadcn/ui, exported as static files that the bridge serves itself. It's a
pnpm workspace: the bridge at the root, the UI in `web/`.

```bash
pnpm install
pnpm check        # format check, type checks, lint, tests
pnpm format       # Prettier
pnpm build        # build the web UI into web/out
```

AirPlay and audio need Linux, Shairport Sync and ffmpeg, so they run in the container. The
HTTP side (web UI, API, public listener) also runs on a laptop:

```bash
pnpm build
DATA_DIR=./data RUN_DIR=/tmp/avb MANAGE_RECEIVERS=false pnpm start
```

To work on the UI with hot reload, point the Next.js dev server at a running bridge:

```bash
UI_DEV_ORIGIN=http://localhost:3000 DATA_DIR=./data RUN_DIR=/tmp/avb MANAGE_RECEIVERS=false pnpm start
BRIDGE_URL=http://localhost:8098 pnpm dev:web
```

| Folder      | What's inside                                                                        |
| ----------- | ------------------------------------------------------------------------------------ |
| `src/`      | The bridge: AirPlay receivers, audio pipeline, Alexa control, public stream, LAN API |
| `test/`     | Tests (Node's test runner), mirroring `src/`                                         |
| `web/`      | The web UI                                                                           |
| `SETUP.md`  | Setup guide, configuration reference, security model                                 |
| `CLAUDE.md` | Architecture and code conventions, for humans and coding agents                      |

Contributions are welcome. Please run `pnpm check` before opening a pull request.

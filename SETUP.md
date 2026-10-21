# Setup guide

This guide takes you from nothing to "my Echo shows up in the AirPlay menu".
It takes about 30 minutes, most of it in Amazon's developer console.

1. [Requirements](#1-requirements)
2. [Publish the stream over HTTPS](#2-publish-the-stream-over-https)
3. [Start the container](#3-start-the-container)
4. [Enter and check the public URL](#4-enter-and-check-the-public-url)
5. [Sign in to Amazon](#5-sign-in-to-amazon)
6. [Create your Alexa skill](#6-create-your-alexa-skill)
7. [Select your Echos](#7-select-your-echos)
8. [How the stream is protected](#8-how-the-stream-is-protected)
9. [Troubleshooting](#9-troubleshooting)
10. [Limits](#10-limits)

## 1. Requirements

- **A Linux host with Docker** (Compose v2) on the same network as your
  iPhone or Mac. A Raspberry Pi 4/5 or a small VM/LXC is plenty: the whole
  stack uses a few percent of CPU and well under 100 MB of RAM. AirPlay
  discovery needs host networking, which Docker Desktop on macOS/Windows
  doesn't offer, so those don't work.
- **No other AirPlay 2 receiver on that host.** NQPTP needs UDP ports 319
  and 320 exclusively; a Shairport Sync, another NQPTP or a PTP daemon
  already running there blocks them.
- **No other mDNS responder on that host** (a host-level Avahi, or
  systemd-resolved with MulticastDNS). The container runs its own.
- **An Amazon account** that owns the Echos, and access to the
  [Alexa developer console](https://developer.amazon.com/alexa/console/ask)
  with the same account. Developer accounts are free.
- **A way to make one port reachable over HTTPS from the internet**, with a
  public DNS name and a valid certificate. A Cloudflare Tunnel is the
  simplest; see the next step. You run it yourself: the bridge doesn't
  include or start one.

## 2. Publish the stream over HTTPS

The Echo doesn't play from your LAN directly: Amazon checks every stream URL
before handing it to the Echo and rejects hosts that don't resolve publicly
or resolve to a private address. Split DNS and LAN-only setups therefore
don't work. The Echo then fetches the stream itself, from your home through
the public URL.

Only one path is published: `/play.mp3` on the bridge's **public port
(8099)**: the Echo streams from it (GET), and your skill reports playback to
it (POST). Everything else there answers 404. The web UI (port 8098) must
never be published.

### Option A: Cloudflare Tunnel (recommended)

You need a domain on Cloudflare (the free plan is fine).

1. In the Cloudflare dashboard, open **Zero Trust → Networks → Tunnels →
   Create a tunnel**, type **Cloudflared**, and give it a name.
2. On the install step, copy the **token**: the long string after
   `--token` in the shown command, starting with `eyJ`.
3. Add a **public hostname**: subdomain e.g. `airplay`, your domain, service
   type **HTTP**, URL **`localhost:8099`**.
4. Recommended: add a **Cache Rule** (Caching → Cache Rules) for that
   hostname with **Bypass cache**. The bridge already marks every answer as
   not cacheable; the rule makes sure that stays true.
5. Run cloudflared with that token **on the bridge's host, with host
   networking**, so `localhost:8099` reaches the bridge and the bridge
   recognizes it as the trusted proxy on loopback. For example as its own
   compose project or Portainer stack, kept apart from the bridge:

   ```yaml
   services:
     cloudflared:
       image: cloudflare/cloudflared:2026.10.1
       restart: unless-stopped
       network_mode: host
       command: tunnel --no-autoupdate run
       environment:
         TUNNEL_TOKEN: ${TUNNEL_TOKEN} # from .env or the stack's variables; never commit it
   ```

   Then set `PUBLIC_BIND=127.0.0.1` for the bridge (step 3): only
   cloudflared needs the public port, so it stays off your LAN. The
   defaults `CLIENT_IP_HEADER=cf-connecting-ip` and
   `TRUSTED_PROXIES=127.0.0.1,::1` already fit this setup.

   If cloudflared runs elsewhere (another host, or a container without host
   networking), point the public hostname to `http://<bridge host>:8099`
   instead, leave `PUBLIC_BIND` at its default, and set `TRUSTED_PROXIES`
   to the address the bridge sees cloudflared connect from.

Two pitfalls:

- **One subdomain level only.** Cloudflare's free certificate covers
  `airplay.example.com`, not `airplay.home.example.com`. A deeper name gets
  no valid certificate, and Amazon refuses the URL.
- **Don't look the name up before it exists.** If anything (you, the
  bridge's check, your Pi-hole, an Echo) asks for the hostname before the
  record exists, the "doesn't exist" answer is cached for up to 30 minutes
  by your resolver, Amazon and the Echo. Create the public hostname first,
  then test.

Quick tunnels (`trycloudflare.com`) change their URL on every start and are
not supported.

### Option B: your own reverse proxy

Any reverse proxy with a valid certificate works (Nginx Proxy Manager,
Caddy, Traefik, Tailscale Funnel, …). Point a public hostname to
`http://<bridge host>:8099`, disable response buffering (Nginx:
`proxy_buffering off;`), and tell the bridge which header carries the real
client address and which proxy may set it:

```bash
CLIENT_IP_HEADER=x-real-ip           # or x-forwarded-for
TRUSTED_PROXIES=192.168.1.10         # the proxy's address as the bridge sees it
```

If the bridge's public port is forwarded directly (no proxy in between),
use `CLIENT_IP_HEADER=none`.

## 3. Start the container

```bash
git clone <this repository> alexa-via-airplay
cd alexa-via-airplay
cp .env.example .env        # then set what you need, e.g. PUBLIC_BIND
docker compose up -d --build
docker compose logs --since 2m
```

With **Portainer**, create a stack from this Git repository (compose path
`compose.yaml`) instead, and set the values from `.env.example` as the
stack's environment variables. Portainer builds the image from the
repository.

The log should show three passing checks (`host-network`, `ptp-ports`,
`mdns`). Then open the web UI at **`http://<host>:8098/`**.

All state (settings, Amazon session, signing secret) lives in the volume
`alexa-via-airplay_data`, whatever the compose project or stack is called. Back it up like any other secret; never commit it.

Moving to another host: export the settings in the web UI (Settings →
Export settings) and import the file on the new host's Introduction page
("Already have a settings file?"). The file holds the public URL, the
skill's invocation name and signing secret, the Amazon site, the speakers
and which Echo is which, and the playback and security settings, so the
deployed skill keeps working. Not in the file: the Amazon sign-in (sign in
again) and `.env`. The raw `state.json` from the old `data` volume works
as an import too.

## 4. Enter and check the public URL

In the UI under **Public URL**, enter the HTTPS base URL, e.g.
`https://airplay.example.com`, and **Save**. Then press **Check**: the
bridge sends a request to itself through that URL and reports whether it
arrived over valid HTTPS, and whether it came from your home's public IP.
Fix anything it reports before going on.

## 5. Sign in to Amazon

Under **Amazon**, pick the Amazon site your account is registered on (e.g.
amazon.de) and press **Sign in**. Open the link that appears; it shows
Amazon's normal login page through a small proxy on the bridge (port 3456).
Sign in, including two-step verification. When the page says it's done,
close it; the UI switches to "signed in" and lists your Echos.

The bridge stores the session in `/data/alexa-session.json` and refreshes
it automatically. Amazon's web API is unofficial: if a change on Amazon's
side breaks the login, sign in again or update the bridge.

## 6. Create your Alexa skill

Every user creates their own private skill; it never gets published. It
only tells the Echo where to fetch the stream. The UI shows the two files
to paste, with copy buttons.

In the [Alexa developer console](https://developer.amazon.com/alexa/console/ask),
signed in with the **same Amazon account as your Echos**:

1. **Create Skill**: any name (e.g. "AirPlay Bridge"); primary locale = the
   **language your Echos use** (Alexa app → device → Language); experience
   **Other**; model **Custom**; hosting **Alexa-hosted (Node.js)**; any
   region; template **Start from Scratch**.
2. **Build → Interaction Model → JSON Editor**: replace everything with the
   **interaction model** from the UI, **Save**.
3. **Build → Interfaces**: enable **Audio Player**, **Save**, then
   **Build skill**.
4. **Code → `lambda/index.js`**: replace everything with the **skill code**
   from the UI, **Save**, **Deploy**.
5. **Test**: set skill testing to **Development**. (The console's simulator
   doesn't play audio; test on a real Echo.)

If your Echos use several languages, add each under **Build → Language
settings** and paste the same interaction model there.

The skill code contains the **signing secret**. Keep it private. If it
leaks, press **Rotate secret** in the UI and paste the new code (step 4).
Changing the public URL also means pasting new code.

## 7. Select your Echos

Under **Echos**, switch on each Echo that should appear in AirPlay and give
it a name if you like. It shows up in the AirPlay menu within a few seconds.

Press **Test** once per Echo: the bridge starts the skill on it ("open
<invocation name>") so it can learn which of Amazon's device IDs belongs to
which Echo. The Echo should start playing silence and show **mapped**. Press
**Stop** afterwards.

Now pick the Echo in AirPlay and play something. The bridge starts the Echo
by itself; expect 2–4 seconds of delay.

What happens automatically:

- **AirPlay starts** → the Echo starts within a few seconds.
- **AirPlay volume** → the Echo's volume follows (switchable).
- **Paused for longer than the idle timeout** (default 60 s), or **AirPlay
  switched to another speaker** → the Echo stops.
- **"Alexa, stop"** (or the Echo's play/pause button) → the iPhone/Mac is
  paused within a second or two: the skill reports it to the bridge.
  **"Alexa, resume"** → the iPhone/Mac plays again. With skill code from
  before these reports, the pause comes only after about a minute, when the
  Echo drops the stream.
- **Delay.** The Echo buffers a few seconds before it plays. The bridge
  learns how much from the skill's reports, starts later sessions with a
  burst of the latest audio so the Echo plays at once, and by default
  catches up in pauses and silence until the Echo is about 1.5 s behind.
  **Settings → Preset** picks how: **Low latency** catches
  up right away and keeps the Echo connected through pauses of up to 10
  minutes; **Balanced** (the default, music) catches up in pauses and
  silence; **Uninterrupted** (podcasts, audiobooks) never leaves anything
  out. **Custom** sets the idle timeout and catch-up one by one.

## 8. How the stream is protected

The public listener serves only `GET /play.mp3`, and only when all three
checks pass. Every failure gets the same plain 404.

1. **Short-lived signed URLs.** Your skill signs each stream URL with
   HMAC-SHA256 and a secret only the bridge and your skill know; the link is
   valid for 60 seconds. The secret is never in a URL and never logged.
2. **Your home only.** The bridge learns its own public IPv4 and IPv6 every
   few minutes and serves only requests from the same IPv4, or the same
   IPv6 /64. While it doesn't know its public IP, it serves nobody and says
   so in the UI. Switchable under **Settings** for setups where Echos reach
   the internet through a different IP (VPN, second uplink).
3. **Active sessions only.** The device ID must belong to one of your
   selected Echos, and that Echo must be in an active AirPlay session or
   have been started by the bridge seconds ago. One connection per Echo; a
   new one replaces the old.

The skill's playback reports (`POST /play.mp3`) are signed the same way,
over a different message, so a stream URL can't be used as a report or the
other way round. Each report is accepted once. They come from Amazon's
cloud, so the home IP check doesn't apply to them; they only tell the bridge
that an Echo started, stopped or was resumed.

What this protects against: someone who finds or guesses the URL, scanners,
replayed or shared links (they expire), anyone outside your home, and
listening in when you aren't playing anything. That keeps the stream
private to your own Echos and avoids redistributing what you play.

What it doesn't protect against:

- Someone who has your **skill code** (and so the secret) and is **on your
  home network**, or behind the **same public IPv4**, during an active
  session. Keep the skill code private.
- **CGNAT**: if your provider shares one public IPv4 among many customers
  (common with mobile and some fiber/cable providers), the home IP check
  lets in everyone behind that address. The other two checks still apply.
  IPv6 is checked by /64 prefix, which is yours alone in typical setups.
- Anything on the **LAN listener** (port 8098): it has no login. Never
  publish it; keep it on a trusted network.

## 9. Troubleshooting

Look at **Diagnostics** in the UI first: it shows the startup checks, the
public URL check, the home IP state and the last public requests with the
reason each was refused. For logs, run short one-off checks rather than
long follow sessions:

```bash
docker compose logs --since 5m
```

| Symptom                                         | Likely cause                                                                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Receiver doesn't appear in AirPlay              | Not host networking; another mDNS responder or AirPlay 2 receiver on the host (see the startup checks); the iPhone is on another VLAN without mDNS forwarding. |
| Echo says it can't play / "there was a problem" | Public URL check fails; the skill code is outdated (URL or secret changed); the request was refused (Diagnostics → last requests).                             |
| `home-ip-unknown` refusals                      | The bridge can't reach `PUBLIC_IP_TRACE_URL`; check outbound internet.                                                                                         |
| `home-ip-mismatch` refusals                     | Echos leave through another IP; or a reverse proxy sets a header the bridge doesn't trust (`CLIENT_IP_HEADER`, `TRUSTED_PROXIES`).                             |
| `device-unknown` refusals                       | The Echo was never started by the bridge; press **Test** once.                                                                                                 |
| `no-session` refusals                           | "Alexa, open …" was said while nothing played via AirPlay. Start AirPlay instead.                                                                              |
| Echo doesn't start by itself                    | Amazon session expired (sign in again); the invocation name in the UI differs from the skill's.                                                                |
| Hostname "not found" right after creating it    | Negative DNS caching; wait up to 30 minutes.                                                                                                                   |

## 10. Limits

- **Latency 2–4 seconds.** Fine for music, not for video. Echos won't be in
  sync with other AirPlay speakers in the same group.
- **Echo groups and stereo pairs** aren't supported; each Echo is its own
  receiver.
- **Amazon's unofficial web API** can change at any time; logins or commands
  may break until the bridge is updated.
- **Cloudflare's terms** restrict using its network mainly for audio/video
  delivery. A few personal streams are unlikely to matter, but it's one
  reason the tunnel is a recommendation, not a requirement.

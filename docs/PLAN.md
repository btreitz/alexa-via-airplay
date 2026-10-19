# Alexa AirPlay Bridge: implementation plan

A small self-hosted service with one job: make selected Echo speakers show up
as AirPlay 2 receivers. Updated 2026-10-19 with the spike results
(`spikes/README.md`) and the public endpoint protection requirements.

## Decisions

- **AirPlay 2 is required.** One Shairport Sync 5.6 process per selected Echo,
  sharing one NQPTP and one Avahi.
- **The stream must be publicly reachable over HTTPS.** Amazon checks the Play
  URL before it reaches the Echo and rejects hosts that don't resolve publicly
  or that resolve to a private IP. LAN-only streaming and split DNS are off the
  table.
- **A named Cloudflare Tunnel is the recommended way to publish the stream, not
  a requirement.** The bridge only needs a "public base URL"; a reverse proxy,
  Tailscale Funnel or anything else that serves it over valid HTTPS works too.
  Quick tunnels are dev-only and not supported.
- **Every user creates their own Alexa-hosted skill.** No shared or certified
  skill. The bridge generates the skill code and interaction model; the user
  pastes them into the developer console.
- **The skill stays static.** It never calls the bridge; it answers every
  launch with `AudioPlayer.Play` for a freshly signed, short-lived URL:
  `<public base URL>/play.mp3?d=<device ID>&exp=<unix now + 60 s>&sig=<HMAC-SHA256(secret, d|exp), base64url>`.
- **Only the user's own Echos may play the stream** (security, and no public
  redistribution of Spotify and similar content). The public listener checks
  a signed URL, the home's public IP and an active session; see "Public
  endpoint protection".

## What the spikes proved

| Question | Result |
|---|---|
| Several AirPlay 2 receivers on one host | Works. Shared NQPTP and Avahi, distinct name and port per receiver, selectable together on iOS, about 1 % CPU each. Needs `output_backend = "pipe"` (or stdout); the ALSA default crashes in a container. |
| Who fetches the stream | The Echo itself (UA `Echo/1.0(APNG)`), not Amazon. Amazon only validates the URL. |
| LAN-only stream | Rejected by Amazon: `INVALID_RESPONSE: The URL specified in the Play directive is invalid`. |
| Stream through a named Cloudflare Tunnel | Works, no buffering issues at 192 kbit/s MP3. |
| iPhone → AirPlay 2 → Echo end to end | Works. Pause-to-silence delay roughly 2–4 s. |
| Device mapping via `d=` | Amazon's device ID is stable per Echo across launches; a second Echo shows a different ID. |
| Resource use | Whole stack about 4 % CPU and 70 MB RAM on a 2-core LXC. |

Smaller findings:

- **Skill code:** the console's code checker rejects modern syntax such as
  optional chaining (`?.`), and the runtime is Node 16. Generated skill code
  must stay plain.
- **Simulator:** the developer console simulator doesn't play AudioPlayer
  streams. Test only on a real Echo.
- **Negative DNS caching:** if a hostname is looked up before it exists,
  Amazon's resolver, Pi-hole and the Echo cache the "not found" answer for up
  to 30 minutes on Cloudflare zones.
- **Cloudflare certificates:** the free certificate covers one subdomain level
  only (`bridge.example.com`, not `bridge.home.example.com`).
- **D-Bus:** a second Shairport Sync instance can't acquire the
  `org.gnome.ShairportSync` and MPRIS bus names.

## Architecture

One container with host networking (required for mDNS and NQPTP's UDP
319/320) and one `/data` volume.

1. **Receiver manager.** Starts NQPTP and Avahi once. Starts or stops one
   Shairport Sync process per selected Echo at runtime, each with its own name,
   port, NQPTP interface name and output pipe. Changing the selection doesn't
   require editing Compose.
2. **Stream server, two listeners:**
   - **Public listener:** serves only `/play.mp3`, and only when all checks
     in "Public endpoint protection" pass. It maps `d` to an Echo and streams
     that Echo's receiver, one connection per Echo. Everything else returns
     the same 404. This is the only port the tunnel points to.
   - **LAN listener:** UI, API, status. Never published.

   Per receiver: PCM → ffmpeg MP3 → all connected clients, with silence while
   AirPlay is paused so the Echo doesn't drop the stream.
3. **Alexa controller** (`alexa-remote2`):
   - Amazon login through its login proxy, including 2FA, with the session
     cookie stored in `/data`.
   - Device list.
   - Triggering the skill on one specific Echo with a text command
     ("open my sound bridge").
   - Volume.
4. **Device mapping.** When the bridge triggers Echo X and a request arrives
   with an unknown `d` within a few seconds, that ID belongs to X. The mapping
   is stored, so it only happens once per Echo.
5. **Session logic.**
   - AirPlay starts → trigger the Echo.
   - AirPlay idle longer than a timeout → stop the Echo.
   - Echo drops the stream ("Alexa, stop", button) → pause the sender, if
     D-Bus control works per instance.
   - iPhone volume → Echo volume with debouncing; Shairport Sync runs with
     `ignore_volume_control = "yes"` so the volume isn't applied twice.
6. **Skill generator.** Produces the interaction model and `index.js` with the
   public base URL and signing secret filled in (the code signs each URL with
   Node's built-in `crypto`), plus copy buttons and step-by-step console
   instructions in the UI.

## Public endpoint protection

All three checks run on every `/play.mp3` request; any failure gets the same
plain 404 without a reason. Query strings are never logged in full, `sig`
never.

1. **Short-lived signed URLs.** The skill signs `d + "|" + exp` with
   HMAC-SHA256 and a secret the bridge generates (stored in `/data`, never in
   a URL, never logged, rotatable, which means regenerating the skill code).
   `exp` is now + 60 s; the bridge allows 30 s clock skew and refuses links
   valid more than 5 minutes ahead. Launch, resume and the play button each
   get a fresh URL. A link only has to be valid when the Echo connects; the
   running stream isn't cut when it expires.
2. **Home IP only.** The bridge looks up its public IPv4 and IPv6 every few
   minutes (`https://cloudflare.com/cdn-cgi/trace` per address family,
   configurable) and accepts a client only if it matches the IPv4 exactly or
   falls inside the same IPv6 /64 (configurable). On a mismatch it looks
   again first (rate-limited), so a changed IP costs one lookup. If the
   address is unknown or hasn't been confirmed for 30 minutes, requests fail
   closed and the UI and log say so. The client IP comes from
   `cf-connecting-ip` (configurable) only when the connection comes from a
   trusted proxy (default loopback, i.e. cloudflared on the host); otherwise
   the socket address is used. Switchable in the settings (default on) for
   setups where the Echos leave through another IP. Caveat: behind CGNAT,
   other customers of the ISP share the IPv4, so the check narrows access
   less; the other two checks still apply.
3. **Active session only.** `d` must map to a selected Echo, or be unknown
   right after the bridge triggered that Echo (learning window). That Echo's
   receiver must have an active AirPlay session, or the bridge must have
   triggered it within the last 20 s. One connection per Echo; a new valid
   connection replaces the old one.

What this doesn't protect against: someone who has the skill code (and so
the secret) and is on the same home network or behind the same CGNAT IPv4,
during an active session. The skill code is private to the user's developer
account.

## Milestones

1. **Alexa control spike (biggest remaining unknown).** With `alexa-remote2`:
   log in, list devices, send "open my sound bridge" as a text command to one
   chosen Echo, set volume. Pass if the Echo starts the stream without anyone
   speaking.
2. **Core service.** Receiver manager plus stream server with both listeners,
   device mapping and all three checks from "Public endpoint protection".
   Reuse the spike streamer as the starting point.
3. **Session logic.** Start, stop, idle timeout and volume forwarding. Find out
   how Shairport Sync 5.6 names D-Bus services per instance; without that,
   "Echo stopped → pause iPhone" is not possible.
4. **Packaging and setup guide.**
   - Image based on `mikebrady/shairport-sync:5.6` plus Node and ffmpeg;
     pin Shairport Sync and NQPTP together.
   - Optional built-in cloudflared: if a tunnel token is set, the bridge runs
     the tunnel itself.
   - Startup checks: UDP 319/320 free, no other Avahi on the host, public base
     URL reachable.
   - Setup guide: public URL (tunnel recommended), the DNS caching pitfall,
     skill creation, Amazon login.
5. **UI.** Amazon login state, device list with selection, receiver status,
   skill instructions. Plain at first.
6. **Later, optional.**
   - Automated skill creation through Amazon's skill management API.
   - Latency compensation per receiver.
   - Voice next/previous, which would need the skill to call the bridge.

## User setup (target)

1. Make the bridge's public port reachable over HTTPS (Cloudflare Tunnel
   recommended) and enter that URL.
2. Start the container.
3. Sign in to Amazon in the bridge's UI.
4. Create an Alexa-hosted skill and paste the two generated files.
5. Select the Echos that should appear as AirPlay receivers.

## Risks and limits

- **Amazon's unofficial login and web API** can break at any time; that's the
  main ongoing maintenance cost.
- **Multi-instance AirPlay 2 is new upstream** (Shairport Sync 5.6, October
  2026). It works in the spike, but pin versions.
- **Latency of 2–4 s.** Fine for music, not for video. Echos and real AirPlay
  speakers in one group won't be in sync.
- **Public stream endpoint.** Protected by signed short-lived URLs, the home
  IP check and session gating (see above). Keep the secret long, allow
  rotating it (that means regenerating the skill code), and never expose the
  LAN listener. The home IP check is weaker behind CGNAT.
- **Cloudflare's terms** limit using its network mainly for audio or video
  delivery. At a few personal streams this is unlikely to matter, but it's one
  more reason the tunnel is a recommendation, not a requirement.
- **Echo groups and stereo pairs** aren't supported; each Echo is its own
  receiver.

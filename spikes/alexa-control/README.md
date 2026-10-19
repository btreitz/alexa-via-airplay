# Milestone 1 spike: Alexa control

Can the bridge start the skill on one specific Echo without anyone speaking?
Runs on the Docker LXC with `alexa-remote2` 8.1.1.

```bash
cp .env.example .env            # AMAZON_PAGE, PROXY_OWN_IP (the LXC's LAN IP)
docker compose run --rm ctl login        # open the printed URL, log in (2FA works)
docker compose run --rm ctl devices
docker compose run --rm ctl text <serial> open my sound bridge
docker compose run --rm ctl volume <serial> 25
docker compose run --rm ctl stop <serial>
```

To watch the Echo fetch the stream, put `TUNNEL_TOKEN=...` in `tunnel.env`
(git-ignored) and `docker compose --profile stream up -d`.

## Results (2026-10-19)

**Passed.** Account on amazon.de, Echo language English (US), skill
"Sound Bridge Test" (invocation "my sound bridge").

- **Login:** the proxy at `http://<LXC IP>:3456/` worked with 2FA on the first
  try. The session (`alexa.cookieData`, about 8 KB, includes refresh token and
  `macDms`) is stored and reused; later runs need no browser.
- **Devices:** both Echos plus a "WHA" group (`Überall`) and a Bluetooth
  headset show up with `AUDIO_PLAYER`. Filter on `deviceFamily === "ECHO"`
  (and probably other speaker families) for the selection list.
- **Text command** `open my sound bridge` via `sendSequenceCommand(serial,
  "textCommand", …)`: accepted after about 230 ms; the Echo fetched
  `/play.mp3` about 4 s later (UA `Echo/1.0(APNG)`, `d=AMUJQV4RH4RIXMV5`),
  and played without anyone speaking. Alexa says nothing before playing.
- **Volume** via `sendSequenceCommand(serial, "volume", n)` works while
  playing, audible both directions.
- **Stop** via `sendSequenceCommand(serial, "deviceStop")` stops playback.
- Each one-shot run does a full `init()` (about 2–3 s); the service should
  keep one long-lived instance.

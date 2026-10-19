# Spikes: AirPlay 2 → Echo

Two tests before implementation. Both run temporarily on the Docker LXC
`192.168.2.248` and are removed afterwards.

- **Test A**: Several AirPlay 2 receivers on one host (Shairport Sync 5.6, one
  shared NQPTP and Avahi). Passes if the iPhone shows both receivers, can select
  them **together**, and both deliver audio.
- **Test B**: An Echo plays an HTTPS stream from the LAN, triggered by a static
  Alexa-hosted skill. Passes if the Echo plays and the stream server's log shows
  the request coming from the Echo's LAN IP.
- **Combined**: iPhone → AirPlay 2 → Echo, with a rough latency measurement.

## Files

| Path                                | Purpose                                                 |
| ----------------------------------- | ------------------------------------------------------- |
| `server/docker-compose.yml`         | NQPTP, Avahi, two receivers, stream server              |
| `server/config/*.conf`              | Receiver name, port, NQPTP clock and pipe per receiver  |
| `server/streamer/server.js`         | PCM → MP3 live streams, test file, request log, status  |
| `skill/index.js`                    | Code for the Alexa-hosted skill                         |
| `skill/interaction-model.en-US.json`| Interaction model, invocation name `my sound bridge`    |

The server files are already copied to `/root/airplay2-spike/` on the LXC and
the images are pulled.

## Test A: Several AirPlay 2 receivers

```bash
ssh root@192.168.2.248
cd /root/airplay2-spike
docker compose up -d
docker compose logs -f kitchen bedroom   # until both report they are listening
```

On the iPhone: Control Center → AirPlay. **Spike Kitchen** and **Spike Bedroom**
must show up. Select **both**, play music for about 30 seconds.

```bash
curl -s localhost:8099/status
```

Pass if both rooms show `pcmSecondsTotal` growing at about one second per second
and a `levelDb` well above `-96`. Also note CPU usage (`docker stats --no-stream`)
and any NQPTP or clock errors in `docker compose logs`.

## Test B: The Echo plays a LAN stream

### Proxy host in Nginx Proxy Manager

`*.home.trtz.dev` already resolves to `.248` via Pi-hole, and the wildcard
certificate exists. Add one proxy host:

- **Domain**: `echotest.home.trtz.dev`
- **Forward**: `http://192.168.2.248:8099`
- **SSL**: the existing `*.home.trtz.dev` certificate, Force SSL
- **Advanced**: `proxy_buffering off;`

Check from the Mac: `curl -sI https://echotest.home.trtz.dev/test.mp3` returns
`200` and `audio/mpeg`.

### Alexa-hosted skill

In the [Alexa developer console](https://developer.amazon.com/alexa/console/ask),
with the same Amazon account as the Echos:

1. **Create Skill**: name `Sound Bridge Test`, primary locale **English (US)**,
   experience **Other**, model **Custom**, hosting **Alexa-hosted (Node.js)**,
   region EU (Ireland), template **Start from scratch**.
2. **Build → Interaction Model → JSON Editor**: paste
   `skill/interaction-model.en-US.json`, **Save**.
3. **Build → Invocations**: check that the invocation name is
   `my sound bridge`.
4. **Build → Interfaces**: enable **Audio Player**, **Save**, then **Build skill**.
5. **Code → `lambda/index.js`**: replace everything with `skill/index.js`,
   **Save**, **Deploy**.
6. **Test**: set skill testing to **Development**.

The skill locale must match the language set on the Echo (Alexa app → device →
Language). If the Echo uses English (UK), pick that locale instead, or add it
under **Build → Language settings** and paste the same model there.

### Run it

```bash
docker compose logs -f streamer   # on the LXC, keep it open
```

Say **"Alexa, open my sound bridge"**. The test file plays a short beep every
second for 5 minutes. Stop with "Alexa, stop".

In the log, the `request` events for `/play.mp3` show who fetched the stream:

- `realIp` is an Echo address from `192.168.2.x`: The Echo fetches the stream
  itself. **LAN-only works.**
- Amazon address, or no request at all: The stream must be publicly reachable;
  the fallback is a Cloudflare Tunnel.

Also note the `userAgent`, whether `range` is used, and how long playback
takes to start. Errors from the Echo arrive at the skill as
`System.ExceptionEncountered`: **Code → CloudWatch logs** in the console.

## Combined: iPhone → Echo

```bash
curl -s "localhost:8099/mode?set=live:kitchen"
```

Select only **Spike Kitchen** on the iPhone, play music, then say
"Alexa, open my sound bridge". The Echo should play the iPhone audio.

Rough latency: pause on the iPhone and count until the Echo goes quiet. For a
more precise value, play a click track and record iPhone and Echo with a
second phone.

Switch back with `mode?set=test`.

## Clean up

```bash
cd /root/airplay2-spike && docker compose down -v
cd / && rm -rf /root/airplay2-spike
docker image rm mikebrady/shairport-sync:5.6 node:22-alpine
```

Then delete the proxy host in Nginx Proxy Manager. Keep the skill if
implementation follows; otherwise delete it in the developer console.

## Results (2026-10-18)

- **Test A passed.** Two Shairport Sync 5.6 receivers with one shared NQPTP and
  Avahi show up as separate AirPlay 2 devices, can be selected together, and
  each delivers real-time PCM (about 1 % CPU each, streamer about 3–9 %).
  Needs `output_backend = "pipe"`; the default ALSA backend crashes.
- **Test B passed, but not LAN-only.** Amazon validates the Play URL without
  fetching it: a host that doesn't resolve publicly, or resolves to a private
  IP, is rejected with `INVALID_RESPONSE: The URL specified in the Play
  directive is invalid`. The Echo then fetches the stream itself
  (UA `Echo/1.0(APNG)`, home WAN IP). The stream must therefore be publicly
  reachable; a named Cloudflare Tunnel works.
- **Combined test passed.** iPhone → AirPlay 2 → Spike Kitchen → MP3 →
  tunnel → Echo plays the iPhone audio. Pause-to-silence delay is roughly
  2–4 s (Echo buffering, MP3 encoding, tunnel), fine for music, not for video.
- The developer console simulator does not play AudioPlayer streams; test on a
  real Echo.
- Watch out for negative DNS caching (30 min on Cloudflare zones) in Amazon's
  resolver, Pi-hole and the Echo when a hostname is queried before it exists.

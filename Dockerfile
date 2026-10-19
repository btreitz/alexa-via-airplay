# alexa-via-airplay: AirPlay 2 receivers for Amazon Echo speakers.
#
# Shairport Sync 5.6 and NQPTP 1.2.9 come pinned together in the upstream
# image; the digest keeps them from changing underneath us. Update both pins
# deliberately and test multi-instance AirPlay 2 again when doing so.
ARG SHAIRPORT_IMAGE=mikebrady/shairport-sync:5.6@sha256:ff6235d83fa10c78600f4c7c803f33825bd050df3e7c3c60cc94b3572569d6d6
ARG CLOUDFLARED_IMAGE=cloudflare/cloudflared:2026.10.1@sha256:a15a3b50b8dabd57ac2090e9484c0247dba9dfa1f0df4d298d4317f9d69eb2d5

FROM ${CLOUDFLARED_IMAGE} AS cloudflared

FROM ${SHAIRPORT_IMAGE}

# The base image ships a minimal FFmpeg build in /usr/local/lib for Shairport
# Sync, which musl's loader prefers. Alpine's ffmpeg needs its own libraries,
# so it runs through a wrapper; Shairport Sync keeps using its build.
RUN apk add --no-cache nodejs ffmpeg tini \
 && printf '#!/bin/sh\nLD_LIBRARY_PATH=/usr/lib exec /usr/bin/ffmpeg "$@"\n' > /usr/local/bin/ffmpeg-mp3 \
 && chmod +x /usr/local/bin/ffmpeg-mp3 \
 && node --version \
 && test "$(ffmpeg-mp3 -hide_banner -loglevel error -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 -c:a libmp3lame -f mp3 - | wc -c)" -gt 1000

# Optional built-in tunnel (used only when TUNNEL_TOKEN is set).
COPY --from=cloudflared /usr/local/bin/cloudflared /usr/local/bin/cloudflared
RUN cloudflared --version

WORKDIR /app
COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .build npm \
 && npm ci --omit=dev --no-audit --no-fund \
 && npm cache clean --force \
 && apk del .build

COPY src ./src
COPY web ./web

ENV NODE_ENV=production \
    DATA_DIR=/data \
    FFMPEG_PATH=/usr/local/bin/ffmpeg-mp3
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD ["node", "--disable-warning=ExperimentalWarning", "src/healthcheck.ts"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.ts"]

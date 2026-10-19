# alexa-via-airplay: AirPlay 2 receivers for Amazon Echo speakers.
#
# Shairport Sync 5.6 and NQPTP 1.2.9 come pinned together in the upstream
# image; the digest keeps them from changing underneath us. Update both pins
# deliberately and test multi-instance AirPlay 2 again when doing so.
ARG SHAIRPORT_IMAGE=mikebrady/shairport-sync:5.6@sha256:ff6235d83fa10c78600f4c7c803f33825bd050df3e7c3c60cc94b3572569d6d6
ARG CLOUDFLARED_IMAGE=cloudflare/cloudflared:2026.10.1@sha256:a15a3b50b8dabd57ac2090e9484c0247dba9dfa1f0df4d298d4317f9d69eb2d5
ARG NODE_BUILD_IMAGE=node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f

# --- Build: web UI (Next.js static export) and the bridge's production dependencies
FROM ${NODE_BUILD_IMAGE} AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/
RUN pnpm install --frozen-lockfile

# The UI type-checks against the bridge's API types in src/.
COPY src src
COPY web web
RUN pnpm --filter @alexa-via-airplay/web build

# Only the bridge's runtime dependencies, without the web workspace.
RUN mkdir /prod && cp package.json pnpm-lock.yaml pnpm-workspace.yaml /prod/ \
 && mkdir /prod/web && cp web/package.json /prod/web/ \
 && cd /prod && pnpm install --prod --frozen-lockfile --filter alexa-via-airplay

FROM ${CLOUDFLARED_IMAGE} AS cloudflared

# --- Runtime
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
COPY --from=build /prod/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY --from=build /build/web/out ./web/out

ENV NODE_ENV=production \
    DATA_DIR=/data \
    FFMPEG_PATH=/usr/local/bin/ffmpeg-mp3
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD ["node", "--disable-warning=ExperimentalWarning", "src/healthcheck.ts"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.ts"]

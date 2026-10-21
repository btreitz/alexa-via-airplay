# Shairport Sync 5.6 and NQPTP 1.2.9 are pinned together by digest: update both
# deliberately and test multi-instance AirPlay 2 again.
ARG SHAIRPORT_IMAGE=mikebrady/shairport-sync:5.6@sha256:ff6235d83fa10c78600f4c7c803f33825bd050df3e7c3c60cc94b3572569d6d6
ARG NODE_BUILD_IMAGE=node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f

FROM ${NODE_BUILD_IMAGE} AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/
RUN pnpm install --frozen-lockfile

COPY src src
COPY web web
RUN pnpm --filter @alexa-via-airplay/web build

RUN mkdir /prod && cp package.json pnpm-lock.yaml pnpm-workspace.yaml /prod/ \
 && mkdir /prod/web && cp web/package.json /prod/web/ \
 && cd /prod && pnpm install --prod --frozen-lockfile --filter alexa-via-airplay

FROM ${SHAIRPORT_IMAGE}

# musl prefers the base image's minimal FFmpeg in /usr/local/lib; Alpine's
# ffmpeg needs its own libraries, hence the wrapper.
RUN apk add --no-cache nodejs ffmpeg tini \
 && printf '#!/bin/sh\nLD_LIBRARY_PATH=/usr/lib exec /usr/bin/ffmpeg "$@"\n' > /usr/local/bin/ffmpeg-mp3 \
 && chmod +x /usr/local/bin/ffmpeg-mp3 \
 && node --version \
 && test "$(ffmpeg-mp3 -hide_banner -loglevel error -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 -c:a libmp3lame -f mp3 - | wc -c)" -gt 1000

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

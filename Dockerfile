# Shairport Sync 5.6 and NQPTP 1.2.9 come pinned together in the upstream image.
FROM mikebrady/shairport-sync:5.6

# The base image ships a minimal FFmpeg build in /usr/local/lib for Shairport
# Sync, which musl's loader prefers. Alpine's ffmpeg needs its own libraries,
# so it runs through a wrapper; Shairport Sync keeps using its build.
RUN apk add --no-cache nodejs ffmpeg tini \
 && printf '#!/bin/sh\nLD_LIBRARY_PATH=/usr/lib exec /usr/bin/ffmpeg "$@"\n' > /usr/local/bin/ffmpeg-mp3 \
 && chmod +x /usr/local/bin/ffmpeg-mp3 \
 && node --version \
 && ffmpeg-mp3 -hide_banner -loglevel error -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 -c:a libmp3lame -b:a 192k -f mp3 - | wc -c \
 && test "$(ffmpeg-mp3 -hide_banner -loglevel error -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 -c:a libmp3lame -f mp3 - | wc -c)" -gt 1000

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

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.ts"]

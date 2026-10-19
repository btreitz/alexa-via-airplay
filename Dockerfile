# Shairport Sync 5.6 and NQPTP 1.2.9 come pinned together in the upstream image.
FROM mikebrady/shairport-sync:5.6

RUN apk add --no-cache nodejs ffmpeg tini \
 && node --version && ffmpeg -version | head -1

WORKDIR /app
COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .build npm \
 && npm ci --omit=dev --no-audit --no-fund \
 && npm cache clean --force \
 && apk del .build

COPY src ./src
COPY web ./web

ENV NODE_ENV=production \
    DATA_DIR=/data
VOLUME /data

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.ts"]

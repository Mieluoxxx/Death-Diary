
ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION} AS install

WORKDIR /temp/dev
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

WORKDIR /temp/prod
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:${BUN_VERSION} AS build

WORKDIR /app
COPY --from=install /temp/dev/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:${BUN_VERSION} AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/death-diary.sqlite \
    INITIAL_ITEMS_PATH=/app/data/initial-items.json \
    STATIC_ROOT=/app/dist \
    SERVE_STATIC=true

COPY --from=install --chown=bun:bun /temp/prod/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/package.json ./package.json
COPY --from=build --chown=bun:bun /app/server ./server
COPY --from=build --chown=bun:bun /app/src ./src
COPY --from=build --chown=bun:bun /app/dist ./dist

RUN mkdir -p /app/data && chown bun:bun /app/data

USER bun
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["bun", "-e", "const response = await fetch('http://127.0.0.1:3000/api/health'); if (!response.ok) process.exit(1)"]

CMD ["bun", "server/src/index.ts"]

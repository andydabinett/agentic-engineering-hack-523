# Javier NYC Rent Concierge — production image (web + ingest APIs + SQLite volume)
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Root pipeline dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Web app
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci

COPY . .

RUN cd web && npm run build

FROM node:22-bookworm-slim AS run

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV PLAYWRIGHT_HEADLESS=true
# Skip Playwright in cloud (Nimble-only ingest)
ENV CLOUD_INGEST=1
ENV CRAWLER_ENABLED=1
ENV CRAWLER_INGEST_INTERVAL=2m
ENV CRAWLER_VERIFY_INTERVAL=1h
ENV CRAWLER_MAX_RESULTS=5

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/web ./web
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/agent ./agent
COPY --from=build /app/data ./data

RUN chmod +x scripts/start-production.sh && mkdir -p data && chown -R node:node /app

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start:prod"]

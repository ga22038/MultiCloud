FROM node:24-bookworm-slim AS dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY app/package.json ./app/package.json
RUN npm ci

FROM dependencies AS build
COPY app ./app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /workspace
COPY --from=build --chown=node:node /workspace/app/.next/standalone ./
COPY --from=build --chown=node:node /workspace/app/.next/static ./app/.next/static
COPY --from=build --chown=node:node /workspace/app/public ./app/public
USER node
EXPOSE 3000
CMD ["node", "app/server.js"]

FROM dependencies AS migrate
COPY app/scripts ./app/scripts
COPY app/src ./app/src
USER node
CMD ["node", "--import", "tsx", "app/scripts/setup-db.ts"]

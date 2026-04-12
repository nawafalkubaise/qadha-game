# syntax=docker/dockerfile:1
# بناء الواجهة + تشغيل خادم قدها (واجهة + API + WebSocket) على منفذ واحد

FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY githooks ./githooks
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init su-exec

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/index.mjs ./server/
COPY server/lib ./server/lib
COPY server/data/store.json ./server/data/store.json

COPY --from=frontend-build /app/dist ./dist

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV QADHA_SERVER_PORT=3001

EXPOSE 3001

ENTRYPOINT ["dumb-init", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server/index.mjs"]

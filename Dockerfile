# Minimal production runtime for the Express demo.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=app:app . .

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

CMD ["npm", "start"]

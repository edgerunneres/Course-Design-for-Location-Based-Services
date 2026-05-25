FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV LBS_DB_PATH=/data/db.json
ENV LBS_FORCE_HTTPS=true

COPY server ./server

RUN mkdir -p /data

EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "server/server.js"]

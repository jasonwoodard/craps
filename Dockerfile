FROM node:20-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false

COPY src/ ./src/
COPY server/ ./server/
COPY types/ ./types/
COPY tsconfig.json ./

ENV NODE_ENV=production
CMD ["npx", "ts-node", "--skip-project", "server/server.ts"]
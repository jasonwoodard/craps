FROM node:20-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY src/ ./src/
COPY server/ ./server/
COPY types/ ./types/
COPY tsconfig.json ./

RUN npx tsc --project tsconfig.json --outDir dist --module commonjs --moduleResolution node 2>/dev/null || true

CMD ["node", "dist/server/server.js"]
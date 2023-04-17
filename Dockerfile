FROM node:16-alpine

RUN npm i -g pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

CMD ["node", "src/server.js"]
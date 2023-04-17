FROM node:16-alpine

RUN npm i -g pnpm

WORKDIR /app

RUN pnpm install

CMD ["node", "server.js"]
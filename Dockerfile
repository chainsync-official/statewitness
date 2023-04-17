FROM node:16-alpine

WORKDIR /app

RUN pnpm install

CMD ["node", "server.js"]
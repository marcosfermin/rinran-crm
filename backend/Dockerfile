FROM node:22-alpine

WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

COPY src/ ./src/

EXPOSE 4000

CMD ["node", "--experimental-sqlite", "src/server.js"]

FROM node:lts-alpine
WORKDIR /app/dist
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
VOLUME /app/config
CMD ["node", "server.js"]
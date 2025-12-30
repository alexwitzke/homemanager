FROM node:lts-alpine
# App-Verzeichnis
WORKDIR /app
# Abhängigkeiten zuerst (Cache-freundlich)
COPY package*.json ./
RUN npm ci --only=production
# Restlicher Code
COPY . .
# Konfigurationsverzeichnis deklarieren
VOLUME /app/config
# App-Port
EXPOSE 3000
# Startkommando
CMD ["node", "server.js"]

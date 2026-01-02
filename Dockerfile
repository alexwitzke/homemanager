FROM node:lts-alpine

# Arbeitsverzeichnis
WORKDIR /app

# Abhängigkeiten installieren
COPY package*.json ./
RUN npm ci --omit=dev

# Restlichen Code kopieren
COPY . .

# Konfigurationsverzeichnis als Volume deklarieren
VOLUME /app/config

# App-Port
EXPOSE 3000

# Startkommando
CMD ["node", "dist/server.js"]
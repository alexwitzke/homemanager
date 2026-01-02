# 1️⃣ Build Stage
FROM node:lts-alpine AS build
WORKDIR /app

# Abhängigkeiten inkl. dev installieren
COPY package*.json ./
RUN npm ci

# Code kopieren
COPY . .

# Build durchführen
RUN npm run build

# 2️⃣ Runtime Stage
FROM node:lts-alpine
WORKDIR /app

# Nur Production Dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Build-Artefakte aus der Build-Stage kopieren
COPY --from=build /app/dist ./dist

# Config als Volume
VOLUME /app/config

# App-Port
EXPOSE 3000

# Start-Kommando
CMD ["node", "dist/server.js"]
# ---------------------------
# Build-Stage
# ---------------------------
FROM node:lts-alpine AS build
WORKDIR /app

# Abhängigkeiten kopieren und installieren
COPY package*.json ./
RUN npm ci

# Code kopieren
COPY . .

# Build durchführen
RUN npm run build

# ---------------------------
# Runtime-Stage
# ---------------------------
# Wir nehmen das Playwright-Basisimage für Node + Browser
FROM mcr.microsoft.com/playwright:v1.42.0-focal AS runtime
WORKDIR /app

# Nur production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# dist aus Build-Stage übernehmen
COPY --from=build /app/dist ./dist

# Config Volume
VOLUME /app/config

# Start
CMD ["node", "dist/server.js"]


# # Build-Stage
# FROM node:lts-alpine AS build
# WORKDIR /app

# # Dev + Prod dependencies installieren
# COPY package*.json ./
# RUN npm ci

# # Code kopieren
# COPY . .

# # Build durchführen
# RUN npm run build

# # Runtime-Stage
# FROM node:lts-alpine
# WORKDIR /app

# # Nur production dependencies
# COPY package*.json ./
# RUN npm ci --omit=dev

# # dist aus Build-Stage übernehmen
# COPY --from=build /app/dist ./dist

# # Config Volume
# VOLUME /app/config

# # Start
# CMD ["node", "dist/server.js"]

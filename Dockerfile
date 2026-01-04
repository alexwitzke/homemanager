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
# Playwright Image passend zur Version 1.57.0
FROM mcr.microsoft.com/playwright:v1.57.0-focal AS runtime
WORKDIR /app

# Production dependencies installieren
COPY package*.json ./
RUN npm ci --omit=dev

# dist aus Build-Stage übernehmen
COPY --from=build /app/dist ./dist

# Optional: Node / Chromium Flags für stabilere Playwright-Launches
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Config Volume
VOLUME /app/config

# Default Start
CMD ["node", "dist/server.js"]

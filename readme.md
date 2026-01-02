Alles klar. Weg 1 ist der saubere, docker-native Weg: Image bauen → Container ersetzen, ohne SSH im Container.
Das fühlt sich am Anfang ungewohnt an, ist aber exakt das, wofür Docker gebaut wurde.
Ich gehe das als durchgehenden Ablauf durch, nicht als lose Rezepte.

Zielbild (mental wichtig)
Deine Node.js-App ist Teil des Docker-Images.
Deployment bedeutet:
    Code ändern → neues Image bauen → alten Container ersetzen
Kein „Dateien rüberschieben“, kein „auf dem Server rumeditieren“.

# Schritt 1: Projektstruktur
Angenommen:

```
app/
├─ package.json
├─ package-lock.json
├─ config/
|  ├─ watchlist.json
|  ├─ settings.json
|  └─ bot.js
├─ src/
|  ├─ ...
|  └─ ...
├─ server.js
├─ Dockerfile
└─ .dockerignore
```

.dockerignore (wichtig!):

```
node_modules
.git
.gitignore
```

# Schritt 2: Dockerfile (Node.js LTS, produktionsnah)

```
# Build-Stage
FROM node:lts-alpine AS build
WORKDIR /app

# Dev + Prod dependencies installieren
COPY package*.json ./
RUN npm ci

# Code kopieren
COPY . .

# Build durchführen
RUN npm run build

# Runtime-Stage
FROM node:lts-alpine
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

```

# Schritt 3: Deployment auf den Server (ohne SSH in den Container)
Du verbindest dich per SSH auf den Server, nicht in den Container:

```
ssh user@server
```

Dort:

```
git clone https://github.com/alexwitzke/homemanager.git
cd homemanager
docker build -t pricewatcher:latest .
```
Unter Windows Docker:
docker run -d --name pricewatcher -v C:\Users\alex\price_watcher\src\config:/app/config -p 3000:3000 pricewatcher:latest

docker build -t pricewatcher:latest .

docker rm -f homemanager

docker run -d --name homemanager -v /mnt/user/appdata/homemanager:/app/config -p 3000:3000 pricewatcher:latest

# Debugging & Zugriff (der Ersatz für SSH)

```
docker logs -f homemanager

docker exec -it homemanager sh
```


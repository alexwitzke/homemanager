import { JSDOM } from "jsdom";
import { readFileSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import express from "express";
import cors from "cors";
import { type Settings, type BotSettings, WatchItem } from "./types.js";
import { parsePrice } from "./utils.js";
import TelegramBot from "node-telegram-bot-api";
import * as path from 'path';
import { JSONPath } from 'jsonpath-plus';
import { firefox } from 'playwright';

export const APP_ROOT = process.cwd();

const app = express();
app.use(cors());
app.use(express.json());

const browser = await firefox.launch({
    headless: true,   // false zum Debuggen
    // args: [
    //     '--disable-http2'
    // ]
});

const settingsPath = path.join(APP_ROOT, "config", "settings.json");
const watchlistPath = path.join(APP_ROOT, "config", "watchlist.json");
const botConfigPath = path.join(APP_ROOT, "config", "bot.json");

let watcherTask: NodeJS.Timeout | null = null;

// JSONs einlesen
const settingsRaw = await readFile(settingsPath, "utf-8");
const settings: Settings = JSON.parse(settingsRaw);

const botSettingsRaw = await readFile(botConfigPath, "utf-8");
const botSettings: BotSettings = JSON.parse(botSettingsRaw);

const token = botSettings.token;
const msg_id = botSettings.botMessageId;

const bot = new TelegramBot(token, { polling: true });

app.get('/api/job/:id', (req, res) => {
    let watchListRaw = readFileSync(watchlistPath, "utf-8");
    let watchList: WatchItem[] = JSON.parse(watchListRaw);

    res.json(watchList.find(j => j.id === eval(req.params.id)));
});

app.post("/api/job/", function (req, res) {
    let watchListRaw = readFileSync(watchlistPath, "utf-8");
    let watchList: WatchItem[] = JSON.parse(watchListRaw);

    var job = watchList.find(j => j.id === eval(req.body.id));
    var _new = false;

    if (job == null) {
        _new = true;
        job = new WatchItem();
        //var lastIndex = jobs.length == 0 ? -1 : Math.max.apply(Math, jobs.map(function (j) { return j.id; }));
        job.id = watchList.length + 1;
        job.lowestPrice = req.body.lowestPrice;
        watchList.push(job);
    } else {
        job.id = eval(req.body.id);
    }

    job.name = req.body.name;
    job.url = req.body.url;
    job.selector = req.body.selector;
    job.active = req.body.active;
    //job.priceParsing = req.body.priceParsing;

    if (_new) {
        watchList.push(job);
    }

    writeFile(watchlistPath, JSON.stringify(watchList, null, 4), 'utf8');
    res.sendStatus(200);
});

app.get('/api/jobs', (req, res) => {
    let watchListRaw = readFileSync(watchlistPath, "utf-8");
    let watchList: WatchItem[] = JSON.parse(watchListRaw);

    res.json(watchList);
});

function startWatcher() {
    start();
    watcherTask = setInterval(() => {
        console.log("Watcher läuft... Preise prüfen");
        start();
    }, settings.intervallInMinutes * 60 * 1000);
    bot.sendMessage(msg_id, `Starting price watcher server...`);
}

async function start() {
    let watchListRaw = await readFile(watchlistPath, "utf-8");
    let watchList: WatchItem[] = JSON.parse(watchListRaw);

    console.log("-----");
    console.log("Start run at:\t", new Date().toLocaleString('de', { timeZone: 'Europe/Berlin', timeZoneName: 'short' }));
    console.log("-----");

    for (var item of watchList) {
        if (!item.active) {
            continue;
        }

        try {
            if (item.kind === "JSON") {
                console.log("Start JSON job for item:", item.name);
                console.log("Parsing url:\t", item.url);

                const context = await browser.newContext({
                    locale: 'de-DE',
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    timezoneId: 'Europe/Berlin',
                    viewport: { width: 1366, height: 768 }
                });

                const page = await context.newPage();

                await page.goto(item.alertUrl, {
                    waitUntil: 'networkidle'
                });

                const data = await page.evaluate(async (url) => {
                    const res = await fetch(url, {
                        credentials: 'include'
                    });
                    return res.json();
                }, item.url);

                const result = JSONPath({
                    path: item.selector,
                    //path: "$..cabinItemsVariant[?(@.cabinName=='Suite')].ind.prices",
                    json: data
                });

                if (result[0].length > 0) {
                    console.log("Job alert\t", item.alertUrl);
                    bot.sendMessage(msg_id, `Job alert!\n${item.alertUrl}`);
                }

                //console.log("JSON Data:", result[0]);
            } else if (item.kind === "HTML") {
                console.log("Start HTML job for item:", item.name);

                const response = await fetch(item.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 ...',
                        'Accept': 'application/json',
                        'Accept-Language': 'de-DE,de;q=0.9',
                        'Referer': 'https://www.google.de/',
                    }
                });

                if (!response.ok) {
                    const error = new Error(`HTTP Error: ${response.status}`);
                    item.error = error.message;
                    throw error;
                }

                const html = await response.text();

                const dom = new JSDOM(html);
                const document = dom.window.document;

                const rawPrice = document.querySelector(item.selector);

                // if (!rawPrice) {
                //     throw new Error(`Selector nicht gefunden: ${item.selector}`);
                // }

                try {
                    const parsedPrice = parsePrice(rawPrice?.textContent, settings);

                    console.log("Parsing url:\t", item.url);
                    console.log("Parsed price:\t", parsedPrice);

                    if (item.lowestPrice == 0) {
                        item.lowestPrice = 1000000;
                    }

                    if (parsedPrice < item.lowestPrice) {
                        item.lowestPrice = parsedPrice;

                        console.log("Neuer Tiefstpreis gefunden!");
                        console.log("Lowest price stored:", item.lowestPrice);

                        bot.sendMessage(msg_id, `Neuer Tiefstpreis für ${item.name} gefunden: ${parsedPrice} EUR\n${item.url}`);
                    }
                } catch (error) {
                    item.error = error.message;
                    bot.sendMessage(msg_id, `Fehler beim Parsen des Preises für ${item.name}: ${error.message}\n${item.url}`);
                }
            }
        } catch (error) {
            item.error = error.message;
            console.log("Fehler beim Abrufen der URL:", item.url);
            console.log("Fehlerdetails:", error.message);
        }

        console.log("-----");
    }
    await writeFile(watchlistPath, JSON.stringify(watchList, null, 4), 'utf8');
}

startWatcher();

//app.listen(3000, () => console.log("Server läuft auf http://localhost:3000"));
import { JSDOM } from "jsdom";
import { readFileSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import express from "express";
import cors from "cors";
import { type Settings, type BotSettings, WatchItem } from "./types.js";
import { parsePrice } from "./utils.js";
import TelegramBot from "node-telegram-bot-api";

const app = express();
app.use(cors());
app.use(express.json());

const settingsPath = "./src/config/settings.json";
const watchlistPath = "./src/config/watchlist.json";
const botConfigPath = "./src/config/bot.json";

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

// app.get("/watcher/start", (req, res) => {
//     if (watcherTask) {
//         return res.status(400).json({ message: "Watcher läuft bereits" });
//     }

//     startWatcher();

//     res.json({ message: "Watcher gestartet" });
// });

// app.get("/watcher/stop", (req, res) => {
//     if (watcherTask) {
//         stopWatcher();

//         return res.json({ message: "Watcher gestoppt" });
//     }

//     res.status(400).json({ message: "Watcher läuft nicht" });
// });

function startWatcher() {
    start();
    watcherTask = setInterval(() => {
        console.log("Watcher läuft... Preise prüfen");
        start();
    }, settings.intervallInMinutes * 60 * 1000);
    bot.sendMessage(msg_id, `Starting price watcher server...`);
}

// function stopWatcher() {
//     clearInterval(watcherTask);
//     watcherTask = null;
//     bot.sendMessage(msg_id, `Stopping price watcher server...`);
// }

async function start() {
    let watchListRaw = await readFile(watchlistPath, "utf-8");
    let watchList: WatchItem[] = JSON.parse(watchListRaw);

    for (var item of watchList) {
        const response = await fetch(item.url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "de-DE,de;q=0.9"
            }
        });
        const html = await response.text();

        if (!response.ok) {
            const error = new Error(`HTTP Fehler: ${response.status}`);
            item.error = error.message;
            throw error;
        }

        const dom = new JSDOM(html);
        const document = dom.window.document;

        const rawPrice = document.querySelector(item.selector);

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

        console.log("-----");
    }

    await writeFile(watchlistPath, JSON.stringify(watchList, null, 4), 'utf8');
}

// bot.onText(/\/startPriceWatcher/, (msg, match) => {
//     // 'msg' is the received Message from Telegram 'match' is the result of executing the regexp above on the text content of the message

//     //const chatId = msg.chat.id;

//     if (msg.from.id != msg_id)
//         return;

//     startWatcher();
// });

// bot.onText(/\/stopPriceWatcher/, (msg, match) => {
//     // 'msg' is the received Message from Telegram 'match' is the result of executing the regexp above on the text content of the message

//     //const chatId = msg.chat.id;

//     if (msg.from.id != msg_id)
//         return;

//     stopWatcher();
// });

// bot.onText(/\/start/, (msg) => {
//     bot.sendMessage(msg.chat.id, "HomeManager menu", {
//         "reply_markup": {
//             "keyboard": [["/startPriceWatcher", "/stopPriceWatcher", "/state"]]
//         }
//     });
// });

// bot.onText(/\/state/, (msg) => {
//     if (watcherTask) {
//         bot.sendMessage(msg.chat.id, "Der Price Watcher läuft.");
//     } else {
//         bot.sendMessage(msg.chat.id, "Der Price Watcher ist gestoppt.");
//     }
// });

startWatcher();

app.listen(3000, () => console.log("Server läuft auf http://localhost:3000"));
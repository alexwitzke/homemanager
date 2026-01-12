import { JSDOM } from "jsdom";
import { readFile, writeFile } from "fs/promises";
import express from "express";
import cors from "cors";
import { type Settings, type WatchList, JsonJob, HtmlJob, type JobDTO } from "./types.js";
import { parsePrice } from "./utils.js";
import TelegramBot from "node-telegram-bot-api";
import * as path from "path";
import { JSONPath } from "jsonpath-plus";
import { firefox, type BrowserContext } from "playwright";
import dotenv from "dotenv";

export const APP_ROOT = process.cwd();

let headless = true;
let useTelegramBot = true;

if (APP_ROOT.endsWith("_watcher")) {
    headless = false;
    useTelegramBot = false;
    dotenv.config({ path: path.join(APP_ROOT, ".env") });
} else {
    dotenv.config({ path: path.join(APP_ROOT, "config", ".env") });
}

const app = express();
app.use(cors());
app.use(express.json());

const browser = await firefox.launch({ headless });

let context: BrowserContext = await browser.newContext({
    locale: "de-DE",
    userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    timezoneId: "Europe/Berlin",
    viewport: { width: 1366, height: 768 },
});

const settingsPath = path.join(APP_ROOT, "config", "settings.json");
const watchlistPath = path.join(APP_ROOT, "config", "watchlist.json");

const settings: Settings = JSON.parse(await readFile(settingsPath, "utf-8"));
const bot = new TelegramBot(process.env.TOKEN!, { polling: true });

let running = false;
let runCount = 0;

async function recreateContext() {
    console.log("Recreate browser context");
    await context.close();
    context = await browser.newContext({
        locale: "de-DE",
        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        timezoneId: "Europe/Berlin",
        viewport: { width: 1366, height: 768 },
    });
}

function createJob(dto: JobDTO): HtmlJob | JsonJob {
    switch (dto.kind) {
        case "HTML":
            return Object.assign(new HtmlJob(), dto);
        case "JSON":
            return Object.assign(new JsonJob(), dto);
        default:
            throw new Error(`Unbekannter Job-Typ: ${(dto as any).kind}`);
    }
}

function logMemory() {
    const rss = Math.round(process.memoryUsage().rss / 1024 / 1024);
    console.log("Memory RSS:", rss, "MB");
}

async function start() {
    runCount++;
    if (runCount % 20 === 0) await recreateContext();

    const watchListRaw = await readFile(watchlistPath, "utf-8");
    const raw = JSON.parse(watchListRaw) as JobDTO[];
    const watchList: WatchList = raw.map(createJob);

    console.log("-----");
    console.log(
        "Start run at:\t",
        new Date().toLocaleString("de", {
            timeZone: "Europe/Berlin",
            timeZoneName: "short",
        })
    );
    console.log("-----");

    for (const item of watchList) {
        if (!item.active) continue;

        let page = null;

        try {
            if (item instanceof JsonJob) {
                console.log("Start JSON job for item:", item.name);
                console.log("Parsing url:\t", item.url);

                page = await context.newPage();
                await page.goto(item.alertUrl, { waitUntil: "domcontentloaded" });

                if (item.acceptButtonSelector) {
                    try {
                        await page.waitForSelector(item.acceptButtonSelector, {
                            timeout: 5000,
                            state: "visible",
                        });
                        await page.click(item.acceptButtonSelector);
                    } catch {
                        console.warn("Accept-Button nicht gefunden oder nicht klickbar");
                    }
                }

                const data = await page.evaluate(async (url) => {
                    const res = await fetch(url, { credentials: "include" });
                    return res.json();
                }, item.url);

                const result = JSONPath({
                    path: item.selector,
                    json: data,
                });

                if (result?.[0]?.length > 0) {
                    console.log("Job alert\t", item.alertUrl);
                    if (useTelegramBot) {
                        bot.sendMessage(
                            process.env.BOTMESSAGEID!,
                            `Job alert!\n${item.alertUrl}`
                        );
                    }
                }
            }

            if (item instanceof HtmlJob) {
                console.log("Start HTML job for item:", item.name);

                page = await context.newPage();
                await page.goto(item.url, { waitUntil: "domcontentloaded" });

                if (item.acceptButtonSelector) {
                    try {
                        await page.waitForSelector(item.acceptButtonSelector, {
                            timeout: 5000,
                            state: "visible",
                        });
                        await page.click(item.acceptButtonSelector);
                        await page.goto(item.url, {
                            waitUntil: "domcontentloaded",
                        });
                    } catch {
                        console.warn("Accept-Button nicht gefunden oder nicht klickbar");
                    }
                }

                const html = await page.evaluate(
                    () => document.documentElement.outerHTML
                );

                const dom = new JSDOM(html);
                try {
                    const document = dom.window.document;
                    const rawPrice = document.querySelector(item.selector);

                    const parsedPrice = parsePrice(
                        rawPrice?.textContent?.trim(),
                        settings
                    );

                    console.log("Parsing url:\t", item.url);
                    console.log("Parsed price:\t", parsedPrice);

                    if (item.lowestPrice === 0) {
                        item.lowestPrice = 1_000_000;
                    }

                    if (parsedPrice < item.lowestPrice) {
                        item.lowestPrice = parsedPrice;

                        console.log("Neuer Tiefstpreis gefunden!");
                        console.log(
                            "Lowest price stored:",
                            item.lowestPrice
                        );

                        if (useTelegramBot) {
                            bot.sendMessage(
                                process.env.BOTMESSAGEID!,
                                `Neuer Tiefstpreis für ${item.name} gefunden: ${parsedPrice} EUR\n${item.url}`
                            );
                        }
                    }
                } catch (error: any) {
                    item.error = error.message;
                    console.log(
                        "Fehler beim Parsen des Preises für:",
                        item.name
                    );
                    console.log("Fehlerdetails:", error.message);

                    if (useTelegramBot) {
                        bot.sendMessage(
                            process.env.BOTMESSAGEID!,
                            `Fehler beim Parsen des Preises für ${item.name}: ${error.message}\n${item.url}`
                        );
                    }
                } finally {
                    dom.window.close();
                }
            }
        } catch (error: any) {
            item.error = error.message;
            console.log("Fehler beim Abrufen der URL:", item.url);
            console.log("Fehlerdetails:", error.message);
        } finally {
            if (page) await page.close();
            logMemory();
            console.log("-----");
        }
    }

    await writeFile(
        watchlistPath,
        JSON.stringify(watchList, null, 4),
        "utf-8"
    );
}

async function loop() {
    if (useTelegramBot) {
        bot.sendMessage(
            process.env.BOTMESSAGEID!,
            "Starting price watcher server..."
        );
    }

    while (true) {
        if (!running) {
            running = true;
            try {
                await start();
            } catch (e) {
                console.error("Watcher crashed:", e);
            } finally {
                running = false;
            }
        }

        await new Promise((r) =>
            setTimeout(r, settings.intervallInMinutes * 60 * 1000)
        );
    }
}

loop();

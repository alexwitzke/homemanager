import { JSDOM, VirtualConsole } from "jsdom";
import { readFile, writeFile } from "fs/promises";
import { type Settings, type WatchList, JsonJob, HtmlJob, type JobDTO } from "./types.js";
import { parsePrice } from "./utils.js";
import TelegramBot from "node-telegram-bot-api";
import * as path from "path";
import { JSONPath } from "jsonpath-plus";
import { firefox, type Browser, type BrowserContext, type Page } from "playwright";
import dotenv from "dotenv";

export const APP_ROOT = process.cwd();

let headless = true;
let useTelegramBot = true;

if (APP_ROOT.endsWith("_watcher")) {
    headless = true;
    useTelegramBot = false;
    dotenv.config({ path: path.join(APP_ROOT, ".env") });
} else {
    dotenv.config({ path: path.join(APP_ROOT, "config", ".env") });
}

const settingsPath = path.join(APP_ROOT, "config", "settings.json");
const watchlistPath = path.join(APP_ROOT, "config", "watchlist.json");

const settings: Settings = JSON.parse(await readFile(settingsPath, "utf-8"));
const bot = useTelegramBot
    ? new TelegramBot(process.env.TOKEN!, { polling: false })
    : null;

let browser: Browser;
let context: BrowserContext;

let runCount = 0;

const virtualConsole = new VirtualConsole();
virtualConsole.on("error", () => {
    // CSS parsing errors unterdrücken
});

async function recreateBrowser() {
    console.log("Recreating entire browser instance");

    if (context) {
        await context.close().catch(() => {});
    }
    if (browser) {
        await browser.close().catch(() => {});
    }

    browser = await firefox.launch({ headless });
    context = await browser.newContext({
        locale: "de-DE",
        timezoneId: "Europe/Berlin",
        extraHTTPHeaders: {
            "Accept-Language": "de-DE,de;q=0.9,en;q=0.8,en-GB;q=0.7",
        },
        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        viewport: { width: 1366, height: 768 },
        geolocation: { latitude: 52.5200, longitude: 13.4050, accuracy: 100 },
        permissions: ["geolocation"],
        colorScheme: "light",
    });
}

// Browser beim Start initialisieren
await recreateBrowser();

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
    console.log(`Memory RSS: ${rss} MB`);
}

async function start() {
    runCount++;

    // Browser alle 15 Durchläufe komplett neu starten
    if (runCount % 1 === 0) {
        await recreateBrowser();
    }

    const watchListRaw = await readFile(watchlistPath, "utf-8");
    const raw = JSON.parse(watchListRaw) as JobDTO[];
    const watchList: WatchList = raw.map(createJob);

    console.log("-----");
    console.log(
        `Start run #${runCount} at: ${new Date().toLocaleString("de", {
            timeZone: "Europe/Berlin",
            timeZoneName: "short",
        })}`
    );
    console.log("-----");

    for (const item of watchList) {
        // Fehler pro Item zurücksetzen
        item.error = null;

        if (!item.active) continue;

        let page: Page | null = null;

        try {
            if (item instanceof JsonJob) {
                console.log(`JSON job: ${item.name}`);
                page = await context.newPage();

                // Für JSON-Jobs meist kein Accept-Button nötig → optional
                if (item.acceptButtonSelector) {
                    try {
                        await page.waitForSelector(item.acceptButtonSelector, {
                            timeout: 5000,
                            state: "visible",
                        });
                        await page.click(item.acceptButtonSelector);
                    } catch {
                        // stiller Fail
                    }
                }

                const data = await page.evaluate(async (url: string) => {
                    const res = await fetch(url, { credentials: "include" });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                }, item.url);

                const result = JSONPath({
                    path: item.selector,
                    json: data,
                });

                if (eval(item.evalCondition)) {
                    console.log(`Condition erfüllt! → ${item.alertUrl}`);
                    if (useTelegramBot && bot) {
                        await bot.sendMessage(
                            process.env.BOTMESSAGEID!,
                            `Job alert!\n${item.alertUrl}`
                        ).catch(err => console.error("Telegram send failed:", err));
                    }
                }
            }

            if (item instanceof HtmlJob) {
                console.log(`HTML job: ${item.name}`);
                page = await context.newPage();
                await page.goto(item.url, { waitUntil: "domcontentloaded" });

                if (item.acceptButtonSelector) {
                    try {
                        await page.waitForSelector(item.acceptButtonSelector, {
                            timeout: 5000,
                            state: "visible",
                        });
                        await page.click(item.acceptButtonSelector);
                        await page.goto(item.url, { waitUntil: "domcontentloaded" });
                    } catch {
                        // stiller Fail
                    }
                }

                const html = await page.evaluate(
                    () => document.documentElement.outerHTML
                );

                const dom = new JSDOM(html, {
                    virtualConsole,
                    pretendToBeVisual: false,
                });

                try {
                    const rawPriceElement = dom.window.document.querySelector(item.selector);
                    const rawText = rawPriceElement?.textContent?.trim() ?? "";

                    const parsedPrice = parsePrice(rawText, settings);

                    if (parsedPrice === null || isNaN(parsedPrice) || parsedPrice <= 0) {
                        console.warn(`Kein gültiger Preis für ${item.name} → "${rawText}"`);
                        item.error = `Ungültiger Preis: ${rawText}`;
                        continue;
                    }

                    console.log(`Parsed price for ${item.name}: ${parsedPrice}`);

                    if (item.lowestPrice === 0 || item.lowestPrice === null) {
                        item.lowestPrice = 1_000_000;
                    }

                    if (parsedPrice < item.lowestPrice) {
                        item.lowestPrice = parsedPrice;
                        console.log(`Neuer Tiefstpreis: ${item.lowestPrice}`);

                        if (useTelegramBot && bot) {
                            await bot.sendMessage(
                                process.env.BOTMESSAGEID!,
                                `Neuer Tiefstpreis für ${item.name} gefunden: ${parsedPrice} EUR\n${item.url}`
                            ).catch(err => console.error("Telegram send failed:", err));
                        }
                    }
                } catch (error: any) {
                    item.error = error.message;
                    console.error(`Fehler beim Parsen für ${item.name}:`, error.message);

                    if (useTelegramBot && bot) {
                        await bot.sendMessage(
                            process.env.BOTMESSAGEID!,
                            `Fehler beim Parsen für ${item.name}: ${error.message}\n${item.url}`
                        ).catch(err => console.error("Telegram send failed:", err));
                    }
                } finally {
                    dom.window.close();
                }
            }
        } catch (error: any) {
            item.error = error.message;
            console.error(`Fehler beim Abrufen von ${item.url || "unbekannt"}:`, error.message);
        } finally {
            if (page) {
                await page.close().catch(() => { });
            }
            logMemory();
            console.log("-----");
        }
    }

    try {
        await writeFile(
            watchlistPath,
            JSON.stringify(watchList, null, 4),
            "utf-8"
        );
        console.log("Watchlist gespeichert.");
    } catch (err) {
        console.error("Fehler beim Speichern der Watchlist:", err);
    }

    console.log(`Run ${runCount} abgeschlossen. Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`);
}

async function loop() {
    if (useTelegramBot && bot) {
        await bot.sendMessage(
            process.env.BOTMESSAGEID!,
            "Price watcher gestartet..."
        ).catch(err => console.error("Initial Telegram send failed:", err));
    }

    while (true) {
        try {
            await start();
        } catch (e) {
            console.error("Watcher crashed:", e);
        }

        await new Promise(r => setTimeout(r, settings.intervallInMinutes * 60 * 1000));
    }
}

loop().catch(err => {
    console.error("Fataler Fehler im Haupt-Loop:", err);
    process.exit(1);
});
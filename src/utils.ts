import { type RegexRule, type Settings } from "./types.js";

// Hilfsfunktion: Regeln anwenden
function applyRegexRules(input: string, rules: RegexRule[]): string {
    return rules.reduce((value, rule) => {
        const regex = new RegExp(rule.pattern, rule.flags ?? "");
        return value.replace(regex, rule.replaceWith);
    }, input);
}

// Preis parsen
function parsePrice(raw: string, settings: Settings): number {
    if (!raw) {
        throw new Error("Kein Preis angegeben");
    }

    for (const parser of settings.priceParser) {
        const priceRegex = new RegExp(parser.matchPattern);
        const match = priceRegex.test(raw);
        //const match = raw.match(parser.matchPattern);

        if (!match) {
            continue;
        }
        const normalized = applyRegexRules(raw, parser.rules);
        const value = Number(normalized);
        if (Number.isNaN(value)) {
            throw new Error(`Ungültiger Preis: "${raw}"`);
        }
        return value;
    }
    throw new Error(`Kein passendes Preisformat gefunden für: "${raw}"`);
}

export { parsePrice };
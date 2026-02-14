import { type RegexRule, type Settings } from "./types.js";

// Hilfsfunktion: Regeln anwenden
function applyRegexRules(input: string, rules: RegexRule[]): string {
    return rules.reduce((value, rule) => {
        const regex = new RegExp(rule.pattern, rule.flags ?? "g");
        return value.replace(regex, rule.replaceWith);
    }, input.trim());
}

function parsePrice(raw: string | null | undefined, settings: Settings): number | null {
    const input = (raw ?? "").trim();
    if (!input) {
        console.debug("parsePrice: Eingabe leer");
        return null;
    }

    console.debug(`parsePrice versucht zu parsen: "${input}"`);

    // Deine bisherigen Parser durchlaufen
    for (const parser of settings.priceParser) {
        for (const pattern of parser.pattern) {
            const match = input.match(new RegExp(pattern.matchPattern));

            if (!match || !match[0]) continue;

            console.log(
                `Preis-Match gefunden mit Pattern: "${pattern.name}" ` +
                `für rohen Preis: "${input}" (Gruppe: "${match[0]}")`
            );

            try {
                const normalized = applyRegexRules(match[0], parser.rules);
                // Zusätzliche Bereinigung: alle Leerzeichen entfernen
                const cleanNumStr = normalized.replace(/\s/g, "");

                const value = Number(cleanNumStr);

                if (Number.isNaN(value) || value <= 0) {
                    console.warn(`Ungültiger Wert nach Normalisierung: "${normalized}" → ${value}`);
                    continue;
                }

                console.log(`Erfolgreich geparst: "${normalized}" → ${value.toFixed(2)}`);
                return value;
            } catch (err: any) {
                console.warn(`Fehler bei Parser "${pattern.name}": ${err.message}`);
            }
        }
    }

    // ────────────────────────────────────────────────
    // Fallback: Intelligente Bereinigung für beide Formate
    // ────────────────────────────────────────────────
    console.debug("Kein Parser-Match → Fallback aktiviert");

    let cleaned = input
        .replace(/[^0-9.,]/g, "")           // nur Zahlen + . ,
        .replace(/\s+/g, "");               // Leerzeichen weg

    // Wenn sowohl Punkt als auch Komma vorhanden → annehmen: Punkt = Tausender, Komma = Dezimal
    if (cleaned.includes(".") && cleaned.includes(",")) {
        // Tausender-Punkte entfernen (nur wenn vor genau 3 Ziffern)
        cleaned = cleaned.replace(/\.(?=\d{3}(?:,|$))/g, "");
        // Komma zu Dezimalpunkt
        cleaned = cleaned.replace(/,/g, ".");
    }
    // Nur Komma → deutsch
    else if (cleaned.includes(",")) {
        cleaned = cleaned.replace(/,/g, ".");
    }
    // Nur Punkt → US-Format, nichts tun

    const fallbackValue = Number(cleaned);

    if (!Number.isNaN(fallbackValue) && fallbackValue > 0) {
        console.log(`Fallback-Parsing erfolgreich: "${input}" → ${fallbackValue.toFixed(2)}`);
        return fallbackValue;
    }

    console.warn(`Auch Fallback gescheitert für: "${input}"`);
    return null;
}

export { parsePrice };
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
    // Verbesserter Fallback – fix für "2,249.00" / "2.249,00"
    // ────────────────────────────────────────────────
    console.debug("Kein Parser-Match → Fallback aktiviert");

    let cleaned = input
        .replace(/[^0-9.,]/g, "")               // nur Zahlen + . ,
        .replace(/\s+/g, "");                   // Leerzeichen weg

    if (cleaned.includes('.') && cleaned.includes(',')) {
        // Beide Trenner vorhanden → Format anhand Position/Länge erkennen
        const lastDotIndex = cleaned.lastIndexOf('.');
        const lastCommaIndex = cleaned.lastIndexOf(',');

        if (lastDotIndex > lastCommaIndex) {
            // Punkt ist weiter hinten → wahrscheinlich Dezimalpunkt (US-Format: 2,249.00)
            cleaned = cleaned.replace(/,/g, '');   // Kommas = Tausender entfernen
            // Punkt bleibt als Dezimal
        } else {
            // Komma ist weiter hinten → wahrscheinlich Dezimalkomma (EU-Format: 2.249,00)
            cleaned = cleaned.replace(/\./g, '');  // Punkte = Tausender entfernen
            cleaned = cleaned.replace(/,/g, '.');  // Komma → Dezimalpunkt
        }
    } else if (cleaned.includes(',')) {
        // Nur Komma → EU-Format
        cleaned = cleaned.replace(/,/g, '.');
    } else if (cleaned.includes('.')) {
        // Nur Punkt → US-Format, nichts ändern
    }

    const fallbackValue = Number(cleaned);

    if (!Number.isNaN(fallbackValue) && fallbackValue > 0) {
        console.log(`Fallback-Parsing erfolgreich: "${input}" → ${fallbackValue.toFixed(2)}`);
        return fallbackValue;
    }

    console.warn(`Auch Fallback gescheitert für: "${input}" (cleaned: "${cleaned}")`);
    return null;
}

export { parsePrice };
// Typen
export type RegexRule = {
    flags?: string;
    replaceWith: string;
    pattern: string;
};

export type PriceParsing = {
    pattern: PriceParsingPattern[];
    rules: RegexRule[];
};

export type PriceParsingPattern = {
    name: string;
    matchPattern: string;
};

export class WatchItem {
    id: number;
    name: string;
    active: boolean;
    url: string;
    selector: string;
    lowestPrice: number;
    error: string | null;
};

export type Settings = {
    intervallInMinutes: number;
    priceParser: PriceParsing[];
};

export type BotSettings = {
    botMessageId: number;
    token: string;
};
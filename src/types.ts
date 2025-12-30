// Typen
export type RegexRule = {
    flags?: string;
    replaceWith: string;
    pattern: string;
};

export type PriceParsing = {
    name: string;
    matchPattern: string;
    rules: RegexRule[];
};

export class WatchItem {
    id: number;
    name: string;
    active: boolean;
    url: string;
    selector: string;
    lowestPrice: number;
};

export type Settings = {
    intervallInMinutes: number;
    priceParser: PriceParsing[];
};

export type BotSettings = {
    botMessageId: number;
    token: string;
};
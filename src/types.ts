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
    kind: "JSON" | "HTML" = "HTML";
    id: number;
    name: string;
    active: boolean;
    url: string;
    alertUrl?: string;
    selector: string;
    lowestPrice?: number;
    error: string | null;
    acceptButtonSelector?: string;
};

export type Settings = {
    intervallInMinutes: number;
    priceParser: PriceParsing[];
};

export type BotSettings = {
    botMessageId: number;
    token: string;
};

export abstract class BaseJob {
    abstract kind: string;
    id: number;
    name: string;
    active: boolean;
    error: string | null;
    selector: string;
    url: string;
    acceptButtonSelector?: string;
};

export class HtmlJob extends BaseJob {
    kind = "HTML";
    lowestPrice?: number;
};

export class JsonJob extends BaseJob {
    kind = "JSON";
    alertUrl?: string;
}

export type JobDTO = {
    kind: "HTML" | "JSON";
    id: number;
    name: string;
    active: boolean;
    url: string;
    selector: string;
    error: string | null;
    lowestPrice?: number;
    alertUrl?: string;
    acceptButtonSelector?: string;
};

export type WatchList = Array<HtmlJob | JsonJob>;
import he from "he";
import crypto from "crypto"

import * as IncidentLog from "./incident_log";

export interface Hash {
    readonly salt: string,
    readonly key: string,
    readonly iterations: number,
    readonly keylen: number
}

/** @ignore */
enum Colors {
    Reset = "\x1b[0m",
    Bright = "\x1b[1m",
    Dim = "\x1b[2m",
    Underscore = "\x1b[4m",
    Blink = "\x1b[5m",
    Reverse = "\x1b[7m",
    Hidden = "\x1b[8m",

    FgBlack = "\x1b[30m",
    FgRed = "\x1b[31m",
    FgGreen = "\x1b[32m",
    FgYellow = "\x1b[33m",
    FgBlue = "\x1b[34m",
    FgMagenta = "\x1b[35m",
    FgCyan = "\x1b[36m",
    FgWhite = "\x1b[37m",

    BgBlack = "\x1b[40m",
    BgRed = "\x1b[41m",
    BgGreen = "\x1b[42m",
    BgYellow = "\x1b[43m",
    BgBlue = "\x1b[44m",
    BgMagenta = "\x1b[45m",
    BgCyan = "\x1b[46m",
    BgWhite = "\x1b[47m"
}

const debug_text = `[${ Colors.Bright }${ Colors.FgYellow } DEBUG ${ Colors.Reset }]`;
const info_text = `[${ Colors.FgCyan } INFO ${ Colors.Reset }]`;
const warn_text = `[${ Colors.FgYellow } WARN ${ Colors.Reset }]${ Colors.FgYellow }`;
const error_text = `[${ Colors.FgRed } EROR ${ Colors.Reset }]${ Colors.FgRed }`;
const crit_text = `${ Colors.FgWhite }${ Colors.BgRed }[ CRIT ]${ Colors.Reset }${ Colors.FgRed }`;

/**
 * Log a message to the console
 *
 * @param message message text
 * @param type log type: 1 - info; 2 - warn; 3 - error; 4 - critical
 * @param error error object
 * @param additional_info additional info object
 * @param add_to_incidents save this error to the database as an incident?
 */
export function log(message: string, type: number = 1, error?: Error, additional_info?: any, add_to_incidents: boolean = true): void {
    let brackets_text = info_text;

    switch(type) {
        case 0: { brackets_text = debug_text } break;
        case 2: { brackets_text = warn_text } break;
        case 3: { brackets_text = error_text } break;
        case 4: { brackets_text = crit_text } break;
    }

    // tslint:disable-next-line: no-console
    console.log(`${ brackets_text }`, message ,`${ Colors.Reset }`);
    // tslint:disable-next-line: no-console
    if(additional_info) console.log(`         ${ Colors.FgCyan }Additional info${ Colors.Reset }:`, additional_info);
    // tslint:disable-next-line: no-console
    if(error) console.log(`         ${ Colors.FgCyan }Error object${ Colors.Reset }:`, error);

    // Save as incident
    if(type > 1 && add_to_incidents)
        IncidentLog.createEntry(message, type, error?.stack, true, additional_info);
}

/**
 * Sanitize a string
 *
 * 1. he.encode(str)
 * 2. / -> &#47;
 * 3. .. -> &#46;&#46;
 *
 * @param str input string
 */
export function sanitize(str?: string): string {
    if(!str) return "";

    // TODO @hack
    return he.encode(str).replace(/\//g, "&#47;").replace(/\.\./g, "&#46;&#46;");
}

/**
 * Construct "24 minutes ago"-like text from UNIX timestamp
 *
 * @param timestamp UNIX timestamp
 */
export function formatTimeString(timestamp: number): string {
    const sPerMinute = 60;
    const sPerHour = 3600;
    const sPerDay = 86400;
    const sPerMonth = 2592000;
    const sPerYear = 31557600;

    const elapsed = Math.floor(new Date().getTime() / 1000) - timestamp;
    let total;
    let text;

    if(elapsed < 10) return "just now";

    if(elapsed < sPerMinute) {
        total = Math.round(elapsed);
        text = "second";
    } else if(elapsed < sPerHour) {
        total = Math.round(elapsed / sPerMinute);
        text = "minute";
    } else if(elapsed < sPerDay) {
        total = Math.round(elapsed / sPerHour);
        text = "hour";
    } else if(elapsed < sPerMonth) {
        total = Math.round(elapsed / sPerDay);
        text = "day";
    } else if(elapsed < sPerYear) {
        total = Math.round(elapsed / sPerMonth);
        text = "month";
    }

    if(total) {
        return `${ total } ${ text }${ total > 1 ? "s" : "" } ago`;
    }

    const years = Math.round(elapsed / sPerYear);
    const months = Math.round((years * sPerYear - elapsed) / sPerMonth);

    return `${ years } year(s), ${ months } month(s)`;
}

const filesize_orders_of_magnitude = ["", "K", "M", "G"];

/**
 * Format the file size. Ex. 50000000 bytes -> 50MB
 *
 * @param size_bytes File size in bytes
 */
export function formatFileSize(size_bytes: number): string {
    let i = 0;

    while(size_bytes > 1024) {
        size_bytes /= 1024;

        i++;
    }

    return `${ Math.ceil(size_bytes) } ${ filesize_orders_of_magnitude[i] }B`;
}

/**
 * Transform a buffer to a cookie and url safe string
 *
 * @param input input buffer
 */
export function sanitizeBuffer(input: string | Buffer): string {
    if(input instanceof Buffer) return input.toString("base64").replace(/[\+/=]/g, "_");
    return input.replace(/[\+/=]/g, "_");
}

/**
 * crypto.pbkdf2 wrapper
 */
export async function pbkdf2(input_string: string, salt: string, iterations: number, keylen: number): Promise<Hash> {
    return new Promise((resolve: any) => {
        crypto.pbkdf2(input_string, salt, iterations, keylen, "sha512",
        (_hash_error: any, derived_key: Buffer) => {
            // TODO maybe handle the error?
            resolve({
                salt,
                key: derived_key.toString("base64"),
                iterations,
                keylen
            });
        });
    });
}

export enum RejectionType {
    GENERAL_OTHER,
    GENERAL_UNKNOWN,
    GENERAL_INVALID_DATA,
    GENERAL_ACCESS_DENIED,
    GENERAL_PARAMETER_REQUIRED,

    API_INVALID_REQUEST_METHOD,
    API_INVALID_ROUTE,

    CONFIG_ITEM_NOT_FOUND,

    USER_NOT_FOUND,
    USER_SESSION_INVALID,

    PAGE_NOT_FOUND,
    PAGE_DELETED,
    PAGE_REVISION_HIDDEN,
    PAGE_NAME_TAKEN,
    PAGE_TITLE_INVALID,

    FILE_NAME_TAKEN,
    FILE_TOO_BIG,
    FILE_NOT_FOUND,

    NAMESPACE_ERROR,
}

export class Rejection {
    type: RejectionType;
    client_message?: string;

    constructor(type: RejectionType, client_message?: string) {
        this.type = type;
        this.client_message = client_message || "Some error occured";
    }
}

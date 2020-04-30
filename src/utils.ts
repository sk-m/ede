import he from "he";

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
 */
export function log(message: string, type: number = 1, error?: Error): void {
    let brackets_text = info_text;

    switch(type) {
        case 2: { brackets_text = warn_text } break;
        case 3: { brackets_text = error_text } break;
        case 4: { brackets_text = crit_text } break;
    }

    // tslint:disable-next-line: no-console
    console.log(`${ brackets_text }`, message ,`${ Colors.Reset }`);
    // tslint:disable-next-line: no-console
    if(error) console.log(error);
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

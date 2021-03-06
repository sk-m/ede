import he from "he";
import { sql } from "./server";

import * as Util from "./utils";

export interface LogEntry {
    id: number;
    type: string;

    executor: number | string;
    target: string;

    action_text: string;
    summary_text: string;
    tags: string[];

    created_on: number;
    visibility_level: number;
}

export const log_icons: { [log_type: string]: string } = {
    groupupdate: "fas fa-users-cog",

    usergroupsupdate: "fas fa-user-cog",
    blockuser: "fas fa-user-lock",

    createwikipage: "fas fa-file-alt",
    deletewikipage: "fas fa-trash",
    restorewikipage: "fas fa-trash-restore",
    movewikipage: "fas fa-arrow-right",
    restrictwikipage: "fas fa-unlock"
};

export interface LogTagDescriptor {
    icon_class: string;
    text: string;
    title: string;
    color: string;
}

export const log_tags_info: { [name: string]: LogTagDescriptor } = {
    f2asigned: {
        icon_class: "fas fa-key",
        text: "2fa signed",
        title: "This action was verified with a 2fa challenge",
        color: "purple"
    }
};

/**
 * Construct log entries HTML. Typically put inside <div class="ui-logs-container">${ ouput_of_this_function }</div>
 *
 * @param entries log entries
 */
export function constructLogEntriesHTML(entries: LogEntry[]): string {
    // Check if there are entries
    if(entries.length === 0) {
        return "<span class=\"info-message\"><i class=\"fas fa-info-circle\"></i> No entries</span>";
    }

    let html = "";
    let icon;

    for(const entry of entries) {
        const date = new Date(entry.created_on * 1000);
        icon = log_icons[entry.type] || "fas fa-cog";
        let tags_html = "";

        if(entry.tags.length !== 0) {
            for(const tag_type of entry.tags) {
                const tag_info = log_tags_info[tag_type];

                tags_html += `\
<span title="${ tag_info.title }" class="c-${ tag_info.color }"><i class="${ tag_info.icon_class }"></i> ${ tag_info.text }</span>`;
            }
        }

        html += `\
<div class="ui-log-item" data-logid="${ entry.id }">
    <span class="time" title="${ date.toUTCString() }">
        <i class="${ icon }"></i>
        <span>${ Util.formatTimeString(entry.created_on) }</span>
    </span>
    ${ tags_html ? `<span class="tags">${ tags_html }</span>` : "" }
    <span class="action-text">${ entry.action_text }</span>
    ${ entry.summary_text ? `<span class="summary">(${ entry.summary_text })</span>` : "" }
</div>`;
    }

    return html;
}

/**
 * Create a new log entry in the database
 *
 * @param type log type
 * @param executor user that made a logged change
 * @param target target. May be a user, page, user group, etc.
 * @param action_text text describing an executed action (ex. "user1 changed the rights for 'somegroup' group")
 * @param summary_text executor's summary
 * @param visibility_level visibility level
 */
export async function createEntry(
    type: string,
    executor: number | string,
    target: number | string,
    action_text: string,
    summary_text?: string,
    tags: string[] = [],
    visibility_level: number = 0
): Promise<number> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("INSERT INTO `logs` (`type`, `executor`, `target`, `action_text`, `summary_text`, `tags`, `created_on`, `visibility_level`) \
VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [type, executor, target, action_text, summary_text, tags.join("|"), Math.floor(new Date().getTime() / 1000), visibility_level],
        (error: any, results: any) => {
            if(error) reject(error);
            else resolve(results.insertId);
        });
    });
}

/**
 * Get log entries from the database
 *
 * @param type log type
 * @param executor executor (user id)
 * @param target target
 */
export async function getEntries(type: string | string[], executor?: number, target?: string | number, encode: boolean = true): Promise<LogEntry[]> {
    return new Promise((resolve: any, reject: any) => {
        let sql_query;

        if(Array.isArray(type)) {
            // Disallow '
            for(const item of type) {
                if(item.includes("'")) {
                    reject();
                    return;
                }
            }

            sql_query = `SELECT * FROM \`logs\` WHERE \`type\` IN ('${ type.join("','") }')`;
        } else {
            sql_query = `SELECT * FROM \`logs\` WHERE \`type\` = '${ type }'`;
        }

        if(executor) sql_query += ` AND \`executor\` = '${ executor }'`;
        if(target) sql_query += ` AND \`target\` = '${ target }'`;

        sql.query(sql_query, (error: any, results: any) => {
            if(error) {
                reject(error);
            } else {
                const final_results: LogEntry[] = [];

                for(const entry of results) {
                    const action_text = (entry.action_text as Buffer).toString("utf8");
                    const summary_text = (entry.summary_text as Buffer).toString("utf8");

                    final_results.push({
                        ...entry,

                        tags: entry.tags ? entry.tags.split("|") : [],
                        action_text,
                        summary_text: encode ? he.encode(summary_text) : ""
                    })
                }

                resolve(final_results);
            }
        })
    });
}

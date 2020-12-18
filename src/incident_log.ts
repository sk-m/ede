import { sql } from "./server";

import * as Util from "./utils";

export interface IncidentLogEntry {
    id: number;
    severity: number;

    error_message: string;
    error_stacktrace: string;
    error_info?: any;
    was_handled: boolean;

    events: number;

    timestamp: number;
    is_read: boolean;
}

/**
 * Create a new incident log (update the events number, if such incident was already reported before)
 *
 * @param error_message main error message
 * @param severity 2 - warn, 3 - error, 4 - critical
 * @param error_stacktrace js's error stacktrace string
 * @param was_handled was this error handled? False for unhandled exceptions/rejections
 * @param error_info additional debugging info
 */
export function createEntry(
    error_message: string,
    severity: number,
    error_stacktrace: string | null = null,
    was_handled: boolean = true,
    error_info?: any,
): void {
    const error_info_str = error_info
    ? JSON.stringify(error_info)
    : "null";

    sql.execute("CALL new_incident_log(?, ?, ?, ?, ?)",
    [severity, error_message, error_stacktrace || null, error_info_str, was_handled ? 1 : 0],
    (error: any) => {
        if(error) Util.log("Could not create a new incident log entry", 3, error, undefined, false);
    });
}

/**
 * Get all incident logs (ordered from newest to oldest / higher id to lower id)
 *
 * @param unread_only get only unread incidents?
 * @param records_number number of records to retrieve
 * @param from id from which to start retrieving records
 */
export async function getAll(unread_only: boolean = false, records_number: number = 50, from?: number): Promise<IncidentLogEntry[]> {
    return new Promise((resolve: any, reject: any) => {
        // Create an sql query
        let sql_query = "SELECT * FROM `incident_logs`";
        let sql_args: any[] = [records_number];

        // Add an unread "filter"
        if(unread_only) sql_query += " WHERE `is_read` = b'0'";

        // Starting id provided, add to the query
        if(from) {
            // If we added a filter, we should add an "AND" keyword to our query, because we already have one coulmn in the WHERE clause
            if(unread_only) sql_query += " AND";
            else sql_query += " WHERE";

            sql_query += " id < ? ORDER BY id DESC LIMIT ?";
            sql_args = [from - 1, records_number];
        } else {
            sql_query += " ORDER BY id DESC LIMIT ?";
        }

        // Get the records
        sql.execute(sql_query, sql_args,
        (error: any, results: any) => {
            if(error) {
                resolve([]);
                Util.log("Could not get incident logs from the database", 3, error, { sql_query, sql_args });
            } else {
                const final_results: IncidentLogEntry[] = [];

                for(const entry of results) {
                    final_results.push({
                        ...entry,

                        was_handled: entry.was_handled.readInt8(0) === 1,
                        is_read: entry.is_read.readInt8(0) === 1
                    })
                }

                resolve(final_results);
            }
        });
    });
}
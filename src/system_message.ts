import { sql } from "./server";
import * as Util from "./utils";
import he from "he";

export type SystemMessagesObject = { [name: string]: SystemMessage };
export interface SystemMessage {
    name: string;

    /** The value is the same as default_value, if it is not set */
    value: string;
    default_value: string;
    is_default: boolean;
    is_deletable: boolean;
    does_exist: boolean;

    rev_history: any; // TODO rev_history type
}

/**
 * Get all existing system messages
 *
 * @param from offset, 0 if not provided
 * @param n number of records to return, 100 if not provided
 * @param startswith only return records, whose name start with a specific string
 */
export async function get_all(from: number = 0, n: number = 100, startswith?: string): Promise<SystemMessagesObject> {
    return new Promise((resolve: any) => {
        let query = `SELECT * FROM \`system_messages\` WHERE id >= ${ from }`;

        if(startswith) {
            query += ` AND \`name\` LIKE '${ Util.sanitize(startswith) }%'`;
        }

        query += ` LIMIT ${ n }`

        sql.query(query, (error: Error, results: any) => {
            if(error || results.length === 0) {
                resolve({});

                return;
            }

            const final_results: SystemMessagesObject = {};

            for(const sysmsg of results) {
                final_results[sysmsg.name] = {
                    ...sysmsg,

                    value: he.decode(sysmsg.value !== null ? sysmsg.value : sysmsg.default_value),
                    is_default: !sysmsg.value,
                    is_deletable: sysmsg.deletable.readInt8(0) === 1,
                    does_exist: true
                };
            }

            resolve(final_results);
        });
    });
}

/**
 * Set a new value for the system message
 *
 * @param name name of the system message
 * @param value value for the system message
 */
export async function set(name: string, value: string): Promise<boolean> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("UPDATE `system_messages` SET `value` = ? WHERE `name` = ?",
        [value, name],
        (error: Error) => {
            if(error) {
                reject(error);
                return;
            }

            resolve(true);
        });
    });
}

/**
 * Create a new the system message
 *
 * @param name name of the new system message
 * @param value value for the new system message
 */
export async function create(name: string, value: string): Promise<boolean> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("INSERT INTO `system_messages` (`name`, `value`, `rev_history`, `deletable`) VALUES (?, ?, '{}', b'1')",
        [name, value],
        (error: Error) => {
            if(error) {
                reject(error);
                return;
            }

            resolve(true);
        });
    });
}

/**
 * Delete a system message
 *
 * @param name name of the system message to be deleted
 */
export async function remove(name: string): Promise<boolean> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("DELETE FROM `system_messages` WHERE `name` = ?",
        [name],
        (error: Error) => {
            if(error) {
                reject(error);
                return;
            }

            resolve(true);
        });
    });
}

/**
 * Get system message
 *
 * @param name Name(s) of the system messsage(s)
 */
export async function get(query: string[] | string[][]): Promise<SystemMessagesObject> {
    return new Promise((resolve: any) => {
        const query_names: string[] = [];
        const normalized_query: string[][] = [];

        for(const el of query) {
            if(Array.isArray(el)) {
                // With parameters. el is an array, where first item is a name
                if(!el[0].includes("'")) {
                    query_names.push(el[0]);
                    normalized_query.push(el);
                }
            } else {
                // Without parameters. el is a name
                if(!el.includes("'")) {
                    query_names.push(el);
                    normalized_query.push([el]);
                }
            }
        }

        // TODO @cleanup @security
        sql.query(`SELECT * FROM \`system_messages\` WHERE \`name\` IN ('${ query_names.join("','") }')`,
        (error: Error, results: any) => {
            if(error) {
                resolve({});
                Util.log(`Could not load '${ query }' system messages`, 2);

                return;
            }

            const final_results: SystemMessagesObject = {};

            const results_obj: any = {};

            for(const result of results) {
                results_obj[result.name] = result;
            }

            for(const el of normalized_query) {
                const name = el[0];
                const sysmsg = results_obj[name];

                if(sysmsg) {
                    let final_value = he.decode(sysmsg.value !== null ? sysmsg.value : sysmsg.default_value);

                    // Do we have to put in arguments?
                    if(el.length > 1) {
                        for(let i = 1; i < el.length; i++) {
                            final_value = final_value.replace(`$${ i }`, el[i]);
                        }
                    }

                    final_results[sysmsg.name] = {
                        ...sysmsg,

                        value: final_value,
                        is_default: !sysmsg.value,
                        is_deletable: sysmsg.deletable.readInt8(0) === 1,
                        does_exist: true,
                    };
                } else {
                    final_results[name] = {
                        name,

                        value: `<code>[! SYSMSG ${ name } !]</code>`,
                        default_value: "",
                        is_default: false,
                        is_deletable: false,
                        does_exist: false,

                        rev_history: {}
                    };
                }
            }

            resolve(final_results);
        });
    });
}

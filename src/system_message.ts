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
                    is_deletable: sysmsg.deletable.readInt8(0) === 1
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
        sql.query(`UPDATE \`system_messages\` SET \`value\` = '${ Util.sanitize(value) }' WHERE \`name\` = '${ Util.sanitize(name) }'`,
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
        sql.query(`INSERT INTO \`system_messages\` (\`name\`, \`value\`, \`rev_history\`, \`deletable\`) VALUES ('${ Util.sanitize(name) }', '${ Util.sanitize(value) }', '{}', b'1')`,
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
        sql.query(`DELETE FROM \`system_messages\` WHERE \`name\` = '${ Util.sanitize(name) }'`,
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
export async function get(names: string[] | string): Promise<SystemMessage | SystemMessagesObject> {
    return new Promise((resolve: any) => {
        let query: string;
        let getting_multiple: boolean = false;

        if(Array.isArray(names)) {
            // Get multiple messages
            getting_multiple = true;

            query = `SELECT * FROM \`system_messages\` WHERE \`name\` IN ('${ names.join("','") }')`;
        } else {
            query = `SELECT * FROM \`system_messages\` WHERE \`name\` = '${ names }'`;
        }

        sql.query(query, (error: Error, results: any) => {
            if(error || results.length === 0) {
                resolve({});
                Util.log(`Could not load '${ names }' system message(s)`, 2);

                return;
            }

            let final_results: SystemMessage | SystemMessagesObject = {};

            if(getting_multiple) {
                const results_obj: any = {};

                for(const result of results) {
                    results_obj[result.name] = result;
                }

                for(const name of names) {
                    const sysmsg = results_obj[name];

                    if(sysmsg) {
                        final_results[sysmsg.name] = {
                            ...sysmsg,

                            value: he.decode(sysmsg.value !== null ? sysmsg.value : sysmsg.default_value),
                            is_default: !sysmsg.value,
                            is_deletable: sysmsg.deletable.readInt8(0) === 1
                        };
                    } else {
                        final_results[name] = {
                            name,

                            value: `<code>[! SYSMSG ${ name } !]</code>`,
                            default_value: "",
                            is_default: false,
                            is_deletable: false,

                            rev_history: {}
                        };
                    }
                }
            } else {
                final_results = {
                    ...results[0],

                    value: he.decode(results[0].value !== null ? results[0].value : results[0].default_value),
                    is_default: !results[0].value,
                    is_deletable: results[0].deletable.readInt8(0) === 1
                };
            }

            resolve(final_results);
        });
    });
}

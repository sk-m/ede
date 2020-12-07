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
 * Get all existing system messages that start with a substring (Not encoded by default!)
 *
 * @param from offset, 0 if not provided
 * @param n number of records to return, 100 if not provided
 * @param startswith only return records, whose name start with a specific string
 */
export async function get_all(from: number = 0, n: number = 100, startswith?: string, encode: boolean = false): Promise<SystemMessagesObject> {
    return new Promise((resolve: any) => {
        // Construct a query
        let query = 'SELECT * FROM `system_messages` WHERE id >= ?'; // ? -> from

        if(startswith) {
            query += ` AND \`name\` LIKE '${ startswith.replace(/\'/g, "") }%'`;
        }

        query += ` LIMIT ?` // ? -> n

        // Get the system pages
        sql.execute(query, [from, n], (error: Error, results: any) => {
            if(error || results.length === 0) {
                // Some error occured or no system messages were found
                resolve({});
                return;
            }

            const final_results: SystemMessagesObject = {};

            for(const sysmsg of results) {
                // Make sure the value is decoded
                // TODO no need to decode default values as they are always non-encoded
                const value = he.decode(sysmsg.value !== null ? sysmsg.value : sysmsg.default_value);

                final_results[sysmsg.name] = {
                    ...sysmsg,

                    value: encode ? he.encode(value) : value,
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
export async function set(name: string, value: string): Promise<void> {
    // TODO We currently allow ALL inputs. Including thouse, that include stuff like <script>... Maybe we should be more careful here?
    return new Promise((resolve: any, reject: any) => {
        // Update the system message
        sql.execute("UPDATE `system_messages` SET `value` = ? WHERE `name` = ?",
        [value, name],
        (error: Error) => {
            if(error) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not set a new value for a system message"));
                Util.log(`Could not set a new value for a system message (name: '${ name }', value: '${ value }')`, 3, error);

                return;
            }

            resolve();
        });
    });
}

/**
 * Create a new the system message
 *
 * @param name name of the new system message
 * @param value value for the new system message
 */
export async function create(name: string, value: string): Promise<void> {
    // TODO We currently allow ALL inputs. Including thouse, that include stuff like <script>... Maybe we should be more careful here?
    return new Promise((resolve: any, reject: any) => {
        // Check if the name is correct
        if(!name.match(/^[a-z_-]{1,256}$/)) {
            reject(new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "System message name is invalid"));
            return;
        }

        // Create a system message
        sql.execute("INSERT INTO `system_messages` (`name`, `value`, `rev_history`, `deletable`) VALUES (?, ?, '{}', b'1')",
        [name, value],
        (error: Error) => {
            if(error) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not create a new system message"));
                Util.log(`Could not create a new system message (name: '${ name }', value: '${ value }')`, 3, error);

                return;
            }

            resolve();
        });
    });
}

/**
 * Delete a system message
 *
 * @param name name of the system message to be deleted
 */
export async function remove(name: string): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("CALL systemmessage_remove(?)",
        [name],
        (error: Error, results: any) => {
            if(error) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not remove a system message"));
                Util.log(`Could not remove a system message (name: '${ name }')`, 3, error);

                return;
            }

            // Check if system message can be deleted
            if(results[0][0].status_non_deletable === 1) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "Requested system message is non-deletable or non-exitent"));
                return;
            }

            // System message was deleted successfully
            resolve();
        });
    });
}

/**
 * Get system message (Not encoded by default!)
 *
 * @param name Name(s) of the system messsage(s)
 */
export async function get(query: string[] | string[][], encode: boolean = false): Promise<SystemMessagesObject> {
    return new Promise((resolve: any) => {
        // Create a valid names query
        const query_names: string[] = [];
        const normalized_query: string[][] = [];

        // Each element in the query parameter can either be a system message name or an array like [msg_name, arg1, arg2, ...]
        // We do not allow names with a ' in them to avoid SQL injection attacks
        // TODO in future, we should disable multiple exressions in one SQL query to be even safer
        for(const el of query) {
            if(Array.isArray(el)) {
                // Element is an array, where first item is a name
                if(!el[0].includes("'")) {
                    query_names.push(el[0]);
                    normalized_query.push(el);
                }
            } else {
                // Element is just a sysmsg name, so no parameters are included
                if(!el.includes("'")) {
                    query_names.push(el);
                    normalized_query.push([el]);
                }
            }
        }

        // TODO @cleanup with the results_obj
        // Get the system messages
        sql.query(`SELECT * FROM \`system_messages\` WHERE \`name\` IN ('${ query_names.join("','") }')`,
        (error: Error, results: any) => {
            if(error) {
                resolve({});
                Util.log(`Could not load '${ query }' system messages`, 2, error);

                return;
            }

            const final_results: SystemMessagesObject = {};

            // Create a results object
            const results_obj: any = {};

            for(const result of results) {
                results_obj[result.name] = result;
            }

            // Work with each system message
            for(const el of normalized_query) {
                const name = el[0];
                const sysmsg = results_obj[name];

                // Check if that system message was found
                if(sysmsg) {
                    // Found

                    let final_value = sysmsg.value !== null ? sysmsg.value : sysmsg.default_value;

                    // Put in arguments, if rerquested to do so
                    // Here, el is query element. If it is an array, some arguments were provided
                    if(Array.isArray(el)) {
                        for(let i = 1; i < el.length; i++) {
                            final_value = final_value.replace(`$${ i }`, el[i]);
                        }
                    }

                    if(encode) final_value = he.encode(final_value);

                    final_results[sysmsg.name] = {
                        ...sysmsg,

                        value: final_value,
                        is_default: !sysmsg.value,
                        is_deletable: sysmsg.deletable.readInt8(0) === 1,
                        does_exist: true,
                    };
                } else {
                    // System message was not found

                    final_results[name] = {
                        name,

                        value: `<a href="/System:SystemMessages/${ name }" title="Edit this system message" class="ui-text monospace ede-undefined-sysmsg">[! SYSMSG ${ name } !]</a>`,
                        default_value: "",
                        is_default: false,
                        is_deletable: false,
                        does_exist: false,

                        rev_history: {}
                    };
                }
            }

            // Return the result
            resolve(final_results);
        });
    });
}

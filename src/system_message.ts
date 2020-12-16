import { sql, _redis, _redis_ok } from "./server";
import * as Util from "./utils";
import he from "he";
import { registry_config } from "./registry";

export type SystemMessagesObject = { [name: string]: SystemMessage };
export interface SystemMessage {
    name: string;

    /** The value is the same as default_value, if it is not set */
    value?: string;
    default_value: string;
    raw_value?: string;
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
                Util.log(`Could not set a new value for a system message`, 3, error, { name, value });

                return;
            }

            // We successfully updated the system message
            resolve();

            // Remove from cache
            const registry_config_snapshot = registry_config.get();

            if(_redis_ok && registry_config_snapshot["caching.cachesystemmessages"].value as boolean === true) {
                _redis.rawCall(["del", `systemmessage|${ name }`], (cache_error: any) => {
                    if(cache_error) {
                        Util.log("Could not remove a system message from cache. Triggered by SystemMessage.set()", 3, cache_error, { name });
                    }
                });
            }
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
                Util.log(`Could not create a new system message`, 3, error, { name, value });

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
                Util.log(`Could not remove a system message`, 3, error, { name });

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

export type SystemMessageValuesObject = { [name: string]: string | undefined };

/**
 * Get system message(s) value (Not encoded by default!)
 *
 * This function gets *only* the values of the system messages. If you need the whole objects, use get_object() instead.
 * Keep in mind that although this function gets the values from the cache, the get_object() function gets the objects from the database,
 * so the latter one can be a bit slower.
 *
 * @param query name(s) of the system messsage(s) (with or without arguments)
 * @param encode encode the values?
 * @param use_placeholder set the value to the `[! SYSMSG ... !]` if not found?
 */
export async function get_value(
    query: string[] | string[][],
    encode: boolean = false,
    use_placeholder: boolean = true
    ): Promise<SystemMessageValuesObject> {
    return new Promise(async (resolve: any, reject: any) => {
        // Get the values from the get_object() function
        // This is called when the caching failed or is disabled
        const get_slow = async () => {
            const slow_query_results = await get_object(query, encode, use_placeholder);
            const final_results: SystemMessageValuesObject = {};

            // tslint:disable-next-line: forin
            for(const name in slow_query_results) {
                final_results[name] = slow_query_results[name].value;
            }

            return final_results;
        };

        // Check if we should get the system messages from cache
        const registry_config_snapshot = registry_config.get();

        if(!_redis_ok || registry_config_snapshot["caching.cachesystemmessages"].value as boolean !== true) {
            // Caching is disabled, get from the main database
            resolve(await get_slow());
            return;
        }

        // Caching is enabled, continue

        // Create a valid names query
        const query_names: string[] = [];
        const normalized_query: string[][] = [];

        // Each element in the query parameter can either be a system message name or a array like [msg_name, arg1, arg2, ...]
        // We do not allow names with a ' in them to avoid SQL injection attacks
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

        // Create a redis query
        const redis_query = ["mget"];

        for(const name of query_names) {
            redis_query.push(`systemmessage|${ name }`);
        }

        // Get the system messages from the cache
        _redis.rawCall(redis_query, async (error: any, results: any) => {
            if(error) {
                // Some error occured, just get all the messages from the main database
                Util.log("Could not get system messages from get_value function, getting directly from the database", 3, error);

                resolve(await get_slow());
                return;
            }

            // No errors reported. We might not have *all* the sysmsgs that were requested, so we have to add those, that we couldn't get
            // from cache
            const final_results: SystemMessageValuesObject = {};
            const unavailable_sysmsgs_indexes: number[] = [];

            let i = 0;

            // Go throgh the results and check if we recieved a value for each query element
            for(let value of results) {
                if(value) {
                    // We got this particular system message, append to the final results

                    // Put in arguments, if rerquested to do so
                    // Here, el is a query element. If it is an array, some arguments were provided
                    const el = normalized_query[i];
                    if(Array.isArray(el)) {
                        for(let arg_i = 1; arg_i < el.length; arg_i++) {
                            value = value.replace(`$${ arg_i }`, el[arg_i]);
                        }
                    }

                    final_results[query_names[i]] = value;
                } else {
                    // We didn't get this system message from the database, we will have to get this one from the main database
                    unavailable_sysmsgs_indexes.push(i);
                }

                i++;
            }

            if(unavailable_sysmsgs_indexes.length !== 0) {
                // We have got some system messages that we did not get from the cache, get them from the main db now

                const slow_query: any[] = [];

                // Get the names that we do not have
                for(const index of unavailable_sysmsgs_indexes) {
                    slow_query.push(normalized_query[index]);
                }

                // Query the main db
                const slow_query_results = await get_object(slow_query, encode, use_placeholder);

                // Populate the results
                // We can't just return the result of the slow query because the slow query returns an object, not just a value
                // tslint:disable-next-line: forin
                for(const name in slow_query_results) {
                    final_results[name] = (!slow_query_results[name].does_exist && !use_placeholder)
                    ? undefined
                    : slow_query_results[name].value;
                }
            }

            resolve(final_results);
        });
    });
}

/**
 * Get system message (Not encoded by default!)
 *
 * This function will get all the information about a system message from the database. If you just need the value, it is a much better
 * idea to use the get_value function that has the exact same function parameters. get_value function will be faster in most cases,
 * because it recieves the system messages from the cache (if caching is enabled).
 *
 * @param query name(s) of the system messsage(s) (with or without arguments)
 * @param encode encode the values?
 * @param use_placeholder set the value to the `[! SYSMSG ... !]` if not found?
 */
export async function get_object(query: string[] | string[][], encode: boolean = false, use_placeholder: boolean = false): Promise<SystemMessagesObject> {
    return new Promise((resolve: any) => {
        // Create a valid names query
        const query_names: string[] = [];
        const normalized_query: string[][] = [];

        // Each element in the query parameter can either be a system message name or an array like [msg_name, arg1, arg2, ...]
        // We do not allow names with a ' in them to avoid SQL injection attacks
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
                Util.log(`Could not load system messages from the database by query`, 2, error, { query });

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
                        raw_value: sysmsg.value,
                        is_default: !sysmsg.value,
                        is_deletable: sysmsg.deletable.readInt8(0) === 1,
                        does_exist: true,
                    };
                } else {
                    // System message was not found

                    final_results[name] = {
                        name,

                        value: use_placeholder
                        ? `<a href="/System:SystemMessages/${ name }" title="Edit this system message" class="ui-text monospace ede-undefined-sysmsg">[! SYSMSG ${ name } !]</a>`
                        : undefined,
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

            // Check if we need to cache what we got
            const registry_config_snapshot = registry_config.get();

            if(_redis_ok && registry_config_snapshot["caching.cachesystemmessages"].value as boolean === true) {
                const redis_query: string[] = ["mset"];

                for(const name of query_names) {
                    // Don't cache nonexistent system messages
                    if(!final_results[name].does_exist) continue;

                    // Key
                    redis_query.push(`systemmessage|${ name }`);
                    // Value
                    redis_query.push(final_results[name].raw_value || final_results[name].value!);
                }

                // Save
                if(redis_query.length > 1) {
                    _redis.rawCall(redis_query, (cache_error: any) => {
                        if(cache_error) {
                            Util.log("Could not cache system messages", 3, cache_error);
                        }
                    });
                }
            }
        });
    });
}

import crypto from "crypto";
import request from "request";
import { v4 as uuidv4 } from "uuid";
import cookie from "cookie";

import { sql } from "./server";
import * as SystemMessage from "./system_message";
import * as Util from "./utils";
import * as F2A from "./f2a";

import * as SECRETS from "../secrets.json";
import { registry_config } from "./registry";
import { SECURITY_COOKIE_SID_SIZE, SECURITY_COOKIE_SALT_SIZE, SECURITY_CSRF_TOKEN_SIZE, SECURITY_SID_HASHING_ITERATIONS, SECURITY_SID_HASHING_KEYLEN } from "./constants";
import { GroupsObject, Group, GroupsAndRightsObject } from "./right";

export interface User {
    id: string;

    username: string;

    email_address?: string;
    email_verified?: boolean;

    password_hash_salt?: string;
    password_hash_iterations?: number;
    password_hash_keylen?: number;

    stats?: UserStats;
    blocks: string[];

    current_session?: UserSession;
}

export interface UserSession {
    cookie_sid?: string;

    session_token: string;

    sid_hash: string;
    sid_salt: string;

    csrf_token: string;

    ip_address?: string;
    user_agent?: string;

    created_on: number;
    expires_on: number;
}

export interface UserStats {
    created_on: number;
}
export enum UsernameAvailability {
    Available,
    Taken,
    InvalidFormat,
    Forbidden
}

export interface Hash {
    readonly salt: string,
    readonly key: string,
    readonly iterations: number,
    readonly keylen: number
}

// TODO move to Util
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

// TODO move to Util
export function formatString(input: string | Buffer): string {
    if(input instanceof Buffer) return input.toString("base64").replace(/[\+/]/g, "_");
    return input.replace(/[\+/]/g, "_");
}

/**
 * Check if username is valid and not already taken
 *
 * @param username Username
 */
export async function checkUsername(username: string): Promise<UsernameAvailability> {
    return new Promise((resolve: any) => {
        if(
            !username || username === "" ||
            !username.match(/^[A-Za-z0-9_]{2,32}$/) ||
            !/[A-Za-z_]/.test(username.charAt(0))
        ) {
            resolve(UsernameAvailability.InvalidFormat);
            return;
        }

        // TODO probably wont work because of toLowerCase(). Maybe we should have username and display_username in the database?
        sql.execute(`SELECT id FROM \`users\` WHERE username = ?`,
        [username.toLowerCase()],
        (error: any, results: any) => {
            if(error || results.length !== 0) resolve(UsernameAvailability.Taken);
            else resolve(UsernameAvailability.Available);
        });
    });
}

/**
 * @category Registry updater
 */
export async function getAllUserGroups(): Promise<any> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("SELECT `name`, `added_rights`, `right_arguments` FROM `user_groups`", (error: any, results: any) => {
            if(error || results.length < 1) {
                Util.log("Could not get all user groups from the database", 3);

                reject();
            } else {
                const result_object: GroupsObject = {};
                for(const group of results) {
                    let added_rights = [];

                    if(group.added_rights) {
                        added_rights = group.added_rights.split(";");
                    }

                    result_object[group.name] = {
                        name: group.name,

                        added_rights,
                        right_arguments: group.right_arguments
                    };
                }

                resolve(result_object);
            }
        });
    });
}

/**
 * Update the user group in the database (does not update the registry container)
 *
 * @param user_group new user group
 */
export async function saveUserGroup(user_group: Group): Promise<true> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("UPDATE `user_groups` SET `added_rights` = ?, `right_arguments` = ? WHERE `name` = ?",
        [user_group.added_rights.join(";"), JSON.stringify(user_group.right_arguments), user_group.name],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                Util.log(`Could not save user group '${ user_group.name }' to the database`, 3, error);

                reject(error);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Create a new user groups without rights
 *
 * @param name Internal name of the new user group
 */
export async function createUserGroup(name: string): Promise<true> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("INSERT INTO `user_groups` (`name`,`added_rights`,`right_arguments`) VALUES (?, '', '{}')",
        [name],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                Util.log(`Could not create a new user group '${ name }'`, 3, error);

                reject(error);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Delete user group
 *
 * @param name Internal name of the group to be deleted
 */
export async function deleteUserGroup(name: string): Promise<true> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("DELETE FROM `user_groups` WHERE `name` = ?",
        [name],
        (error: any) => {
            if(error) {
                Util.log(`Could not delete '${ name }' user group`, 3, error);

                reject(error);
            } else {
                resolve(true);
            }
        });
    });
}

// TODO @performance
/**
 * Get user's groups and rights with parameters
 *
 * @param user_id user's id
 */
export async function getUserGroupRights(user_id: string | number): Promise<GroupsAndRightsObject> {
    return new Promise((resolve: any, reject: any) => {
        const result: GroupsAndRightsObject = {
            groups: [],
            rights: {}
        };

        // An array to keep track of rights we already encountered
        const rights_arr: string[] = [];

        // Get every group the requested user is in
        sql.execute("SELECT `group` FROM `user_group_membership` WHERE `user` = ?",
        [user_id],
        (group_error: any, group_results: any) => {
            if(group_error) {
                reject(group_error);
                return;
            } else {
                for(const group of group_results) {
                    result.groups.push(group.group);
                }

                // Get every right for that particular group
                sql.query(`SELECT \`added_rights\`, \`right_arguments\` FROM \`user_groups\` WHERE \`name\` IN ('${ result.groups.join("','") }')`,
                (right_error: any, right_results: any) => {
                    if(right_error) {
                        reject(right_error);
                        return;
                    } else {
                        // Go through all groups
                        for(const group of right_results) {
                            let added_rights = [];

                            if(group.added_rights) {
                                added_rights = group.added_rights.split(";");
                            }

                            // Go through all rights this group provides
                            for(const right_name of added_rights) {
                                // Check if client already has this right
                                if(rights_arr.includes(right_name)) {
                                    // This right was provided from an earlier group, we have to merge the existing arguments for this right
                                    // with the new ones

                                    // Go through all new arguments
                                    for(const argument_name in group.right_arguments[right_name]) {
                                        // Check if argument is not just {}
                                        if( group.right_arguments[right_name][argument_name] &&
                                            group.right_arguments[right_name][argument_name] !== {}
                                        ) {
                                            const argument_value = group.right_arguments[right_name][argument_name];

                                            if(argument_value instanceof Boolean) {
                                                // Boolean
                                                // If the argument is already set to false in some other group, but is is set to true in
                                                // this one, set the final value to true
                                                if(argument_value === true) {
                                                    result.rights[right_name][argument_name] = true;
                                                }
                                            } else if(argument_value instanceof Array) {
                                                // Push array item only if not already included
                                                for(const array_el of argument_value) {
                                                    // Add empty arguments array, if there isn't one
                                                    if(result.rights[right_name][argument_name] === undefined) {
                                                        result.rights[right_name][argument_name] = [];
                                                    }

                                                    if(!result.rights[right_name][argument_name].includes(array_el)) {
                                                        result.rights[right_name][argument_name].push(array_el)
                                                    }
                                                }
                                            } else if(argument_value instanceof Object) {
                                                // Object
                                                result.rights[right_name][argument_name] = { ...result.rights[right_name][argument_name],
                                                ...argument_value };
                                            } else {
                                                // Any other type
                                                result.rights[right_name][argument_name] = argument_value;
                                            }
                                        }
                                    }
                                } else {
                                    // This right is not yet present in the results object, so we can just assign it to the first arguments
                                    // object we encounter

                                    rights_arr.push(right_name);
                                    result.rights[right_name] = group.right_arguments[right_name] || {};
                                }
                            }
                        }

                        resolve(result);
                    }
                });
            }
        });
    });
}

/**
 * Get user by username
 *
 * @param username username
 */
export async function getFromUsername(username: string): Promise<User> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("SELECT * FROM `users` WHERE username = ?",
        [username],
        (error: any, results: any) => {
            if(error || results.length !== 1) {
                reject("User not found");
                return;
            }

            const user = results[0];
            const user_password = user.password.split(";");

            let user_blocks = [];
            if(user.blocks) user_blocks = user.blocks.split(";");

            resolve({
                id: user.id,

                username: user.username,
                email_address: user.email_address,
                email_verified: user.email_verified.readInt8(0) === 1,

                password_hash_salt: user_password[1],
                password_hash_iterations: user_password[3],
                password_hash_hash: user_password[2],

                stats: user.stats,
                blocks: user_blocks
            } as User);
        });
    });
}

// TODO! @placeholder csrf_tokens are still disabled
export async function getFromSession(http_request: any, csrf_token: string): Promise<User> {
    return new Promise(async (resolve: any, reject: any) => {
        if(!http_request.headers) {
            // TODO rename this types of messages. They should be descriptive
            reject("no_headers_provided");
            return;
        }

        if(!http_request.headers.cookie) {
            reject("no_cookies_provided");
            return;
        }

        const cookies: any = cookie.parse(http_request.headers.cookie);

        if(!cookies.st || !cookies.sid) {
            reject("no_session_cookies_provided");
            return;
        }

        const now = Math.floor(new Date().getTime() / 1000);

        const st_split: string[] = cookies.st.split(":");

        const st_uid: string = st_split[0];
        const st_st: string = st_split[1];

        // Get and validate the session
        sql.execute("SELECT * FROM `user_sessions` WHERE `user` = ? AND `session_token` = ?",
        [st_uid, st_st],
        async (session_error: any, session_results: any) => {
            if(session_error || session_results.length !== 1) {
                reject("session_token_not_found");
                return;
            }

            const session = session_results[0];

            // Check if session expired
            if(session.expires_on < now) {
                reject("session_expired_or_invalidated");
                return;
            }

            // // Found user session, check csrf token
            // if(csrf_token !== session.csrf_token) {
            //     reject("csrf_check_failed");
            //     return;
            // }

            // Hash sid
            const cookie_sid_hash: Hash = await pbkdf2(cookies.sid, session.sid_salt,
            SECURITY_SID_HASHING_ITERATIONS, SECURITY_SID_HASHING_KEYLEN);

            if(cookie_sid_hash.key === session.sid_hash) {
                // Get the user
                sql.execute("SELECT * FROM `users` WHERE id = ?",
                [st_uid],
                (user_error: any, user_results: any) => {
                    if(user_error || !user_results) {
                        reject(user_error);
                        return;
                    }

                    const user = user_results[0];
                    const user_password = user.password.split(";");

                    let user_blocks = [];
                    if(user.blocks) user_blocks = user.blocks.split(";");

                    resolve({
                        id: user.id,

                        username: user.username,
                        email_address: user.email_address,
                        email_verified: user.email_verified.readInt8(0) === 1,

                        password_hash_salt: user_password[1],
                        password_hash_iterations: user_password[3],
                        password_hash_hash: user_password[2],

                        stats: user.stats,
                        blocks: user_blocks,

                        current_session: {
                            cookie_sid: cookies.sid,

                            session_token: session.session_token,

                            sid_hash: session.sid_hash,
                            sid_salt: session.sid_salt,

                            csrf_token: session.csrf_token,

                            ip_address: http_request.headers["x-forwarded-for"] || http_request.ip,
                            user_agent: http_request.headers["user-agent"],

                            created_on: session.created_on,
                            expires_on: session.expires_on
                        }
                    } as User);

                    return;
                })
            } else {
                reject("sids_do_not_match");
                return;
            }
        });
    });
}

/**
 * Create a user (!! without any checks !!)
 *
 * Use this function only if you are sure the credentials are safe. No checks will be executed
 *
 * @param username Username
 * @param password Clear-text password
 * @param email_address Email address
 */
export async function create(username: string, password: string, email_address: string): Promise<User> {
    return new Promise(async (resolve: any, reject: any) => {
        const user_stats: UserStats = {
            created_on: Math.floor(new Date().getTime() / 1000)
        }

        // Get a snapshot of the registry config to use later in the function
        const registry_config_snapshot = registry_config.get();

        // Generate the salt for the password
        crypto.randomBytes(registry_config_snapshot["auth.sid_size"].value as number, (_: any, password_salt_buffer: Buffer) => {
            const password_hash_salt: string = formatString(password_salt_buffer);

            const password_hash_iterations = registry_config_snapshot["auth.password_hash_iterations"].value as number;
            const password_hash_keylen = registry_config_snapshot["auth.password_hash_keylen"].value as number;

            pbkdf2(password, password_hash_salt, password_hash_iterations, password_hash_keylen)
            .then((password_hash: Hash) => {
                const database_password_string: string =
                `pbkdf2;${ password_hash.key };${ password_hash_salt };${ password_hash_iterations };\
${ password_hash_keylen }`;

                // Create a user
                sql.execute("INSERT INTO `users` (`username`, `email_address`, `password`, `stats`) VALUES (?, ?, ?, ?)",
                [username, email_address, database_password_string, JSON.stringify(user_stats)],
                (error: any, results: any) => {
                    if(error) {
                        reject(new Error(`User creation failed, username might be taken (${ error.message })`));
                    } else {
                        // Return user object
                        resolve({
                            id: results.insertId,

                            username,
                            email_address,
                            email_verified: false,

                            password_hash_salt,
                            password_hash_iterations,
                            password_hash_keylen,

                            stats: user_stats
                        } as User);
                    }
                });
            })
            .catch((error: Error) => { reject(error) });
        });
    });
}

/**
 * Create a new user_tracking record
 *
 * @param user_id target user's id
 * @param ip_address target user's ip address
 * @param user_agent target user's user agent
 */
export async function newUserTrackingRecord(user_id: number, ip_address: string, user_agent: string): Promise<true> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("INSERT INTO `user_tracking` (`user`, `ip_address`, `user_agent`, `timestamp`) VALUES (?, ?, ?, UNIX_TIMESTAMP())",
        [user_id, ip_address, user_agent],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                Util.log(`Could not create a new user_tracking record for user id ${ user_id }`, 3, error);

                reject(error);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Create a new user session
 *
 * @param user user's internal id (id column in the database)
 * @param ip_address IP address of client
 * @param user_agent Client's useragent
 */
export async function createSession(user_id: string, ip_address: string, user_agent: string): Promise<UserSession> {
    return new Promise(async (resolve: any, reject: any) => {
        // Generate sid
        crypto.randomBytes(SECURITY_COOKIE_SID_SIZE, (_sid_error: any, sid_buffer: Buffer) => {
        // Generate sid salt
        crypto.randomBytes(SECURITY_COOKIE_SALT_SIZE, (_sid_salt_error: any, sid_salt_buffer: Buffer) => {
        // Generate csrf_token
        crypto.randomBytes(SECURITY_CSRF_TOKEN_SIZE, (_csrf_token_error: any, csrf_token_buffer: Buffer) => {
            const cookie_sid: string = formatString(sid_buffer);

            // Hash sid
            pbkdf2(cookie_sid, sid_salt_buffer.toString("base64"), SECURITY_SID_HASHING_ITERATIONS,
            SECURITY_SID_HASHING_KEYLEN)
            .then((sidHash: Hash) => {
                const session_token: string = uuidv4();
                const csrf_token: string = formatString(csrf_token_buffer);

                const now: number = Math.floor(new Date().getTime() / 1000);
                const expires_on: number = now + (registry_config.get()["auth.session_cookie_ttl"].value as number);

                const session: UserSession = {
                    cookie_sid,
                    session_token,

                    sid_hash: sidHash.key,
                    sid_salt: sidHash.salt,

                    csrf_token,

                    ip_address,
                    user_agent,

                    expires_on,
                    created_on: now
                };

                // Create a session
                sql.execute("INSERT INTO `user_sessions` (`user`, `session_token`, `sid_hash`, `sid_salt`, `csrf_token`, \
`expires_on`, `created_on`) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [user_id, session_token, sidHash.key, sidHash.salt, csrf_token, expires_on, now],
                (error: any) => {
                    if(error) { reject(error) }
                    else resolve(session);
                });

                // Create a new user_tracking record. We don't have to await it
                // TODO @performance @cleanup parseInt
                newUserTrackingRecord(parseInt(user_id, 10), ip_address, user_agent);
            })
            .catch((error: Error) => {
                reject(error);
            });
        });
        });
        });
    });
}

/**
 * Create an elevated session
 *
 * @param user_id User's id
 *
 * @returns [esid, Date object (time when the session will be invalid)]
 */
export async function createElevatedSession(user_id: number): Promise<[string, Date]> {
    return new Promise((resolve: any, reject: any) => {
        // now + 15 minutes (in ms)
        const valid_until = new Date().getTime() + 900000;
        const valid_until_unix: number = Math.floor(valid_until / 1000);

        // Generate esid
        crypto.randomBytes(128, (_esid_error: any, esid_buffer: Buffer) => {
            const esid = formatString(esid_buffer);

            // Create an elevated session
            sql.execute("INSERT INTO `elevated_user_sessions` (`user`, `esid`, `valid_until`) VALUES (?, ?, ?)",
            [user_id, esid, valid_until_unix],
            (error: any, results: any) => {
                if(error || results.length < 1) {
                    Util.log(`Could not create a new elevated session for user id ${ user_id }`, 3, error);

                    reject(new Error("Could not create a new elevated session for a user"));
                } else {
                    resolve([esid, valid_until]);
                }
            });
        });
    });
}

/**
 * Check elevated session validity
 *
 * @param user_id User's id
 * @param esid esid
 *
 * @returns true if valid
 */
export async function checkElevatedSession(user_id: number, esid: string): Promise<boolean> {
    return new Promise((resolve: any) => {
        if(!esid) {
            resolve(false);
            return;
        }

        const now: number = Math.floor(new Date().getTime() / 1000);

        // Get the session
        sql.execute("SELECT `valid_until` FROM `elevated_user_sessions` WHERE `user` = ? AND `esid` = ?",
        [user_id, esid],
        (error: any, results: any) => {
            if(error || results.length !== 1) {
                // Esid is incorrect
                resolve(false);
            } else {
                // There is such session, check if it is still valid
                resolve(results[0].valid_until > now);
            }
        });
    });
}

/**
 * Update user's blocks
 *
 * @param user_id User's id
 * @param restrictions Array of restrictions
 */
export async function updateUserBlocks(user_id: number, restrictions: string[]): Promise<true> {
    return new Promise((resolve: any, reject: any) => {
        let blocks_string;

        if(restrictions.length === 0) blocks_string = "";
        else blocks_string = Util.sanitize(restrictions.join(";"));

        sql.execute("UPDATE `users` SET `blocks` = ? WHERE id = ?",
        [blocks_string, user_id],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                Util.log(`Could not update blocks for user id ${ user_id }`, 3, error);

                reject(error);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Block address
 *
 * @param address Address to block
 * @param restrictions Array of restrictions
 */
export async function blockAddress(address: string, restrictions: string[]): Promise<true> {
    // TODO @placeholder this function will not append new restrictions, it will instead replace them with new once. Fix that!
    return new Promise((resolve: any, reject: any) => {
        if(!address) {
            reject(new Error("Invalid address"));
            return;
        }

        let blocks_string;

        if(restrictions.length === 0) blocks_string = "";
        else blocks_string = Util.sanitize(restrictions.join(";"));

        sql.execute("INSERT INTO `blocked_addresses` (`address`, `restrictions`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `restrictions` = ?",
        [address, blocks_string, blocks_string],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                Util.log(`Could not change block settings for address ${ address }`, 3, error);

                reject(new Error("Could not block an address"));
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Get address blocks
 *
 * @param address Address to block
 */
export async function getAddressBlocks(address: string): Promise<string[]> {
    // TODO this will not work for ranges like 124.173.1.0/24
    return new Promise((resolve: any, reject: any) => {
        sql.execute("SELECT `restrictions` FROM `blocked_addresses` WHERE `address` = ?",
        [address],
        (error: any, results: any) => {
            if(error) {
                // Could not get address blocks
                Util.log(`Could not get block settings for address ${ address }`, 3, error);

                reject(new Error("Could not get block settings for an address"));
            } else if(results.length !== 1) {
                // The address is not blocked in any way
                resolve([]);
            } else {
                const raw_restrictions = results[0].restrictions;
                let final_restrictions: string[] = [];

                if(raw_restrictions) final_restrictions = raw_restrictions.split(";");

                resolve(final_restrictions);
            }
        });
    });
}

/**
 * Destroy user's sessions
 *
 * @param user_id User's id
 */
export async function destroyUserSessions(user_id: number): Promise<true> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("UPDATE `user_sessions` SET `expires_on` = 1 WHERE `user` = ?",
        [user_id],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                Util.log(`Could not destroy sessions for user id ${ user_id }`, 3, error);

                reject(new Error("Could not invalidate all user sessions"));
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Invalidate user's session
 *
 * @param user_id User's id
 * @param session Session to invalidate
 */
export async function invalidateUserSession(user_id: number, session: UserSession): Promise<true> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("UPDATE `user_sessions` SET `expires_on` = 1 WHERE `user` = ? AND `session_token` = ?",
        [user_id, session.session_token],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                Util.log(`Could not invalidate user's session (user ${ user_id })`, 3, error);

                reject(new Error("Could not invalidate user session"));
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Update user's password
 *
 * @param user_id User's id
 * @param password New password in clear text
 */
export async function updateUserPassword(user_id: number, password: string): Promise<true> {
    return new Promise((resolve: any, reject: any) => {
        // Get a snapshot of the registry config to use later in the function
        const registry_config_snapshot = registry_config.get();

        // Generate the salt for the new password
        // TODO @placeholder we should use something like auth.password_salt size instead of this. Sid's salt size has nothing to do with a password
        crypto.randomBytes(registry_config_snapshot["auth.sid_size"].value as number, (_: any, password_salt_buffer: Buffer) => {
            const password_hash_salt: string = formatString(password_salt_buffer);

            const password_hash_iterations = registry_config_snapshot["auth.password_hash_iterations"].value as number;
            const password_hash_keylen = registry_config_snapshot["auth.password_hash_keylen"].value as number;

            pbkdf2(password, password_hash_salt, password_hash_iterations, password_hash_keylen)
            .then((password_hash: Hash) => {
                const database_password_string: string =
                `pbkdf2;${ password_hash.key };${ password_hash_salt };${ password_hash_iterations };\
${ password_hash_keylen }`;

                // Update the password
                sql.execute("UPDATE `users` SET `password` = ? WHERE id = ?",
                [database_password_string, user_id],
                (error: any) => {
                    if(error) {
                        Util.log(`Could not update user's password (user ${ user_id })`, 3, error);

                        reject(new Error("Could not update user's password"));
                    } else {
                        resolve(true);
                    }
                });
            }).catch(() => {
                reject(new Error("Could not update user's password"));
            });
        });
    });
}

export async function joinRoute(req: any, res: any): Promise<void> {
    // Get ip address of a client
    const ip_address: string = req.headers["x-forwarded-for"] || req.ip;

    // Check if ip is blocked from creating new accounts
    const ip_blocks = await getAddressBlocks(ip_address);

    if(Array.isArray(ip_blocks) && ip_blocks.includes("account_creation")) {
        const msg = (await SystemMessage.get(["login-join-message-ipblocked"]))["login-join-message-ipblocked"];

        res.status(403).send({ error: "ip_blocked", message: msg.value });
        return;
    }

    // Get a snapshot of the registry config to use later in the function
    const registry_config_snapshot = registry_config.get();

    // Check if client sent nothing
    if(!req.body) {
        res.status(403).send({ error: "no_body_recieved" });
        return;
    }

    const response_notes: string[] = [];

    // Check if captcha token was provided
    // if(!req.body.captcha_token) {
    //     res.status(403).send({ error: "captcha_error" });
    //     return;
    // }

    // Check username
    const username_status: UsernameAvailability = await checkUsername(req.body.username);

    switch(username_status) {
        case UsernameAvailability.InvalidFormat:
            res.status(403).send({ error: "username_format" });
            return;
        case UsernameAvailability.Forbidden:
            res.status(403).send({ error: "username_forbidden" });
            return;
        case UsernameAvailability.Taken:
            res.status(403).send({ error: "username_taken" });
            return;

        default:
    }

    // Check user-agent header
    if(!req.headers["user-agent"] || !req.headers["user-agent"].match(/^[A-Za-z0-9()\/\.,:; ]{1,512}$/)) {
        res.status(403).send({ error: "user_agent_format" });
        return;
    }

    // Check email
    if(!req.body.email.match(/^[A-Za-z0-9_@\.-]{6,128}$/)) {
        res.status(403).send({ error: "email_format" });
        return;
    }

    const password: string = decodeURI(req.body.password);

    // Check password
    if(password.length < 8 || password.length > 512) {
        res.status(403).send({ error: "password_format" });
        return;
    }

    // Check recaptcha
    request.get(
        `https://www.google.com/recaptcha/api/siteverify?secret=${
        process.env.EDE_DEV !== "1"
        ? registry_config_snapshot["auth.recaptcha_secret"].value as string
        : SECRETS.tokens.recaptcha_dev }&response=${ req.body.captcha_token }`,
        async (captcha_error: any, _: any, captcha_response: string): Promise<void> => {
            // Captcha check failed
            // TODO! CAPTCHA DISABLED!
            if(false && (captcha_error || !JSON.parse(captcha_response).success)) {
                res.status(403).send({ error: "captcha_error" });
                return;
            }

            // Create a new user
            let new_user: User;

            try {
                new_user = await create(
                    req.body.username,
                    password,
                    req.body.email
                );
            } catch (error) {
                res.status(403).send({ error: "create_account_error" });
                return;
            }

            // Create a new session
            await createSession(new_user.id, ip_address, req.headers["user-agent"])
            .then((user_session: UserSession) => {
                // Return a new session
                res.header("x-csrf-token", user_session.csrf_token);

                // TODO ADD SECURE AND SAMESITE!!!!!!
                res.setCookie("sid", user_session.cookie_sid, {
                    domain: registry_config_snapshot["instance.domain"].value as string,
                    path: "/",
                    httpOnly: true,
                    sameSite: true,
                    secure: false,
                    encode: String
                });

                res.setCookie("st", `${ new_user.id }:${ user_session.session_token }`, {
                    domain: registry_config_snapshot["instance.domain"].value as string,
                    path: "/",
                    httpOnly: false,
                    sameSite: true,
                    secure: false,
                    encode: String
                });

                res.send({ success: true, notes: response_notes });
                return;
            })
            .catch(() => {
                res.status(403).send({ error: "create_session_error" });
                return;
            });
        }
    );
}

export function loginRoute(req: any, res: any): void {
    // * Get client's IP address * //
    const ip_address: string = req.headers["x-forwarded-for"] || req.ip;

    const response_notes: string[] = [];

    // Body
    if(!req.body) {
        res.status(403).send({ error: "no_body_recieved" });
        return;
    }

    // TODO Captcha
    // if(!req.body.captcha_token) {
    //     res.status(403).send({ error: "captcha_error" });
    //     return;
    // }

    // Username and password
    if(!req.body.password || !req.body.username) {
        res.status(403).send({ error: "no_credentials" });
        return;
    }

    // Get a snapshot of the registry config to use later in the function
    const registry_config_snapshot = registry_config.get();

    const body_password: string = decodeURI(req.body.password);

    // Check captcha
    request.get(
        `https://www.google.com/recaptcha/api/siteverify?secret=${
        process.env.EDE_DEV !== "1"
        ? registry_config_snapshot["auth.recaptcha_secret"].value as string
        : SECRETS.tokens.recaptcha_dev }&response=${ req.body.captcha_token }`,
        (captcha_error: any, _: any, captcha_response: string): void => {

        // Captcha check failed
        // TODO! capcha disabled
        if(false && (captcha_error || !JSON.parse(captcha_response).success)) {
            res.status(403).send({ error: "captcha_error" });
            return;
        }

        // Get user
        sql.execute("SELECT id, `username`, `password`, `blocks` FROM `users` WHERE username = ?",
        [req.body.username],
        async (error: any, results: any) => {
            if(error || results.length !== 1) {
                const msg = (await SystemMessage.get(["login-message-invalidcredentials"]))["login-message-invalidcredentials"];

                res.status(403).send({ error: "invalid_credentials", message: msg.value });
                return;
            }

            // Check if user is blocked from logging in
            if(results[0].blocks) {
                const blocks = results[0].blocks.split(";");

                // User is locked out, get the appropriate system message
                if(blocks.includes("lockout")) {
                    const msg = (await SystemMessage.get(["login-message-blocked"]))["login-message-blocked"];

                    res.status(403).send({ error: "blocked", message: msg.value });
                    return;
                }
            }

            // Check password (preparation)
            const password_split: string = results[0].password.split(";");

            const db_password_hash = password_split[1];
            const db_password_salt = password_split[2];
            const db_password_iterations = parseInt(password_split[3], 10);
            const db_password_keylen = parseInt(password_split[4], 10);

            pbkdf2(
                body_password,
                db_password_salt,
                db_password_iterations,
                db_password_keylen
            )
            .then(async (password_hash: Hash) => {
                // Check if password is correct
                if(db_password_hash !== password_hash.key) {
                    const msg = (await SystemMessage.get(["login-message-invalidcredentials"]))["login-message-invalidcredentials"];

                    res.status(403).send({ error: "invalid_credentials", message: msg.value });
                    return;
                }

                // Check 2FA
                const f2a_otp = req.body.f2a_otp || "";
                const f2a_status = await F2A.check(results[0].id, f2a_otp);

                if(f2a_status.enabled) {
                    if(!f2a_otp) {
                        // No code provided
                        res.status(403).send({ error: "2fa_required" });
                        return;
                    }
                    if(!f2a_status.otp_correct) {
                        // Incorrect code provided
                        // TODO Notify user if they used an already used backup code
                        const msg = (await SystemMessage.get(["login-message-invalidf2aotp"]))["login-message-invalidf2aotp"];

                        res.status(403).send({ error: "invalid_f2a_otp", message: msg.value });
                        return;
                    }
                }

                // Create a session
                createSession(results[0].id, ip_address, req.headers["user-agent"])
                .then((user_session: UserSession) => {
                    // Return a new session
                    res.header("x-csrf-token", user_session.csrf_token);

                    // TODO ADD SECURE AND SAMESITE!!!!!!
                    res.setCookie("sid", user_session.cookie_sid, {
                        domain: registry_config_snapshot["instance.domain"].value as string,
                        path: "/",
                        httpOnly: true,
                        sameSite: true,
                        secure: false,
                        encode: String
                    });

                    res.setCookie("st", `${ results[0].id }:${ user_session.session_token }`, {
                        domain: registry_config_snapshot["instance.domain"].value as string,
                        path: "/",
                        httpOnly: false,
                        sameSite: true,
                        secure: false,
                        encode: String
                    });

                    response_notes.push("session_created");
                    res.send({ success: true, notes: response_notes });

                    return;
                })
                .catch(() => {
                    res.status(403).send({ error: "create_session_error" });
                    return;
                });
            })
            .catch(() => {
                res.status(403).send({ error: "other" });
                return;
            });
        });
    });
}

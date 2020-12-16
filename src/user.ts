import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import cookie from "cookie";

import { sql, _redis, _redis_ok } from "./server";
import * as Util from "./utils";

import { registry_config, registry_usernotification_types } from "./registry";
import { SECURITY_COOKIE_SID_SIZE, SECURITY_COOKIE_SALT_SIZE, SECURITY_CSRF_TOKEN_SIZE, SECURITY_SID_HASHING_ITERATIONS, SECURITY_SID_HASHING_KEYLEN } from "./constants";
import { GroupsObject, Group, GroupsAndRightsObject } from "./right";
import he from "he";

export interface User {
    id: number;

    username: string;

    email_address?: string;
    email_verified?: boolean;

    password_hash_hash: string;
    password_hash_salt: string;
    password_hash_iterations: number;
    password_hash_keylen: number;

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

export interface UserNotificationAction {
    text: string;
    type: string;

    href?: string;
    dynamic_href_key?: string;
}

export type UserNotificationTypesObject = { [type_name: string]: UserNotificationType };
export interface UserNotificationType {
    type_name: string;
    hidden?: boolean;

    // Included in the notification
    icon_class: string;
    title: string;
    actions: UserNotificationAction[];

    // For user settings page
    display_type_name: string;
    display_type_description: string;
    display_type_example_text: string;
}

export interface UserNotification {
    user_id: number;

    type: string;
    icon_class: string;
    title: string;
    actions: UserNotificationAction[];

    text: string;
    additional_text?: string;

    additional_info: any;

    timestamp: number;
    is_read: boolean;
}

export enum UsernameAvailability {
    Available,
    Taken,
    InvalidFormat,
    Forbidden
}

/**
 * Check if username is valid and not already taken
 *
 * @param username username
 */
export async function checkUsername(username: string): Promise<UsernameAvailability> {
    return new Promise((resolve: any) => {
        if(
            !username ||
            !username.match(/^[A-Za-z0-9_]{2,32}$/) ||  // Chcek for the correct format
            !/[A-Za-z_]/.test(username.charAt(0))       // Ensure that the first char is a letter or an underscore
        ) {
            resolve(UsernameAvailability.InvalidFormat);
            return;
        }

        const forbidden_usernames: string[] = [
            "admin",
            "administrator",
            "moderator",
            "hostmaster",
            "webmaster",
            "root",
            "sysadmin",
            "ede",
            "wiki"
        ];

        // Check for forbidden usernames
        // TODO make this list modifiable from EDE Config page
        if(forbidden_usernames.indexOf(username) > -1) {
            resolve(UsernameAvailability.Forbidden);
            return;
        }

        // Check if such username is already taken

        // TODO probably wont work because of toLowerCase(). Maybe we should have username and display_username in the database?
        // Currently, our database is set up in the way that makes the username field *not* case-sensitive, so this should work for now
        sql.execute(`SELECT id FROM \`users\` WHERE username = ? LIMIT 1`,
        [username.toLowerCase()],
        (error: any, results: any) => {
            if(error || results.length !== 0) resolve(UsernameAvailability.Taken);
            else resolve(UsernameAvailability.Available);
        });
    });
}

/**
 * Get user's notifications
 *
 * @param user_id user's id
 * @param records_number number of records to recieve
 * @param from starting id
 * @param encode encode the additional_text?
 */
export async function getNotifications(user_id: number, records_number: number = 100, from?: number, encode: boolean = true): Promise<UserNotification[]> {
    return new Promise((resolve: any) => {
        let sql_query = "SELECT * FROM `user_notifications` WHERE `user` = ? ORDER BY id DESC LIMIT ?";
        let sql_args: any[] = [user_id, records_number];

        // Starting id provided
        if(from) {
            sql_query += ", ?";
            sql_args = [user_id, from, records_number];
        }

        // Get the notifications
        sql.execute(sql_query, sql_args, (error: any, results: any) => {
            if(error) {
                Util.log(`Could not get notifications for a user`, 3, error, { sql_query, sql_args });

                resolve([]);
            } else {
                const registry_snapshot = registry_usernotification_types.get();
                const final_results: UserNotification[] = [];

                for(const notification of results) {
                    final_results.push({
                        ...notification,

                        // Inherit from notification type
                        title: registry_snapshot[notification.type].title,
                        icon_class: registry_snapshot[notification.type].icon_class,
                        type_name: registry_snapshot[notification.type].type_name,
                        actions: registry_snapshot[notification.type].actions,

                        additional_text: (notification.additional_text && encode) ? he.encode(notification.additional_text) : notification.additional_text,

                        is_read: notification.is_read.readInt8(0) === 1
                    });
                }

                resolve(final_results);
            }
        });
    });
}

/**
 * Send a notification to a user
 *
 * @param user_id user's id
 * @param type type of notification (from registry)
 * @param text full text of the notification
 * @param additional_text additional text for the notification (like a user-provided summary)
 * @param additional_info additional info for the notification (can contain dynamic hrefs)
 */
export async function sendNotificaion(user_id: number, type: string, text: string, additional_text?: string, additional_info?: any): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        if(additional_info) additional_info = JSON.stringify(additional_info);
        else additional_info = "{}";

        sql.execute("INSERT INTO `user_notifications` (user, type, text, additional_text, additional_info, timestamp) \
VALUES (?, ?, ?, ?, ?, UNIX_TIMESTAMP())",
        [user_id, type, text, additional_text || null, additional_info],
        (error: any) => {
            if(error) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not send a user notification"));
                Util.log(`Could not create a new user notification`, 3, error, { user_id, type, text, additional_text, additional_info });
            } else {
                resolve();
            }
        });
    });
}

/**
 * Mark user's notification as read
 *
 * @param user_id user's id
 * @param notification_id notification's id
 */
export async function markNotificationRead(user_id: number, notification_id: number): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("UPDATE `user_notifications` SET `is_read` = b'1' WHERE id = ? AND `user` = ?",
        [notification_id, user_id],
        (error: any) => {
            if(error) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not mark notification as read"));
                Util.log(`Could not mark a user notification as read`, 3, error, { notification_id, user_id });
            } else {
                resolve();
            }
        });
    });
}

/**
 * Check if user has unread notifications
 *
 * @param user_id user's id
 */
export async function hasUnreadNotifications(user_id: number): Promise<boolean> {
    return new Promise((resolve: any) => {
        sql.execute("SELECT id from `user_notifications` WHERE `user` = ? AND `is_read` = b'0' ORDER BY id DESC LIMIT 1",
        [user_id],
        (error: any, results: any) => {
            if(error) {
                Util.log(`Could not check if user has unread notifications`, 3, error, { user_id });
                resolve(false)
            } else {
                resolve(results.length !== 0);
            }
        });
    });
}

/**
 * Get all user groups and assigned to them rights from the database
 *
 * @category Registry updater
 */
export async function getAllUserGroups(): Promise<any> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("SELECT `name`, `added_rights`, `right_arguments` FROM `user_groups`", (error: any, results: any) => {
            if(error || results.length < 1) {
                Util.log("Could not get all available user groups from the database", 4, error);

                process.exit(1);
            } else {
                const result_object: GroupsObject = {};

                for(const group of results) {
                    let added_rights = [];

                    // TODO @cleanup replace delimiter with `|`
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
 * Save user group to the database (does not update the registry container)
 *
 * @param user_group new user group object
 */
export async function saveUserGroup(user_group: Group): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("UPDATE `user_groups` SET `added_rights` = ?, `right_arguments` = ? WHERE `name` = ?",
        [user_group.added_rights.join(";"), JSON.stringify(user_group.right_arguments), user_group.name],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not save user group to the database"));

                Util.log(`Could not save a user group to the database`, 3, error, { user_group });
            } else {
                resolve();
            }
        });
    });
}

/**
 * Create a new user group (without rights)
 *
 * @param name internal name of the new user group
 */
export async function createUserGroup(name: string): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        // Check if the name is correct
        if(!name.match(/^[a-z_-]{1,127}$/)) {
            reject(new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "Group name is invalid"));
            return;
        }

        sql.execute("INSERT INTO `user_groups` (`name`,`added_rights`,`right_arguments`) VALUES (?, '', '{}')",
        [name],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not create a new user group"));

                Util.log(`Could not create a new user group`, 3, error, { name });
            } else {
                resolve();
            }
        });
    });
}

/**
 * Delete user group (no checks to see if the deletion of this group is disabled from the EDE config)
 *
 * @param name Internal name of the group to be deleted
 */
export async function deleteUserGroup(name: string): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("DELETE FROM `user_groups` WHERE `name` = ?",
        [name],
        (error: any) => {
            if(error) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not delete user group"));

                Util.log(`Could not delete a user group`, 3, error, { name });
            } else {
                resolve();
            }
        });
    });
}

// TODO @performance
// TODO I have an idea on how to make this a lot faster in the todo.todo file --max
/**
 * Get *all* groups and rights assigned to a user. With arguments
 *
 * @param user_id user's id
 */
export async function getRights(user_id: number): Promise<GroupsAndRightsObject> {
    return new Promise((resolve: any, reject: any) => {
        const result: GroupsAndRightsObject = {
            groups: [],
            rights: {}
        };

        // An array to keep track of rights we have already encountered
        const rights_arr: string[] = [];

        // Get every group name the requested user is in
        sql.execute("SELECT `group` FROM `user_group_membership` WHERE `user` = ?",
        [user_id],
        (group_error: any, group_results: any) => {
            if(group_error) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not a list of user's groups"));
                Util.log(`Could not get a list of all user's groups`, 3, group_error, { user_id });

                return;
            } else {
                // We have a list of user's groups

                // Save the groups to the result object
                for(const group of group_results) {
                    result.groups.push(group.group);
                }

                // Get every right for every group the user is in
                sql.query(`SELECT \`added_rights\`, \`right_arguments\` FROM \`user_groups\` WHERE \`name\` IN ('${ result.groups.join("','") }')`,
                (right_error: any, right_results: any) => {
                    if(right_error) {
                        reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not get rights assigned to a user group(s)"));
                        Util.log(`Could not get all rights assigned to a user group(s)`, 3, right_error, { query: result.groups.join("','") });

                        return;
                    } else {
                        // We have all rights assigned to user's groups

                        // Go through all the groups
                        for(const group of right_results) {
                            let added_rights = [];

                            // Get the rights assigned to this group
                            if(group.added_rights) {
                                added_rights = group.added_rights.split(";");
                            }

                            // Go through all rights assigned to this group
                            for(const right_name of added_rights) {
                                // Check if client already has this right from a group we checked earlier
                                if(rights_arr.includes(right_name)) {
                                    // This right was provided from an earlier group, we have to merge the existing arguments for this
                                    // right that were provided by an earlier group with the new ones, provided by this group

                                    // Go through all the new arguments
                                    for(const argument_name in group.right_arguments[right_name]) {
                                        // Check if argument is not just {}
                                        // If it is, we do not have to merge anything

                                        if( group.right_arguments[right_name][argument_name] &&
                                            group.right_arguments[right_name][argument_name] !== {}
                                        ) {
                                            // Get the name of the argument that we are working with
                                            const argument_value = group.right_arguments[right_name][argument_name];

                                            // Merge this argument
                                            if(argument_value instanceof Boolean) {
                                                // Argument is of boolean type
                                                // If the argument is already set to false in some other group, but is is set to true in
                                                // this one, set the final value to true

                                                // If the argument is already true, we don't do anything

                                                if(argument_value === true) {
                                                    result.rights[right_name][argument_name] = true;
                                                }
                                            } else if(argument_value instanceof Array) {
                                                // Argument is of array type

                                                // If this argument is not already present in the results object, we can just set it to
                                                // this argument to save time and not iterate over every array item, because we know
                                                // that we just have to append everything as the current array is currently empty
                                                if(result.rights[right_name][argument_name] === undefined) {
                                                    result.rights[right_name][argument_name] = argument_value;
                                                } else {
                                                    // This argument is already present in the results object, so we have to add the
                                                    // new array items that are not already present

                                                    for(const array_item of argument_value) {
                                                        // We push array items only if they are not already included

                                                        if(result.rights[right_name][argument_name].indexOf(array_item) < 0) {
                                                            result.rights[right_name][argument_name].push(array_item)
                                                        }
                                                    }
                                                }
                                            } else if(argument_value instanceof Object) {
                                                // Argument is of object type, concat this object with the one that is already in
                                                // the rersults object

                                                result.rights[right_name][argument_name] = {
                                                    ...result.rights[right_name][argument_name],
                                                    ...argument_value
                                                };
                                            } else {
                                                // Argument is of any other type - just update the value of the argument
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

                        // Everything is ready
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
        sql.execute("SELECT * FROM `users` WHERE username = ? LIMIT 1",
        [username],
        (error: any, results: any) => {
            if(error || results.length !== 1) {
                reject(new Util.Rejection(Util.RejectionType.USER_NOT_FOUND, "Could not find a user with such username"));
                return;
            }

            const db_user = results[0];
            const user_password = db_user.password.split(";");

            let user_blocks = [];
            if(db_user.blocks) user_blocks = db_user.blocks.split(";");

            // Return the user
            const user: User = {
                id: db_user.id,

                username: db_user.username,
                email_address: db_user.email_address,
                email_verified: db_user.email_verified.readInt8(0) === 1,

                password_hash_hash: user_password[1],
                password_hash_salt: user_password[2],
                password_hash_iterations: parseInt(user_password[3], 10),
                password_hash_keylen: parseInt(user_password[4], 10),

                stats: db_user.stats,
                blocks: user_blocks
            };

            resolve(user);
        });
    });
}

/**
 * Get user by id
 *
 * @param user_id id
 */
export async function getById(user_id: number): Promise<User> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("SELECT * FROM `users` WHERE id = ?",
        [user_id],
        (error: any, results: any) => {
            if(error || results.length !== 1) {
                reject(new Util.Rejection(Util.RejectionType.USER_NOT_FOUND, "Could not find a user with such id"));
                return;
            }

            const db_user = results[0];
            const user_password = db_user.password.split(";");

            let user_blocks = [];
            if(db_user.blocks) user_blocks = db_user.blocks.split(";");

            // Return the user
            const user: User = {
                id: db_user.id,

                username: db_user.username,
                email_address: db_user.email_address,
                email_verified: db_user.email_verified.readInt8(0) === 1,

                password_hash_hash: user_password[1],
                password_hash_salt: user_password[2],
                password_hash_iterations: parseInt(user_password[3], 10),
                password_hash_keylen: parseInt(user_password[4], 10),

                stats: db_user.stats,
                blocks: user_blocks
            };

            resolve(user);
        });
    });
}

/**
 * Get a user by their session
 *
 * @param http_request http request object
 */
export async function getFromSession(http_request: any): Promise<User> {
    return new Promise(async (resolve: any, reject: any) => {
        // Check if headers were provided
        if(!http_request.headers) {
            reject(new Util.Rejection(Util.RejectionType.USER_SESSION_INVALID, "Could not read user's session data"));
            return;
        }

        // Check if cookies were provided
        if(!http_request.headers.cookie) {
            reject(new Util.Rejection(Util.RejectionType.USER_SESSION_INVALID, "Could not read user's session cookies"));
            return;
        }

        // Parse the cookies
        const cookies: any = cookie.parse(http_request.headers.cookie);

        // Check if required cookis were provided
        if(!cookies.st || !cookies.sid) {
            reject(new Util.Rejection(Util.RejectionType.USER_SESSION_INVALID, "No user session cookies provided"));
            return;
        }

        // Get the current timestamp
        const now = Math.floor(new Date().getTime() / 1000);

        // Extract user's id and session token from the `st` cookie
        const st_split: string[] = cookies.st.split(":");

        const st_uid = parseInt(st_split[0], 10);
        const st_st: string = st_split[1];

        // Get and validate the session
        sql.execute("CALL `user_get_with_session`(?, ?)",
        [st_uid, st_st],
        async (error: any, results: any) => {
            if(error || results[0].length !== 1) {
                reject(new Util.Rejection(Util.RejectionType.USER_SESSION_INVALID, "Invalid user session"));
                return;
            }

            const db_response = results[0][0];

            // Check if session expired
            if(db_response.session_expires_on < now) {
                reject(new Util.Rejection(Util.RejectionType.USER_SESSION_INVALID, "User session expired"));
                return;
            }

            /*
                We store a hashed sid in the database for additinal security, but it makes getting users by their session slower, as
                we have to hash it every single time.

                However, if the option is enabled in the EDE Config, caching the cleartext user's sid is possible, which makes this
                function a bit faster.
            */

            const registry_config_snapshot = registry_config.get();

            let sid_correct = false;
            let correct_cookie_sid_from_cache: string | false = false;

            // Check if user's sid is cached
            if(_redis_ok && registry_config_snapshot["caching.cacheusersids"].value as boolean === true) {
                correct_cookie_sid_from_cache = await new Promise((resolve_cache: any) => {
                    _redis.rawCall(["get", `user_sid|${ st_uid }`], (cache_error: any, result: any) => {
                        if(!cache_error && result) resolve_cache(result);
                        else resolve_cache(false);
                    });
                });
            }

            // Check if cached sid is correct
            if(correct_cookie_sid_from_cache !== false && correct_cookie_sid_from_cache === cookies.sid) sid_correct = true;

            // Hash sid provided by the user, if cached check failed
            if(!sid_correct) {
                const cookie_sid_hash = await Util.pbkdf2(cookies.sid, db_response.session_sid_salt,
                SECURITY_SID_HASHING_ITERATIONS, SECURITY_SID_HASHING_KEYLEN);

                // Check if hashes match
                if(cookie_sid_hash.key === db_response.session_sid_hash) sid_correct = true;
            }

            if(sid_correct) {
                // Sid is correct => user provided session is correct => return the user

                // Cache the cleartext seed (the one in the cookie)
                if(_redis_ok && registry_config_snapshot["caching.cacheusersids"].value as boolean === true) {
                    _redis.rawCall(["set", `user_sid|${ st_uid }`, cookies.sid, "EX", 3600], (cache_error: any) => {
                        if(cache_error) {
                            Util.log("Could not cache user's sid", 3, cache_error);
                        }
                    });
                }

                const user_password = db_response.user_password.split(";");

                let user_blocks = [];
                if(db_response.user_blocks) user_blocks = db_response.user_blocks.split(";");

                // Return the user
                const user: User = {
                    id: st_uid,

                    username: db_response.user_username,
                    email_address: db_response.user_email_address,
                    email_verified: db_response.user_email_verified.readInt8(0) === 1,

                    password_hash_hash: user_password[1],
                    password_hash_salt: user_password[2],
                    password_hash_iterations: parseInt(user_password[3], 10),
                    password_hash_keylen: parseInt(user_password[4], 10),

                    stats: db_response.user_stats,
                    blocks: user_blocks,

                    current_session: {
                        cookie_sid: cookies.sid,

                        session_token: st_st,

                        sid_hash: db_response.session_sid_hash,
                        sid_salt: db_response.session_sid_salt,

                        csrf_token: db_response.session_csrf_token,

                        ip_address: http_request.headers["x-forwarded-for"] || http_request.ip,
                        user_agent: http_request.headers["user-agent"],

                        created_on: db_response.session_created_on,
                        expires_on: db_response.session_expires_on
                    }
                };

                resolve(user);
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
 * Use this function only if you are sure the credentials are safe. No checks will be executed.
 *
 * @param username username
 * @param password clear-text password
 * @param email_address email address
 */
export async function create(username: string, password: string, email_address: string): Promise<User> {
    return new Promise(async (resolve: any, reject: any) => {
        // Create user stats object
        const user_stats: UserStats = {
            created_on: Math.floor(new Date().getTime() / 1000)
        }

        // Get a snapshot of the registry config to use later in the function
        const registry_config_snapshot = registry_config.get();

        // Generate the salt for the password
        crypto.randomBytes(registry_config_snapshot["auth.sid_size"].value as number, (_: any, password_salt_buffer: Buffer) => {
            const password_hash_salt: string = Util.sanitizeBuffer(password_salt_buffer);

            // Use the hashing config from the EDE Config
            const password_hash_iterations = registry_config_snapshot["auth.password_hash_iterations"].value as number;
            const password_hash_keylen = registry_config_snapshot["auth.password_hash_keylen"].value as number;

            // Hash the password
            Util.pbkdf2(password, password_hash_salt, password_hash_iterations, password_hash_keylen)
            .then((password_hash: Util.Hash) => {
                // Format the password hash and config string
                const database_password_string: string =
                `pbkdf2;${ password_hash.key };${ password_hash_salt };${ password_hash_iterations };\
${ password_hash_keylen }`;

                // Create a user
                sql.execute("INSERT INTO `users` (`username`, `email_address`, `password`, `stats`) VALUES (?, ?, ?, ?)",
                [username, email_address, database_password_string, JSON.stringify(user_stats)],
                (error: any, results: any) => {
                    if(error) {
                        reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not create a new user"));
                        Util.log(`Could not create a new user`, 3, error, { username, email_address, user_stats });
                    } else {
                        // User created successfully, return it

                        const user: User = {
                            id: results.insertId,

                            username,
                            email_address,
                            email_verified: false,

                            blocks: [],

                            password_hash_hash: password_hash.key,
                            password_hash_salt,
                            password_hash_iterations,
                            password_hash_keylen,

                            stats: user_stats
                        };

                        resolve(user);
                    }
                });
            })
            .catch((error: Error) => {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not create a new user"));
                Util.log(`Could not create a new user: hashing failed`, 3, error);
            });
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
export async function newUserTrackingRecord(user_id: number, ip_address: string, user_agent: string): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("INSERT INTO `user_tracking` (`user`, `ip_address`, `user_agent`, `timestamp`) VALUES (?, ?, ?, UNIX_TIMESTAMP())",
        [user_id, ip_address, user_agent],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN));
                Util.log(`Could not create a new user_tracking record`, 3, error, { user_id, ip_address, user_agent });

                return;
            } else {
                resolve();
            }
        });
    });
}

/**
 * Create a new user session
 *
 * @param user user's internal id (id column in the database)
 * @param ip_address client's ip address
 * @param user_agent client's useragent
 */
export async function createSession(user_id: number, ip_address: string, user_agent: string): Promise<UserSession> {
    return new Promise(async (resolve: any, reject: any) => {
        // Generate sid
        crypto.randomBytes(SECURITY_COOKIE_SID_SIZE, (_sid_error: any, sid_buffer: Buffer) => {
        // Generate sid salt
        crypto.randomBytes(SECURITY_COOKIE_SALT_SIZE, (_sid_salt_error: any, sid_salt_buffer: Buffer) => {
        // Generate csrf_token
        crypto.randomBytes(SECURITY_CSRF_TOKEN_SIZE, (_csrf_token_error: any, csrf_token_buffer: Buffer) => {
            // Get sid string that is safe for a cookie
            const cookie_sid: string = Util.sanitizeBuffer(sid_buffer);

            // Hash sid
            Util.pbkdf2(cookie_sid, sid_salt_buffer.toString("base64"), SECURITY_SID_HASHING_ITERATIONS,
            SECURITY_SID_HASHING_KEYLEN)
            .then((sidHash: Util.Hash) => {
                // Generate a random session token
                const session_token: string = uuidv4();

                // Make a safe csrf_token string
                const csrf_token: string = Util.sanitizeBuffer(csrf_token_buffer);

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
                    if(error) {
                        reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not create a new user session"));
                        Util.log(`Could not create a new user session`, 3, error, { user_id });
                    }

                    // Session successfully created, return it
                    resolve(session);
                });

                // Create a new user_tracking record. We don't have to await here
                newUserTrackingRecord(user_id, ip_address, user_agent)
                .catch(() => undefined);
            })
            .catch((error: Error) => {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not hash a sid"));
                Util.log(`Could not hash a sid`, 3, error);
            });
        });
        });
        });
    });
}

/**
 * Create an elevated session
 *
 * @param user_id user's id
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
            // Create a cookie-safe sid string
            const esid = Util.sanitizeBuffer(esid_buffer);

            // Create an elevated session
            sql.execute("INSERT INTO `elevated_user_sessions` (`user`, `esid`, `valid_until`) VALUES (?, ?, ?)",
            [user_id, esid, valid_until_unix],
            (error: any, results: any) => {
                if(error || results.length < 1) {
                    reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not create a new elevated session"));
                    Util.log(`Could not create a new elevated session`, 3, error, { user_id });
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
 * @param user_id user's id
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

        // Get the elevated session
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
 * @param user_id user's id
 * @param restrictions array of restrictions
 */
export async function updateUserBlocks(user_id: number, restrictions: string[]): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        const blocks_string = restrictions.length === 0
        ? ""
        : Util.sanitize(restrictions.join(";"));

        // Update the user
        sql.execute("UPDATE `users` SET `blocks` = ? WHERE id = ?",
        [blocks_string, user_id],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not update user's blocks"));
                Util.log(`Could not update blocks for a user`, 3, error, { user_id, blocks_string });
            } else {
                resolve();
            }
        });
    });
}

/**
 * Block an ip address
 *
 * This function will not append new restrictions, it will instead replace them with new ones
 *
 * @param address address to block
 * @param restrictions array of restrictions
 */
export async function blockAddress(address: string, restrictions: string[]): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        if(!address) {
            reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Invalid address"));
            return;
        }

        const blocks_string = restrictions.length === 0
        ? ""
        : Util.sanitize(restrictions.join(";"));

        // Add a record to the database
        sql.execute("INSERT INTO `blocked_addresses` (`address`, `restrictions`) VALUES (?, ?) AS new ON DUPLICATE KEY UPDATE `restrictions` = new.restrictions",
        [address, blocks_string],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not change block settings for an ip-address"));
                Util.log(`Could not change block settings for an address`, 3, error, { address, blocks_string });
            } else {
                resolve();
            }
        });
    });
}

/**
 * Get blocks for an ip-address
 *
 * @param address address to query
 */
export async function getAddressBlocks(address: string): Promise<string[]> {
    // TODO this will not work for ranges or CIDR addresses (like 124.173.1.0/24)
    return new Promise((resolve: any, reject: any) => {
        sql.execute("SELECT `restrictions` FROM `blocked_addresses` WHERE `address` = ?",
        [address],
        (error: any, results: any) => {
            if(error) {
                // Could not get address blocks

                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not get block setting for an ip-address"));
                Util.log(`Could not get block setting for an address`, 3, error, { address });
            } else if(results.length !== 1) {
                // The address is not blocked in any way

                resolve([]);
            } else {
                // The address is blocked

                const raw_restrictions = results[0].restrictions;
                let final_restrictions: string[] = [];

                if(raw_restrictions) final_restrictions = raw_restrictions.split(";");

                resolve(final_restrictions);
            }
        });
    });
}

/**
 * Destroy all user's sessions
 *
 * @param user_id user's id
 */
export async function destroyUserSessions(user_id: number): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("UPDATE `user_sessions` SET `expires_on` = 1 WHERE `user` = ?",
        [user_id],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not destroy user's sessions"));
                Util.log(`Could not destroy sessions for a user`, 3, error, { user_id });
            } else {
                resolve();
            }
        });
    });
}

/**
 * Invalidate a particular user session
 *
 * @param user_id user's id
 * @param session_token token of a session to invalidate
 */
export async function invalidateUserSession(user_id: number, session_token: string): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("UPDATE `user_sessions` SET `expires_on` = 1 WHERE `user` = ? AND `session_token` = ?",
        [user_id, session_token],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not invalidate user's session"));
                Util.log(`Could not invalidate user's session`, 3, error, { user_id, session_token });
            } else {
                resolve();
            }
        });
    });
}

/**
 * Create an email verification token and add it to the database, invalidating all other email verification tokens of same type for that
 * user
 *
 * @param user_id user's id
 * @param token_type type of the token to generate
 * @param sent_to to what address will the email be sent?
 * @param token_len lenght of the new token (in bytes)
 *
 * @returns new token
 */
export async function createEmailToken(user_id: number, token_type: string, sent_to: string, token_len: number = 128): Promise<string> {
    return new Promise((resolve: any, reject: any) => {
        // Generate a token
        crypto.randomBytes(token_len, async (_: any, token_buffer: Buffer) => {
            // Create a safe token string
            const token: string = Util.sanitizeBuffer(token_buffer);

            // Delete tokens of the same type and user
            await sql.promise().execute("DELETE FROM `email_tokens` WHERE `user` = ? AND `type` = ?",
            [user_id, token_type]);

            // Insert the new token
            sql.execute('INSERT INTO `email_tokens` (`token`, `user`, `type`, `sent_to`, `valid_until`) VALUES (?, ?, ?, ?, UNIX_TIMESTAMP() + 7200)',
            [token, user_id, token_type, sent_to],
            (error: any, results: any) => {
                if(error || results.affectedRows < 1) {
                    reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not create a new email token"));
                    Util.log(`Could not create and save a new email token`, 3, error, { user_id });
                } else {
                    resolve(token);
                }
            });
        });
    });
}

/**
 * Check user's email verification token
 *
 * @param user_id user's id
 * @param token token
 * @param token_type type of the token
 * @param delete_token delete the token from the database after the successfull check (true by default)
 *
 * @returns [is_valid, sent_to] (sent_to is an empty string if the token is invalid)
 */
export async function checkEmailToken(user_id: number, token: string, token_type: string, delete_token: boolean = true):
Promise<[boolean, string]> {
    return new Promise((resolve: any) => {
        sql.execute("SELECT `valid_until`, `type`, `sent_to` FROM `email_tokens` WHERE `token` = ? AND `user` = ?",
        [token, user_id],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                // Such token was not found
                resolve([false, ""]);
            } else {
                // Check if the token expired
                if(results[0].valid_until < Math.floor(new Date().getTime() / 1000)) {
                    resolve([false, ""]);
                    return;
                }

                // Check if token type is correct
                if(results[0].type !== token_type) {
                    resolve([false, ""]);
                    return;
                }

                // Token is correct, return the sent_to address
                resolve([true, results[0].sent_to]);

                if(delete_token) {
                    // Delete the token from the database. No need to await here
                    sql.promise().execute("DELETE FROM `email_tokens` WHERE `token` = ? AND `user` = ?", [token, user_id])
                    .catch((delete_error: Error) => {
                        Util.log("Could not delete an email token from the database", 3, delete_error, { user_id });
                    });
                }
            }
        });
    });
}

/**
 * Update user's password
 *
 * @param user_id user's id
 * @param password new password in clear text
 */
export async function updateUserPassword(user_id: number, password: string): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        // Get a snapshot of the registry config to use later in the function
        const registry_config_snapshot = registry_config.get();

        // Generate the salt for the new password
        // TODO @placeholder we should use something like auth.password_salt size instead of hardcoded 512
        crypto.randomBytes(512, (_: any, password_salt_buffer: Buffer) => {
            const password_hash_salt: string = password_salt_buffer.toString("base64");

            // Get the hashing config from the EDE config
            const password_hash_iterations = registry_config_snapshot["auth.password_hash_iterations"].value as number;
            const password_hash_keylen = registry_config_snapshot["auth.password_hash_keylen"].value as number;

            // Hash the password
            Util.pbkdf2(password, password_hash_salt, password_hash_iterations, password_hash_keylen)
            .then((password_hash: Util.Hash) => {
                // Create a formatted password string with hashing configuration
                const database_password_string: string =
                `pbkdf2;${ password_hash.key };${ password_hash_salt };${ password_hash_iterations };\
${ password_hash_keylen }`;

                // Update the password
                sql.execute("UPDATE `users` SET `password` = ? WHERE id = ?",
                [database_password_string, user_id],
                (error: any) => {
                    if(error) {
                        reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not update user's password"));
                        Util.log(`Could not update user's password`, 3, error, { user_id });
                    } else {
                        resolve();
                    }
                });
            }).catch((error: Error) => {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not update user's password"));
                Util.log(`Could not update user's password: hashing error`, 3, error, { user_id });
            });
        });
    });
}

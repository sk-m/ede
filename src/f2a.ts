import { sql } from "./server";
import * as Util from "./utils";

// tslint:disable-next-line: no-var-requires
const tfa = require("2fa");

interface CheckResult {
    enabled: boolean;
    otp_correct: boolean;
    is_backup_code: boolean;

    message?: string;
}

/**
 * Check if the user has f2a enabled and (if provided) one time password is valid
 *
 * @param user_id User's id
 * @param otp User's one-time password or backup code
 */
export async function check(user_id: number, otp?: string): Promise<CheckResult> {
    // TODO @cleanup
    return new Promise((resolve: any) => {
        // Get all the info about user's f2a we need
        sql.execute("SELECT `setup_mode`, `secret_key`, `backup_codes` FROM `2fa_data` WHERE `user` = ?",
        [user_id],
        (query_error: any, results: any) => {
            if(query_error || results.length !== 1 || results[0].setup_mode.readInt8(0) === 1) {
                // F2A is not enabled at all (or in setup mode)
                resolve({
                    enabled: false,
                    otp_correct: false,
                    is_backup_code: false
                });

                return;
            }

            // f2a is enabled
            if(otp) {
                // check if otp is valid
                const is_correct = tfa.verifyTOTP(results[0].secret_key, otp, {});

                if(!is_correct) {
                    const backup_codes = results[0].backup_codes;

                    // Check backup codes
                    if(Object.keys(backup_codes).includes(otp)) {
                        // User used a valid backup code, check if it is unused
                        if(backup_codes[otp].used) {
                            // The code was used
                            resolve({
                                enabled: true,
                                otp_correct: false,
                                is_backup_code: true,
                                message: "This backup code was already used"
                            });

                            return;
                        } else {
                            // The backup code is valid, but now it's used, so we need to update the database
                            resolve({
                                enabled: true,
                                otp_correct: true,
                                is_backup_code: true
                            });

                            // Set the code to used
                            backup_codes[otp].used = true;

                            sql.execute("UPDATE `2fa_data` SET `backup_codes` = ? WHERE `user` = ?",
                            [JSON.stringify(backup_codes), user_id],
                            (save_error: any, save_results: any) => {
                                if(save_error || save_results.affectedRows !== 1) {
                                    Util.log(`Could not update backup code's state to used (user id ${ user_id })`, 3, save_error);
                                }
                            });
                        }
                    } else {
                        // Invalid one-time password
                        resolve({
                            enabled: true,
                            otp_correct: false,
                            is_backup_code: false
                        });
                    }
                } else {
                    // One time password is correct
                    resolve({
                        enabled: true,
                        otp_correct: true,
                        is_backup_code: false
                    });
                }
            } else {
                // no otp checks
                resolve({
                    enabled: true,
                    otp_correct: false,
                    is_backup_code: false
                })
            }
        });
    });
}

/**
 * Disable 2fa for a user
 *
 * @param user_id User's id
 */
export async function disable(user_id: number): Promise<true> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("DELETE FROM `2fa_data` WHERE `user` = ?",
        [user_id],
        (error: any, results: any) => {
            if(error || results.affectedRows !== 1) {
                reject(new Error("User does not have 2FA enabled"));
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Start 2fa setup for a user
 *
 * @param user_id User's id
 *
 * @returns secret key
 */
export async function startSetup(user_id: number): Promise<string> {
    return new Promise(async (resolve: any, reject: any) => {
        // Check if 2fa is already enabled
        const current_f2a_status = await check(user_id);

        if(current_f2a_status.enabled) {
            reject(new Error("2FA is already enabled on this account"));
            return;
        }

        // Generate a secret key
        tfa.generateKey(64, (key_error: any, secret_key: string) => {
            if(key_error) {
                Util.log(`Could not start 2FA setup for user id ${ user_id }`, 3, key_error);
                reject(new Error("Could not start 2FA setup"));

                return;
            }

            // We have a new secret key, generate backup codes
            tfa.generateBackupCodes(8, 'xxxx-xxxx-xxxx', (backup_codes_error: any, backup_codes_arr: string[]) => {
                if(backup_codes_error) {
                    Util.log(`Could not start 2FA setup for user id ${ user_id }`, 3, backup_codes_error);
                    reject(new Error("Could not start 2FA setup"));

                    return;
                }

                // Format backup codes
                const backup_codes_obj: { [code: string]: any } = {};

                for(const code of backup_codes_arr) {
                    backup_codes_obj[code] = {
                        used: false
                    }
                }

                // We have everything we need, save the data to the database
                sql.execute("INSERT INTO `2fa_data` (`user`, `secret_key`, `backup_codes`, `enabled_on`, `setup_mode`) VALUES \
(?, ?, ?, NULL, b'1') AS new ON DUPLICATE KEY UPDATE secret_key = new.secret_key, backup_codes = new.backup_codes",
                [user_id, secret_key, JSON.stringify(backup_codes_obj)],
                (error: any, results: any) => {
                    if(error || results.affectedRows !== 1) {
                        Util.log(`Could not start 2FA setup for user id ${ user_id }`, 3, backup_codes_error);
                        reject(new Error("Could not start 2FA setup"));
                    } else {
                        resolve(secret_key);
                    }
                });
            });
        });
    });
}

/**
 * Finish user's 2fa setup
 *
 * @param user_id User's id
 * @param otp generated 6-digit code
 *
 * @returns {any} backup codes object
 */
export async function finishSetup(user_id: number, otp: number): Promise<any> {
    return new Promise((resolve: any, reject: any) => {
        // Get user's secret code and check if it's in setup mode
        sql.execute("SELECT `secret_key`, `setup_mode`, `backup_codes` FROM `2fa_data` WHERE `user` = ?",
        [user_id],
        (query_error: any, results: any) => {
            if(query_error || results.length !== 1) {
                Util.log(`Could not finish the 2FA setup for user id ${ user_id }`, 3, query_error);
                reject(new Error("Could not finish user's 2FA setup"));

                return;
            }

            if(results[0].setup_mode.readInt8(0) === 0) {
                reject(new Error("User's 2FA is already enabled"));

                return;
            }

            // Check otp
            const is_correct = tfa.verifyTOTP(results[0].secret_key, otp, {});

            if(!is_correct) {
                reject(new Error("Incorrect one-time password"));
            } else {
                // Everything is correct, enable f2a
                sql.execute("UPDATE `2fa_data` SET `enabled_on` = UNIX_TIMESTAMP(), `setup_mode` = b'0' WHERE `user` = ?",
                [user_id],
                (enable_error: any, enable_results: any) => {
                    if(enable_error || enable_results.affectedRows !== 1) {
                        Util.log(`Could not enable 2FA for user id ${ user_id }`, 3, query_error);
                        reject(new Error("Could not enable 2FA"));
                    } else {
                        resolve(results[0].backup_codes);
                    }
                });
            }
        });
    });
}

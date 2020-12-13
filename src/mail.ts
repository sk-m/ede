import { registry_config } from "./registry";
import { _mailer, _mailer_ok } from "./server";

import * as User from "./user";
import * as Util from "./utils";

/**
 * Check if outbound email is enabled
 */
export function checkEnabled(): boolean {
    const registry_config_snapshot = registry_config.get();

    return _mailer_ok && (registry_config_snapshot["mail.enabled"].value as boolean === true)
}

/**
 * Send an email to any address(es)
 *
 * @param addresses address or an array of addresses
 * @param subject Email subject
 * @param html_body Email HTML body
 */
export async function send(addresses: string | string[], subject: string, html_body: string): Promise<true> {
    return new Promise((resolve: any, reject: any) => {
        const registry_config_snapshot = registry_config.get();

        if(!checkEnabled()) {
            reject(new Error("Outbound email is disabled"));
            return;
        } else {
            resolve(true);
        }

        const from_address = registry_config_snapshot["mail.user"].value as string;
        const instance_name = registry_config_snapshot["instance.display_name"].value as string;

        _mailer.sendMail({
            from: `${ instance_name } <${ from_address }>`,
            sender: from_address,

            to: addresses,

            subject,
            html: html_body,

            disableFileAccess: true,
            disableUrlAccess: true
        })
        .then((info: any) => {
            // Check if email was sent successfully
            if(info.rejected.length !== 0) {
                Util.log(`Email was rejected (tried to send to ${ addresses })`, 2);
            }
        })
        .catch((error: Error) => {
            Util.log(`Could not send an email to ${ addresses })`, 3, error);
        });
    });
}

/**
 * Send en email to a user
 *
 * @param user Recipient user (User object or just a username)
 * @param subject Email subject
 * @param html_body Email HTML body
 * @param ignore_if_unverified If true, will send an email even if recepient does not have their email verified
 */
export async function sendToUser(user: User.User | string, subject: string, html_body: string, ignore_if_unverified: boolean = false): Promise<true> {
    return new Promise(async (resolve: any, reject: any) => {
        // Get the user, if username provided
        if(typeof user === "string") {
            // TODO @performance maybe just get the email address and verification status by sql.query?
            user = await User.getFromUsername(user);
        }

        // Check user
        if(!user || !user.email_address) {
            reject(new Error("Invalid user, or email address not provided"));
            return;
        }

        // Check if email address is verified
        if(!user.email_verified && !ignore_if_unverified) {
            reject(new Error("User's email address is not verfied"));
            return;
        }

        // Send mail
        send(user.email_address, subject, html_body)
        .then(() => { resolve(true) })
        .catch((e: Error) => { reject(e) });
    });
}
import * as User from "../../user";
import * as SystemMessage from "../../system_message";
import * as Mail from "../../mail";
import * as MailTemplates from "../../mail_templates";
import { registry_config } from "../../registry";
import * as NotificationTemplates from "../../notification_templates";
import * as SECRETS from "../../../secrets.json";

import request from "request";

export async function userJoinRoute(req: any, res: any): Promise<void> {
    // Get client's ip address
    const ip_address: string = req.headers["x-forwarded-for"] || req.ip;

    // Check if ip is blocked from creating new accounts
    const ip_blocks = await User.getAddressBlocks(ip_address);

    // ip address is blocked from creating new accounts
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
    const username_status: User.UsernameAvailability = await User.checkUsername(req.body.username);

    switch(username_status) {
        case User.UsernameAvailability.InvalidFormat:
            res.status(403).send({ error: "username_format" });
            return;
        case User.UsernameAvailability.Forbidden:
            res.status(403).send({ error: "username_forbidden" });
            return;
        case User.UsernameAvailability.Taken:
            res.status(403).send({ error: "username_taken" });
            return;
    }

    // Check user-agent header
    if(!req.headers["user-agent"] || !req.headers["user-agent"].match(/^[A-Za-z0-9()\/\.,:; ]{1,512}$/)) {
        res.status(403).send({ error: "user_agent_format" });
        return;
    }

    // Check email
    // TODO regex
    if(!req.body.email.match(/^[A-Za-z0-9_@\.-]{6,128}$/)) {
        res.status(403).send({ error: "email_format" });
        return;
    }

    // Get the clear text password
    const password: string = decodeURI(req.body.password);

    // Check password format
    if(password.length < 8 || password.length > 512) {
        res.status(403).send({ error: "password_format" });
        return;
    }

    // Get recaptcha secret
    const recaptcha_secret = process.env.EDE_DEV !== "1"
        ? registry_config_snapshot["auth.recaptcha_secret"].value as string
        : SECRETS.tokens.recaptcha_dev;

    // Check recaptcha
    request.get(
        `https://www.google.com/recaptcha/api/siteverify?secret=${ recaptcha_secret }&response=${ req.body.captcha_token }`,
        async (captcha_error: any, _: any, captcha_response: string): Promise<void> => {
            // Captcha check failed
            // TODO! CAPTCHA DISABLED!
            if(false && (captcha_error || !JSON.parse(captcha_response).success)) {
                res.status(403).send({ error: "captcha_error" });
                return;
            }

            // Create a new user
            let user_error = false;

            const new_user = await User.create(
                req.body.username,
                password,
                req.body.email
            )
            .catch(() => {
                user_error = true;
            });

            if(user_error || !new_user) {
                res.status(403).send({ error: "create_user_error" });
                return;
            }

            // Create an email verification token
            const email_verification_token = await User.createEmailToken(new_user.id, "email_verification", req.body.email);

            // Send email verification email (no need to await or check for errors)
            Mail.sendToUser(new_user,
                "Email verification",
                MailTemplates.email_verification(email_verification_token),
                true)
            .catch(() => undefined);

            // Send a notification
            User.sendNotificaion(
                new_user.id,
                "accountcreated",
                NotificationTemplates.accountcreated()
            );

            // Create a new session
            await User.createSession(new_user.id, ip_address, req.headers["user-agent"])
            .then((user_session: User.UserSession) => {
                // Session created successfully

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

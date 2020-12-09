import * as SystemMessage from "../../system_message";
import * as Util from "../../utils";
import * as User from "../../user";
import * as F2A from "../../f2a";
import * as SECRETS from "../../../secrets.json";

import request from "request";
import { registry_config } from "../../registry";

export function userLoginRoute(req: any, res: any): void {
    // Get client's IP address
    const ip_address: string = req.headers["x-forwarded-for"] || req.ip;

    const response_notes: string[] = [];

    // Check if no body was provided
    if(!req.body) {
        res.status(403).send({ error: "no_body_recieved" });
        return;
    }

    // TODO Captcha
    // if(!req.body.captcha_token) {
    //     res.status(403).send({ error: "captcha_error" });
    //     return;
    // }

    // Check if userrname and password was provided
    if(!req.body.password || !req.body.username) {
        res.status(403).send({ error: "no_credentials" });
        return;
    }

    // Get a snapshot of the registry config to use later in the function
    const registry_config_snapshot = registry_config.get();

    // Get clear text password
    const body_password: string = decodeURI(req.body.password);

    // Get recaptcha secret
    const recaptcha_secret = process.env.EDE_DEV !== "1"
        ? registry_config_snapshot["auth.recaptcha_secret"].value as string
        : SECRETS.tokens.recaptcha_dev;

    // Check captcha
    request.get(
        `https://www.google.com/recaptcha/api/siteverify?secret=${ recaptcha_secret }&response=${ req.body.captcha_token }`,
        (captcha_error: any, _: any, captcha_response: string): void => {

        // Captcha check failed
        // TODO! capcha disabled
        if(false && (captcha_error || !JSON.parse(captcha_response).success)) {
            res.status(403).send({ error: "captcha_error" });
            return;
        }

        // Get the user
        User.getFromUsername(req.body.username)
        .then(async (user: User.User) => {
            // Check if user is blocked from logging in
            if(user.blocks.includes("lockout")) {
                const msg = (await SystemMessage.get(["login-message-blocked"]))["login-message-blocked"];

                res.status(403).send({ error: "blocked", message: msg.value });
                return;
            }

            // Hash the user-provided password
            Util.pbkdf2(
                body_password,
                user.password_hash_salt as string,
                user.password_hash_iterations as number,
                user.password_hash_keylen as number
            )
            .then(async (password_hash: Util.Hash) => {
                // Compare the provided password hash to the correct one
                if(user.password_hash_hash !== password_hash.key) {
                    const msg = (await SystemMessage.get(["login-message-invalidcredentials"]))["login-message-invalidcredentials"];

                    res.status(403).send({ error: "invalid_credentials", message: msg.value });
                    return;
                }

                // Check 2FA

                // Get user-provided f2a code
                const f2a_otp = req.body.f2a_otp || "";

                // Check if the code is correct (will allways return true if the 2fa is disabled)
                const f2a_status = await F2A.check(user.id, f2a_otp);

                if(f2a_status.enabled) {
                    // 2FA is enabled for this user

                    // // Send a login attempt notification
                    // if(!f2a_status.otp_correct) {
                    //     User.sendNotificaion(
                    //         user.id,
                    //         "accountloginattempt",
                    //         "New login attempt was made. Correct password provided, one-time password requested.",
                    //         `IP address: ${ ip_address }`
                    //     );
                    // }

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
                User.createSession(user.id, ip_address, req.headers["user-agent"])
                .then((user_session: User.UserSession) => {
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

                    res.setCookie("st", `${ user.id }:${ user_session.session_token }`, {
                        domain: registry_config_snapshot["instance.domain"].value as string,
                        path: "/",
                        httpOnly: false,
                        sameSite: true,
                        secure: false,
                        encode: String
                    });

                    // Send a login notification
                    User.sendNotificaion(
                        user.id,
                        "accountlogin",
                        "Someone has logged into your account",
                        `IP address: ${ ip_address }`
                    );

                    response_notes.push("session_created");
                    res.send({ success: true, notes: response_notes });
                })
                .catch(() => {
                    res.status(403).send({ error: "create_session_error" });
                });
            })
            .catch(async (error: any) => {
                res.status(403).send({ error: "unknown" });
            });
        })
        .catch(async (error: any) => {
            const msg = (await SystemMessage.get(["login-message-invalidcredentials"]))["login-message-invalidcredentials"];

            res.status(403).send({ error: "invalid_credentials", message: msg.value });
        });
    });
}

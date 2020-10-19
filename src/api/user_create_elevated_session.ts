import * as User from "../user";
import { apiResponse, ApiResponseStatus } from "../api";
import { registry_config } from "../registry";
import { sql } from "../server";

export async function createElevatedSessionRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user || !client_user.current_session) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You are not logged in"));
        return;
    }

    // Get user's password
    sql.execute("SELECT `password` FROM `users` WHERE id = ?",
    [client_user.id],
    async (error: any, results: any) => {
        if(error || results.length !== 1) {
            res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Could not create an elevated session"));
            return;
        }

        const password_split: string = results[0].password.split(";");

        const db_password_hash = password_split[1];
        const db_password_salt = password_split[2];
        const db_password_iterations = parseInt(password_split[3], 10);
        const db_password_keylen = parseInt(password_split[4], 10);

        // Check password
        // TODO move this function to Util
        User.pbkdf2(
            req.body.password,
            db_password_salt,
            db_password_iterations,
            db_password_keylen
        )
        .then(async (password_hash: User.Hash) => {
            if(db_password_hash !== password_hash.key) {
                res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Invalid password"));
                return;
            }

            // Create an elevated session
            User.createElevatedSession(parseInt(client_user.id, 10))
            .then((result: any[]) => {
                const registry_config_snapshot = registry_config.get();

                res.setCookie("esid", result[0], {
                    domain: registry_config_snapshot["instance.domain"].value as string,
                    path: "/",
                    httpOnly: false,
                    expires: result[1],
                    sameSite: true,
                    secure: false,
                    encode: String
                });

                res.send(apiResponse(ApiResponseStatus.success));
            })
            .catch(() => {
                res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Could not create an elevated session"));
                // TODO log this incident to file
                // TODO also might be nice to have a systempage with such incidents
            });
        });
    });
}
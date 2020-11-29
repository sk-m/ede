import * as User from "../user";
import * as Util from "../utils";
import { apiSendError, apiSendSuccess } from "../api";
import { registry_config } from "../registry";

export async function createElevatedSessionRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user || !client_user.current_session) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    // Check password
    Util.pbkdf2(
        req.body.password,
        client_user.password_hash_salt,
        client_user.password_hash_iterations,
        client_user.password_hash_keylen
    )
    .then(async (password_hash: Util.Hash) => {
        if(client_user.password_hash_hash !== password_hash.key) {
            apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "Password is incorrect"));
            return;
        }

        // Create an elevated session
        User.createElevatedSession(client_user.id)
        .then((result: [string, Date]) => {
            const registry_config_snapshot = registry_config.get();

            res.setCookie("esid", result[0] /* esid */, {
                domain: registry_config_snapshot["instance.domain"].value as string,
                path: "/",
                httpOnly: false,
                expires: result[1] /* Date */,
                sameSite: true,
                secure: false,
                encode: String
            });

            apiSendSuccess(res);
        })
        .catch((rejection: Util.Rejection) => {
            // TODO log this incident to file
            // TODO also might be nice to have a systempage with such incidents
            apiSendError(res, rejection);
        });
    });
}
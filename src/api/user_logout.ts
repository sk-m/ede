import * as User from "../user";
import * as Util from "../utils";
import { apiSendError, apiSendSuccess } from "../api";
import { registry_config } from "../registry";

export async function logoutUserRoute(_: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user || !client_user.current_session) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "You are not logged in"));
        return;
    }

    // Invalidate current user's session
    User.invalidateUserSession(client_user.id, client_user.current_session.session_token)
    .then(() => {
        const registry_config_snapshot = registry_config.get();

        // Clear session cookies
        res.clearCookie("st", { path: "/", domain: registry_config_snapshot["instance.domain"].value as string });
        res.clearCookie("sid", { path: "/", domain: registry_config_snapshot["instance.domain"].value as string });
        res.clearCookie("esid", { path: "/", domain: registry_config_snapshot["instance.domain"].value as string });

        apiSendSuccess(res);
    })
    .catch((rejection: Util.Rejection) => {
        apiSendError(res, rejection);
    });
}
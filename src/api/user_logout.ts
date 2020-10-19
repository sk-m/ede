import * as User from "../user";
import { apiResponse, ApiResponseStatus } from "../api";
import { registry_config } from "../registry";

export async function logoutUserRoute(_: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user || !client_user.current_session) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You are not logged in"));
        return;
    }

    // TODO @cleanup User::id should be an int, not a string
    User.invalidateUserSession(parseInt(client_user.id, 10), client_user.current_session)
    .then(() => {
        const registry_config_snapshot = registry_config.get();

        // Clear session cookies
        res.clearCookie("st", { path: "/", domain: registry_config_snapshot["instance.domain"].value as string });
        res.clearCookie("sid", { path: "/", domain: registry_config_snapshot["instance.domain"].value as string });
        res.clearCookie("esid", { path: "/", domain: registry_config_snapshot["instance.domain"].value as string });

        res.send(apiResponse(ApiResponseStatus.success));
    })
    .catch(() => {
        res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Could not log out"));
        // TODO log this incident to file
        // TODO also might be nice to have a systempage with such incidents
    });
}
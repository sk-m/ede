import * as User from "../user";
import * as F2A from "../f2a";

import { apiResponse, ApiResponseStatus } from "../api";

export async function userDisable2FARoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user || !client_user.current_session) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You are not logged in"));
        return;
    }

    // Check the elevated session
    // TODO @cleanup User::id should be an int, not a string
    const elevated_session_correct = await User.checkElevatedSession(parseInt(client_user.id, 10), req.cookies.esid);

    if(!elevated_session_correct) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You must have a valid elevated session to perform this action"));
        return;
    }

    F2A.disable(parseInt(client_user.id, 10))
    .then(() => {
        res.send(apiResponse(ApiResponseStatus.success));
    })
    .catch((error: Error) => {
        res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, error));
        // TODO log this incident to file
        // TODO also might be nice to have a systempage with such incidents
    });
}
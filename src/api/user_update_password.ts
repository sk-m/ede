import * as User from "../user";
import { apiResponse, ApiResponseStatus } from "../api";

export async function updateUserPasswordRoute(req: any, res: any, client_user?: User.User): Promise<void> {
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

    User.updateUserPassword(parseInt(client_user.id, 10), req.body.new_password)
    .then(() => {
        res.send(apiResponse(ApiResponseStatus.success));
    })
    .catch(() => {
        res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Could not update user's password"));
        // TODO log this incident to file
        // TODO also might be nice to have a systempage with such incidents
    });
}
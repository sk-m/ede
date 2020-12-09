import * as User from "../user";
import { apiSendError, apiSendSuccess } from "../api";
import { Rejection, RejectionType } from "../utils";

export async function updateUserPasswordRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user || !client_user.current_session) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    // Check the elevated session
    const elevated_session_correct = await User.checkElevatedSession(client_user.id, req.cookies.esid);

    if(!elevated_session_correct) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "You must have a valid elevated session to perform this action"));
        return;
    }

    // Update user's password
    User.updateUserPassword(client_user.id, req.body.new_password)
    .then(() => {
        // Send a password change notification
        User.sendNotificaion(
            client_user.id,
            "accountpasswordchange",
            "Your password has been changed.",
            `Session token: ${ client_user.current_session?.session_token }`
        );

        apiSendSuccess(res);
    })
    .catch((rejection: Rejection) => {
        // TODO log this incident to file
        // TODO also might be nice to have a systempage with such incidents
        apiSendError(res, rejection);
    });
}
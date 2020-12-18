import * as User from "../user";
import * as F2A from "../f2a";

import { apiSendError, apiSendSuccess } from "../api";
import { Rejection, RejectionType } from "../utils";

export async function userDisable2FARoute(req: any, res: any, client_user?: User.User): Promise<void> {
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

    // Disable f2a for a user
    F2A.disable(client_user.id)
    .then(() => {
        apiSendSuccess(res);
    })
    .catch((rejection: Rejection) => {
        apiSendError(res, rejection);
    });
}
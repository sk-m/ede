import * as User from "../user";
import * as F2A from "../f2a";

import { apiSendError, apiSendSuccess } from "../api";
import { Rejection, RejectionType } from "../utils";

export async function userFinish2FASetupRoute(req: any, res: any, client_user?: User.User): Promise<void> {
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

    // Finish the f2a setup
    F2A.finishSetup(client_user.id, req.body.otp)
    .then((backup_codes: any) => {
        apiSendSuccess(res, "user/finish_f2a_setup", { backup_codes });
    })
    .catch((rejection: Rejection) => {
        apiSendError(res, rejection);
    });
}
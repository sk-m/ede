import * as User from "../user";
import * as Util from "../utils";
import { apiSendError, apiSendSuccess } from "../api";

export async function markUserNotificationReadRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user || !client_user.current_session) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "You are not logged in"));
        return;
    }

    const notification_id = parseInt(req.body.notification_id, 10);

    if(!notification_id) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "Invalid notification id"));
        return;
    }

    User.markNotificationRead(client_user.id, notification_id)
    .then(() => {
        apiSendSuccess(res);
    })
    .catch((rejection: Util.Rejection) => {
        // TODO log this incident to file
        // TODO also might be nice to have a systempage with such incidents
        apiSendError(res, rejection);
    });
}

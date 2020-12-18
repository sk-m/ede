import * as User from "../user";
import * as Util from "../utils";
import { apiSendError, apiSendSuccess } from "../api";

export async function userGetNotificationsStatusRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user || !client_user.current_session) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "You are not logged in"));
        return;
    }

    User.hasUnreadNotifications(client_user.id)
    .then((has_unread_notifications: boolean) => {
        apiSendSuccess(res, "user/get_notifications_status", { has_unread_notifications });
    })
    .catch((rejection: Util.Rejection) => {
        apiSendError(res, rejection);
    });
}

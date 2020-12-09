import * as User from "../user";
import * as Util from "../utils";
import { apiSendError, apiSendSuccess } from "../api";

export async function getUserNotificationsRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user || !client_user.current_session) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "You are not logged in"));
        return;
    }

    const api_warnings: string[] = [];

    const from = parseInt(req.query.from, 10) || undefined;
    let records_number = parseInt(req.query.records_number, 10) || 100;

    // Check if the client wants to retrieve more then 100 records
    if(records_number > 100) {
        records_number = 100;
        api_warnings.push("The number of records exceeds 100. Resetting to 100.");
    }

    User.getNotifications(client_user.id, records_number, from)
    .then((notifications: User.UserNotification[]) => {
        apiSendSuccess(res, "user/get_notifications", { notifications });
    })
    .catch((rejection: Util.Rejection) => {
        // TODO log this incident to file
        // TODO also might be nice to have a systempage with such incidents
        apiSendError(res, rejection);
    });
}

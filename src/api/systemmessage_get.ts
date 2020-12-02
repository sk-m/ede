import * as User from "../user";
import * as SystemMessage from "../system_message";
import { apiSendError, apiSendSuccess } from "../api";
import { Rejection, RejectionType } from "../utils";
import { GroupsAndRightsObject } from "../right";

export async function systemmessageGetRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if name was provided
    if(!req.query.name) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "`name` parameter is required."));
        return;
    }

    // Check if client has the rights to update system messages
    let client_permissions_error = true;

    if(client_user) {
        await User.getRights(client_user.id)
        .then((client_grouprights: GroupsAndRightsObject) => {
            if(client_grouprights.rights.editsystemmessages) client_permissions_error = false;
        })
        .catch(() => undefined);
    }

    const api_warnings: string[] = [];

    const from = parseInt(req.query.from, 10) || 0;
    let to = parseInt(req.query.to, 10) || 100;

    // Check if the client wants to retrieve more then 100 records
    if(to - from > 100) {
        to = from + 100;
        api_warnings.push(`The range exceeds 100 records. Getting records from ${ from } to ${ to } instead.`);
    }

    // Get the records
    SystemMessage.get_all(from, to, req.query.name, req.query.encode_values === "true")
    .then((sysmsgs: SystemMessage.SystemMessagesObject) => {
        apiSendSuccess(res, "systemmessage/get", {
            system_messages: sysmsgs,
            client_can_modify: !client_permissions_error
        }, api_warnings);
    })
    .catch((rejection: Rejection) => {
        apiSendError(res, rejection);
    });
}

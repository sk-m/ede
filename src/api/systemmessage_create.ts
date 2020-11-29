import * as User from "../user";
import * as Log from "../log";
import * as SystemMessage from "../system_message";
import { GroupsAndRightsObject } from "../right";
import { apiSendError, apiSendSuccess } from "../api";
import { Rejection, RejectionType } from "../utils";

export async function systemmessageCreateRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;
    // Check if client has the rights to create systemmessages
    await User.getRights(client_user.id)
    .then((client_grouprights: GroupsAndRightsObject) => {
        if(client_grouprights.rights.editsystemmessages) client_permissions_error = false;
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Only users with 'editsystemmessages' right can create system messages"));
        return;
    }

    // TODO deny, if value contains '<script>'
        // Or, even better, just sanitize the input with the Page.sanitizeWikitext function
    SystemMessage.create(req.body.name, req.body.value)
    .then(() => {
        // TODO add summary
        Log.createEntry("updatesystemmessage", client_user.id, req.body.name,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> created <a href="/System:SystemMessages/${ req.body.name }">${ req.body.name }</a> system message with the value of "<code>${ req.body.value }</code>"`, "");

        apiSendSuccess(res);
    })
    .catch((rejection: Rejection) => {
        apiSendError(res, rejection);
    });
}
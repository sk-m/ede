import * as User from "../user";
import * as Log from "../log";
import * as SystemMessage from "../system_message";
import { GroupsAndRightsObject } from "../right";
import { apiSendError, apiSendSuccess } from "../api";
import { Rejection, RejectionType } from "../utils";

export async function systemmessageSetRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    // Check if client has the rights to update systemmessages
    let client_permissions_error = true;

    await User.getRights(client_user.id)
    .then((client_grouprights: GroupsAndRightsObject) => {
        if(client_grouprights.rights.editsystemmessages) client_permissions_error = false;
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Only users with 'editsystemmessages' right can edit system messages"));
        return;
    }

    // TODO deny, if value contains '<script>'
        // Sanitize with Page.sanitizeWikitext instead
    SystemMessage.set(req.body.name, req.body.value)
    .then(() => {
        // TODO add summary
        Log.createEntry("updatesystemmessage", client_user.id, req.body.name,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> updated <a href="/System:SystemMessages/${ req.body.name }">${ req.body.name }</a> system message. Set to "<code>${ req.body.value }</code>"`, "");

        apiSendSuccess(res);
    })
    .catch((rejection: Rejection) => {
        apiSendError(res, rejection);
    });
}
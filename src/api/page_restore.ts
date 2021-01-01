import * as User from "../user";
import * as Page from "../page";
import * as Log from "../log";
import { apiSendError, apiSendSuccess } from "../api";
import { GroupsAndRightsObject } from "../right";
import { Rejection, RejectionType } from "../utils";
import { checkActionRestrictions } from "../action_restrictions";

export async function pageRestoreRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;
    let client_action_restricted = false;

    // Check if client has the rights to restore pages
    await User.getRights(client_user.id)
    .then(async (grouprights: GroupsAndRightsObject) => {
        if(grouprights.rights.wiki_restorepage) client_permissions_error = false;

        // Check action restrictions (viewarchives)
        const restriction_check_results = await checkActionRestrictions("page@id", req.body.pageid, "viewarchives", grouprights);

        client_action_restricted = restriction_check_results[0];

        if(client_action_restricted)
            apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, restriction_check_results[1]));
    })
    .catch(() => undefined);

    // Action is restricted, don't continue. We already sent the error message to the client
    if(client_action_restricted) return;

    if(client_permissions_error) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "You do not have permission to restore pages"));
        return;
    }

    const is_new_name = req.body.new_namespace && req.body.new_name;

    // Restore the page
    Page.restorePage(req.body.pageid, is_new_name && req.body.new_namespace, is_new_name && req.body.new_name)
    .then((new_page_data: [number, /* new */ Page.PageAddress, /* old */ Page.PageAddress]) => {
        // TODO idk about this approach

        // Log for new page
        Log.createEntry("restorewikipage", client_user.id, new_page_data[1].title,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> restored wiki page <a href="/${ new_page_data[2].title }">${ new_page_data[2].display_title }</a> \
${ is_new_name ? `to <i><a href="/${ new_page_data[1].title }">${ new_page_data[1].display_title }</a></i> ` : " " }(<code>${ req.body.pageid } -> ${ new_page_data[0] }</code>)`, req.body.summary);


        // Don't create two log entries for the old title and the new title if they are the same
        if(new_page_data[1].title !== new_page_data[2].title) {
            // Log for old page
            Log.createEntry("restorewikipage", client_user.id, new_page_data[2].title,
    `<a href="/User:${ client_user.username }">${ client_user.username }</a> restored wiki page <i><a href="/${ new_page_data[2].title }">${ new_page_data[2].display_title }</a></i> \
    ${ is_new_name ? `to <a href="/${ new_page_data[1].title }">${ new_page_data[1].display_title }</a> ` : " " }(<code>${ req.body.pageid } -> ${ new_page_data[0] }</code>)`, req.body.summary);
        }

        apiSendSuccess(res, "page/restore", { new_title: new_page_data[1].title });
    })
    .catch((rejection: Rejection) => {
        // TODO save error to a log
        apiSendError(res, rejection);
    })
}

import * as User from "../user";
import * as Page from "../page";
import * as Log from "../log";
import { apiSendError, apiSendSuccess } from "../api";
import { GroupsAndRightsObject } from "../right";
import { pageTitleParser } from "../routes";
import { Rejection, RejectionType } from "../utils";
import { checkActionRestrictions } from "../action_restrictions";

export async function pageMoveRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    // Parse the title
    const old_address = pageTitleParser(req.body.title);

    // Get the page
    // TODO @performance a lot of database queries
    const target_page = await Page.getPageInfo(old_address);
    const target_page_id = target_page[1][0].id;

    let client_permissions_error = true;
    let client_action_restricted = false;

    // Check if client has a right to move pages
    await User.getRights(client_user.id)
    .then(async (grouprights: GroupsAndRightsObject) => {
        if(grouprights.rights.wiki_movepage) client_permissions_error = false;

        // Check action restrictions (move)
        const restriction_check_results = await checkActionRestrictions("page@id", target_page_id, "move", grouprights);

        client_action_restricted = restriction_check_results[0];

        if(client_action_restricted)
            apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, restriction_check_results[1]));
    })
    .catch(() => undefined);

    // Action is restricted, don't continue. We already sent the error message to the client
    if(client_action_restricted) return;

    if(client_permissions_error) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "You do not have permission to move pages"));
        return;
    }

    // Check if user wanted to rename the page to it's current name
    if(old_address.namespace === req.body.new_namespace && old_address.name === req.body.new_name) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "No changes made"));
        return;
    }

    // Move the page
    Page.movePage(old_address.namespace, old_address.name, req.body.new_namespace, req.body.new_name)
    .then((results: [Page.PageAddress, number]) => {
        const new_address = results[0];

        // TODO idk about this solution

        // Log for old title
        Log.createEntry("movewikipage", client_user.id, old_address.title,
    `<a href="/User:${ client_user.username }">${ client_user.username }</a> moved wiki page <i><a href="/${ old_address.title }">${ old_address.display_title }</a></i> to <a href="/${ new_address.title }">${ new_address.display_title }</a> (<code>${ results[1] }</code>)`, req.body.summary);

        // Log for new title
        Log.createEntry("movewikipage", client_user.id, new_address.title,
    `<a href="/User:${ client_user.username }">${ client_user.username }</a> moved wiki page <a href="/${ old_address.title }">${ old_address.display_title }</a> to <i><a href="/${ new_address.title }">${ new_address.display_title }</a></i> (<code>${ results[1] }</code>)`, req.body.summary);

        apiSendSuccess(res);
    })
    .catch((rejection: Rejection) => {
        // TODO save error to a log
        apiSendError(res, rejection);
    });
}

import * as User from "../user";
import * as Page from "../page";
import * as Log from "../log";
import { apiSendError, apiSendSuccess } from "../api";
import { GroupsAndRightsObject } from "../right";
import { pageTitleParser } from "../routes";
import { Rejection, RejectionType } from "../utils";
import { checkActionRestrictions } from "../action_restrictions";

export async function pageDeleteRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;
    let client_can_remove_from_db = false;

    let client_namespace_restricted = false;
    let client_action_restricted = false;

    // Parse the title
    const address = pageTitleParser(req.body.title);

    // Get the page
    // TODO @performance a lot of database queries
    const target_page = await Page.getPageInfo(address);
    const target_page_id = target_page[1][0].id;

    // Check if client has the rights to delete pages
    await User.getRights(client_user.id)
    .then(async (grouprights: GroupsAndRightsObject) => {
        if(grouprights.rights.wiki_deletepage) {
            // Check the main right
            client_permissions_error = false;

            // Check if user is allowed to completely delete the page from the database
            if(grouprights.rights.wiki_deletepage.allow_complete_erase) client_can_remove_from_db = true;

            // Check if the client can delete a page in that namespace
            if(grouprights.rights.wiki_deletepage.disallowed_namespaces
               && grouprights.rights.wiki_deletepage.disallowed_namespaces.includes(address.namespace)) {
                client_namespace_restricted = true;
            }

            // Check action restrictions (delete)
            const restriction_check_results = await checkActionRestrictions("page@id", target_page_id, "delete", grouprights);

            client_action_restricted = restriction_check_results[0];

            if(client_action_restricted)
                apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, restriction_check_results[1]));
        }
    })
    .catch(() => undefined);

    // Action is restricted, don't continue. We already sent the error message to the client
    if(client_action_restricted) return;

    if(client_permissions_error) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "You do not have permission to delete pages"));
        return;
    }

    // Client is disallowed to delete pages from this particular namespace
    if(client_namespace_restricted) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "You do not have permission to delete pages in this namespace"));
        return;
    }

    // Can we completely delete the page from the database?
    const db_removal = req.body.db_removal === "true" && client_can_remove_from_db;

    // Delete the page
    Page.deletePage(address.namespace, address.name, client_user.id, req.body.summary, /* db_removal */)
    .then((deleted_page_id: number) => {
        Log.createEntry("deletewikipage", client_user.id, `${ address.namespace }:${ address.name }`,
    `<a href="/User:${ client_user.username }">${ client_user.username }</a>${ db_removal ? " completely removed" : " deleted" } wiki page <a href="/${ address.title }">${ address.display_title }</a> (<code>${ deleted_page_id }</code>)`, req.body.summary);

        apiSendSuccess(res);
    })
    .catch((rejection: Rejection) => {
        apiSendError(res, rejection);
    });
}

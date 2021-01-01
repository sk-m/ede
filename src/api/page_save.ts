import * as User from "../user";
import * as Page from "../page";
import { apiSendError, apiSendSuccess } from "../api";
import { GroupsAndRightsObject } from "../right";
import { registry_namespaces } from "../registry";
import { pageTitleParser } from "../routes";
import { Rejection, RejectionType } from "../utils";
import { checkActionRestrictions } from "../action_restrictions";

export async function pageSaveRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    // TODO allow admins to permit anons
    if(!client_user) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    // Get the address of the page
    const page_address = pageTitleParser(req.body.page_title);

    const registry_namespaces_snapshot = registry_namespaces.get();

    // Check if namespace exists
    if(!registry_namespaces_snapshot[page_address.namespace]) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, `Namespace '${ page_address.namespace }' does not exist`));
        return;
    }

    // Get the page
    // TODO @performance a lot of database queries
    const target_page = await Page.getPageInfo(page_address);

    let client_permissions_error = true;
    let client_can_create_pages = false;
    let client_action_restricted = false;

    // Check if client has the rights to update this page's content
    await User.getRights(client_user.id)
    .then(async (grouprights: GroupsAndRightsObject) => {
        // Page editing allowed?
        if(grouprights.rights.wiki_edit && grouprights.rights.wiki_edit.namespaces.includes(page_address.namespace)) {
            client_permissions_error = false;
        }

        // Page creation allowed?
        if(grouprights.rights.wiki_createpage && grouprights.rights.wiki_createpage.namespaces.includes(page_address.namespace)) {
            client_can_create_pages = true;
        }

        // Check action restrictions (edit) if user wants to save an exisiting page (not create)
        if(target_page[1].length !== 0) {
            const restriction_check_results = await checkActionRestrictions("page@id", target_page[1][0].id, "edit", grouprights);

            client_action_restricted = restriction_check_results[0];

            if(client_action_restricted)
                apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, restriction_check_results[1]));
        }
    })
    .catch(() => undefined);

    // Action is restricted, don't continue. We already sent the error message to the client
    if(client_action_restricted) return;

    if(client_permissions_error) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "You do not have permission to save pages in this namespace"));
        return;
    }

    // Create a new revision
    Page.createRevision(page_address, req.body.page_content, client_user, req.body.summary || "", undefined, client_can_create_pages)
    .then(() => {
        apiSendSuccess(res);
    })
    .catch((rejection: Rejection) => {
        // TODO save error to a log
        apiSendError(res, rejection);
    })
}

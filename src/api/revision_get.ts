import * as User from "../user";
import * as Page from "../page";
import { apiSendError, apiSendSuccess } from "../api";
import { GroupsAndRightsObject } from "../right";
import { Rejection, RejectionType } from "../utils";
import { checkActionRestrictions } from "../action_restrictions";

export async function getRevisionRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    if(!req.query.pageid && !req.query.userid) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "Please provide a pageid and/or a userid"));
        return;
    }

    // let no_client = true;
    let client_can_see_deleted = false;
    let client_action_restricted = false;

    let query_deleted = false;

    // Get user's rights
    if(client_user) {
        await User.getRights(client_user.id)
        .then(async (grouprights: GroupsAndRightsObject) => {
            // Check if the client can see deleted revisions
            if(grouprights.rights.wiki_restorepage) {
                // no_client = false;
                client_can_see_deleted = true;
            }

            // Should we also get deleted versions
            query_deleted = client_can_see_deleted && req.query.include_deleted;

            // Check action restrictions (viewarchives) if user wants to access a deleted revision
            if(query_deleted) {
                const restriction_check_results = await checkActionRestrictions("page@id", req.query.pageid, "viewarchives", grouprights);

                client_action_restricted = restriction_check_results[0];

                if(client_action_restricted)
                    apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, restriction_check_results[1]));
            }
        })
        .catch(() => undefined);
    }

    // Action is restricted, don't continue. We already sent the error message to the client
    if(client_action_restricted) return;

    // TODO if client requseted but is not permitted to do so, add a note explaining so
    // TODO client visibility is 0 for now
    Page.getPageRevisions(req.query.pageid, req.query.userid, query_deleted, true, 0)
    .then((revisions: { [revid: number]: Page.Revision }) => {
        apiSendSuccess(res, "revision/get", { revisions })
    })
    .catch((rejection: Rejection) => {
        apiSendError(res, rejection);
    });
}

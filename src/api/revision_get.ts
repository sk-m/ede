import * as User from "../user";
import * as Page from "../page";
import { apiResponse, ApiResponseStatus } from "../api";
import { GroupsAndRightsObject } from "../right";

export async function getRevisionRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    if(!req.query.pageid && !req.query.userid) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Please provide a pageid and/or a userid"));
        return;
    }

    // let no_client = true;
    let client_can_see_deleted = false;

    // Get user's rights
    if(client_user) {
        await User.getRights(client_user.id)
        .then((grouprights: GroupsAndRightsObject) => {
            // Check if the client can see deleted revisions
            if(grouprights.rights.wiki_restorepage) {
                // no_client = false;
                client_can_see_deleted = true;
            }
        })
        .catch(() => undefined);
    }

    // Should we also get deleted versions
    const query_deleted = client_can_see_deleted && req.query.include_deleted;

    // TODO if client requseted but is not permitted to do so, add a note explaining so
    // TODO client visibility is 0 for now
    Page.getPageRevisions(req.query.pageid, req.query.userid, query_deleted, true, 0)
    .then((revisions: { [revid: number]: Page.Revision }) => {
        res.send(apiResponse(ApiResponseStatus.success, { revisions }));
    })
    .catch((error: Error) => {
        res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, error));
    });
}

import * as User from "../user";
import * as Page from "../page";
import * as Log from "../log";
import { apiResponse, ApiResponseStatus } from "../api";
import { GroupsAndRightsObject } from "../right";

export async function pageRestoreRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;

    // Check if client has the rights to restore pages
    await User.getUserGroupRights(client_user.id)
    .then((grouprights: GroupsAndRightsObject) => {
        if(grouprights.rights.wiki_restorepage) client_permissions_error = false;
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You do not have permission to restore pages"));
        return;
    }

    // Restore the page
    Page.restorePage(req.body.pageid)
    .then((new_page: any) => {
        Log.createEntry("restorewikipage", client_user.id, new_page[1],
`<a href="/User:${ client_user.username }">${ client_user.username }</a> restored wiki page <a href="/${ new_page[1] }">${ new_page[1] }</a> \
(<code>${ req.body.pageid } -> ${ new_page[0] }</code>)`, req.body.summary);

        res.send(apiResponse(ApiResponseStatus.success));
    })
    .catch((error: any) => {
        // TODO save error to a log
        res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Unknown error occured"));
    })
}

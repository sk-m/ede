import * as User from "../user";
import * as Page from "../page";
import * as Log from "../log";
import { apiResponse, ApiResponseStatus } from "../api";
import { GroupsAndRightsObject } from "../right";
import { sql } from "../server";
import { pageTitleParser } from "../routes";

export async function pageRestoreRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;

    // Parse the title
    const address = pageTitleParser(req.body.title);

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

    // Get the page
    sql.execute("SELECT id FROM `wiki_pages` WHERE `namespace` = ? AND `name` = ?",
    [address.namespace, address.name],
    (error: any, results: any) => {
        if(error || results.length < 1) {
            res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Requested page was not found"));
            return;
        } else {
            // Restore the page
            Page.restorePage(results[0].id)
            .then(() => {
                Log.createEntry("restorewikipage", client_user.id, results[0].id,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> restored wiki page <a href="/${ req.body.title }">${ req.body.title }</a>`, req.body.summary);

                res.send(apiResponse(ApiResponseStatus.success));
            })
            .catch((error: any) => {
                // TODO save error to a log
                res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Unknown error occured"));
            })
        }
    });
}

import * as User from "../user";
import * as Page from "../page";
import * as Log from "../log";
import { apiResponse, ApiResponseStatus } from "../api";
import { GroupsAndRightsObject } from "../right";
import { sql } from "../server";
import { pageTitleParser } from "../routes";

export async function pageDeleteRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;
    let client_can_remove_from_db = false;

    let client_namespace_restricted = false;

    // Parse the title
    const address = pageTitleParser(req.body.title);

    // Check if client has the rights to delete pages
    await User.getUserGroupRights(client_user.id)
    .then((grouprights: GroupsAndRightsObject) => {
        if(grouprights.rights.wiki_deletepage) {
            // Main right
            client_permissions_error = false;

            // Allow complete erase
            if(grouprights.rights.wiki_deletepage.allow_complete_erase) client_can_remove_from_db = true;

            // Disallowed namespaces
            if(grouprights.rights.wiki_deletepage.disallowed_namespaces
               && grouprights.rights.wiki_deletepage.disallowed_namespaces.includes(address.namespace)) {
                client_namespace_restricted = true;
            }
        }
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You do not have permission to delete pages"));
        return;
    }

    // Client is disallowed to delete pages from this particular namespace
    if(client_namespace_restricted) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You do not have permission to delete pages in this namespace"));
        return;
    }

    const db_removal = req.body.db_removal === "true" && client_can_remove_from_db;

    // Get the page
    // TODO @performance we query the database for the page twice - here and in deletePage()
    sql.execute("SELECT * FROM `wiki_pages` WHERE `namespace` = ? AND `name` = ?",
    [address.namespace, address.name],
    (error: any, results: any) => {
        if(error || results.length < 1) {
            res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Requested page was not found"));
            return;
        } else {
            // Delete the page
            Page.deletePage(results[0].id, client_user.id, db_removal)
            .then(() => {
                Log.createEntry("deletewikipage", client_user.id, results[0].id,
`<a href="/User:${ client_user.username }">${ client_user.username }</a>${ db_removal ? " completely removed" : " deleted" } wiki page <a href="/${ req.body.title }">${ req.body.title }</a>`, req.body.summary);

                res.send(apiResponse(ApiResponseStatus.success));
            })
            .catch((error: any) => {
                // TODO save error to a log
                res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Unknown error occured"));
            })
        }
    });
}

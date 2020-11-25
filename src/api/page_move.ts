import * as User from "../user";
import * as Page from "../page";
import * as Log from "../log";
import { apiResponse, ApiResponseStatus } from "../api";
import { GroupsAndRightsObject } from "../right";
import { sql } from "../server";
import { pageTitleParser } from "../routes";

export async function pageMoveRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;

    // Parse the title
    const old_address = pageTitleParser(req.body.title);

    // Check if client has the rights to move pages
    await User.getRights(client_user.id)
    .then((grouprights: GroupsAndRightsObject) => {
        if(grouprights.rights.wiki_movepage) client_permissions_error = false;
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You do not have permission to move pages"));
        return;
    }

    // Check if user changed something
    if(old_address.namespace === req.body.new_namespace && old_address.name === req.body.new_name) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Nothing changed"));
        return;
    }

    // Get the page
    sql.execute("SELECT id FROM `wiki_pages` WHERE `namespace` = ? AND `name` = ?",
    [old_address.namespace, old_address.name],
    (query_error: any, results: any) => {
        if(query_error || results.length < 1) {
            res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Requested page was not found"));
            return;
        } else {
            // Move the page
            Page.movePage(results[0].id, req.body.new_namespace, req.body.new_name)
            .then(() => {
                const new_title = `${ req.body.new_namespace }:${ req.body.new_name }`;
                const new_address = pageTitleParser(new_title);

                // TODO idk about this solution

                // Log for old title
                Log.createEntry("movewikipage", client_user.id, old_address.title,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> moved wiki page <i><a href="/${ old_address.title }">${ old_address.display_title }</a></i> to <a href="/${ new_address.title }">${ new_address.display_title }</a> (<code>${ results[0].id }</code>)`, req.body.summary);

                // Log for new title
                Log.createEntry("movewikipage", client_user.id, new_address.title,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> moved wiki page <a href="/${ old_address.title }">${ old_address.display_title }</a> to <i><a href="/${ new_address.title }">${ new_address.display_title }</a></i> (<code>${ results[0].id }</code>)`, req.body.summary);

                res.send(apiResponse(ApiResponseStatus.success));
            })
            .catch((move_error: any) => {
                // TODO save error to a log
                res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, move_error && move_error.message || "Unknown error occured"));
            })
        }
    });
}

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

    const is_new_name = req.body.new_namespace && req.body.new_name;

    // Restore the page
    Page.restorePage(req.body.pageid, is_new_name && req.body.new_namespace, is_new_name && req.body.new_name)
    .then((new_page_data: [number, /* new */ Page.PageAddress, /* old */ Page.PageAddress]) => {
        // TODO idk about this approach

        // Log for new page
        Log.createEntry("restorewikipage", client_user.id, new_page_data[1].title,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> restored wiki page <a href="/${ new_page_data[2].title }">${ new_page_data[2].display_title }</a> \
${ is_new_name ? `to <i><a href="/${ new_page_data[1].title }">${ new_page_data[1].display_title }</a></i> ` : " " }(<code>${ req.body.pageid } -> ${ new_page_data[0] }</code>)`, req.body.summary);

        // Log for old page
        Log.createEntry("restorewikipage", client_user.id, new_page_data[2].title,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> restored wiki page <i><a href="/${ new_page_data[2].title }">${ new_page_data[2].display_title }</a></i> \
${ is_new_name ? `to <a href="/${ new_page_data[1].title }">${ new_page_data[1].display_title }</a> ` : " " }(<code>${ req.body.pageid } -> ${ new_page_data[0] }</code>)`, req.body.summary);

        res.send(apiResponse(ApiResponseStatus.success, { new_title: new_page_data[1].title }));
    })
    .catch((error: any) => {
        // TODO save error to a log
        res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, error && error.message || "Unknown error occured"));
    })
}

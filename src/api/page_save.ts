import * as User from "../user";
import * as Page from "../page";
import * as Util from "../utils";
import { apiResponse, ApiResponseStatus } from "../api";
import { GroupsAndRightsObject } from "../right";
import { registry_namespaces } from "../registry";

export async function pageSaveRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    // TODO allow admins to permit anons
    if(!client_user) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Anonymous users can't perform this action"));
        return;
    }

    if(!req.body.page_namespace || !req.body.page_name) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, `Page's namespace and name were not provided`));
        return;
    }

    if(!req.body.page_content) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, `Content was not provided`));
        return;
    }

    // Check if namespace exists
    const registry_namespaces_snapshot = registry_namespaces.get();
    const clean_namespace_name = Util.sanitize(req.body.page_namespace);

    if(!registry_namespaces_snapshot[clean_namespace_name]) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, `Namespace '${ clean_namespace_name }' does not exist`));
        return;
    }

    let client_permissions_error = true;
    let client_can_create_pages = false;

    // Check if client has the rights to update this page's content
    await User.getUserGroupRights(client_user.id)
    .then((grouprights: GroupsAndRightsObject) => {
        // Page editing
        if(grouprights.rights.wiki_edit && grouprights.rights.wiki_edit.namespaces.includes(clean_namespace_name)) {
            client_permissions_error = false;
        }

        // Page creation
        if(grouprights.rights.wiki_createpage && grouprights.rights.wiki_createpage.namespaces.includes(clean_namespace_name)) {
            client_can_create_pages = true;
        }
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You do not have permission to save pages in this namespace"));
        return;
    }

    const page_address: Page.PageAddress = {
        namespace: clean_namespace_name,
        name: Util.sanitize(req.body.page_name),

        raw_url: "",
        query: [],
        url_params: []
    }

    Page.createRevision(page_address, req.body.page_content, client_user, req.body.summary || "", undefined, client_can_create_pages)
    .then(() => {
        res.send(apiResponse(ApiResponseStatus.success));
    })
    .catch((error: any) => {
        if(typeof error === "string") {
            if(error === "page_not_found") {
                res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You do not have permission to create new pages in this namespace"));
                return;
            }
        }

        // TODO save error to a log
        res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Unknown error occured"));
    })
}

import * as Page from "./page";
import { pageTitleParser } from "./routes";
import * as User from "./user";
import { registry_apiRoutes } from "./registry";
import { GroupsAndRightsObject } from "./right";
import { renderWikitext } from "./wikitext";

export type ApiRoutesObject = { [route_name: string]: ApiRoute };
export interface ApiRoute {
    name: string;
    method: "GET" | "POST";

    description: string;

    required_arguments: string[];
    required_rights: string[];
    required_elevated_session?: true;

    arguments?: { [argument_name: string]: ApiArgument };

    handler: (req: any, res: any, client?: User.User) => void;
}

export interface ApiArgument {
    name: string;
    display_name: string;
    description?: string;

    // ex. 'boolean', 'number', 'string', etc.
    type: string;
}

export enum ApiResponseStatus {
    success = "success",

    invalidrequestmethod = "invalidrequestmethod",
    invalidroute = "invalidroute",
    nopostbody = "nopostbody",

    unknownerror = "unknownerror",
    permissiondenied = "permissiondenied",
    invaliddata = "invaliddata",

    other = "other"
};

/**
 * Construct final API's response
 *
 * @param status status type
 * @param additional_data string for errors, object for success (will be assigned to the final response object)
 */
export function apiResponse(status: ApiResponseStatus, additional_data?: any): any {
    let response: any = {
        status: ApiResponseStatus[status],
    }

    if(additional_data) {
        if(status === ApiResponseStatus.success) {
            response = Object.assign(response, additional_data);
        } else {
            if(additional_data instanceof Error) {
                response.error = additional_data && additional_data.message || "Unknown error occured";
            } else {
                response.error = additional_data;
            }
        }
    }

    return response;
}

// TODO @draft
export async function getPageRoute(req: any, res: any, client_user?: User.User, add_div_tag: boolean = true): Promise<void> {
    if(req.query.title) {
        // Get by title
        const parsed_title = pageTitleParser(req.query.title);

        const page = await Page.get({
            ...parsed_title,

            raw_url: req.raw.originalUrl
        }, client_user as User.User);

        // TODO get_raw does nothing here, Page.get renders it anyway
        res.send(page);
    } else if(req.query.revid) {
        // Get by revid
        let get_deleted = false

        if(req.query.allow_deleted) {
            // User wants to get a deleted revision, check if they have the right to do so
            let client_permissions_error = true;

            if(client_user) {
                await User.getUserGroupRights(client_user.id)
                .then((grouprights: GroupsAndRightsObject) => {
                    if(grouprights.rights.wiki_restorepage) {
                        // Main right
                        client_permissions_error = false;
                    }
                })
                .catch(() => undefined);
            }

            if(!client_permissions_error) get_deleted = true;
        }

        // Get the page
        const page = await Page.getRaw(req.query.revid, undefined, undefined, get_deleted);

        // Do we have to render?
        if(!req.query.get_raw && page.raw_content) page.parsed_content = (await renderWikitext(page.raw_content, {}, add_div_tag)).content;

        res.send(page);
    } else {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Please provide a title or a revid"));
    }
}

export async function RootRoute(req: any, res: any): Promise<void> {
    // TODO catch may be a bug here
    // TODO we dont't allways need to get the user. This is inefficient
    const client_user = await User.getFromSession(req, "invalid").catch(() => undefined);

    const registry_apiRoutes_snapshot = registry_apiRoutes.get();
    const route_name = req.params["*"].substring(1);

    const api_route_object = registry_apiRoutes_snapshot[route_name];

    if(api_route_object) {
        if(api_route_object.method === req.raw.method) {
            if(api_route_object.method === "POST") {
                // Check if client is blocked from editing
                if(client_user && client_user.blocks.includes("edit")) {
                    res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You are blocked from editing"));
                    return;
                }

                // Check if a body was provided
                if(!req.body) {
                    res.status(403).send(apiResponse(ApiResponseStatus.nopostbody, "No POST body provided"));
                    return;
                }

                // Check for required arguments
                for(const required_arg of api_route_object.required_arguments) {
                    if(!req.body.hasOwnProperty(required_arg)) {
                        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, `Parameter '${ required_arg }' is required`));
                        return;
                    }
                }
            }

            api_route_object.handler(req, res, client_user);
        } else {
            res.status(403).send(apiResponse(ApiResponseStatus.invalidrequestmethod, "Invalid request method (did you make a GET request, instead of POST?)"));
        }
    } else {
        res.status(403).send(apiResponse(ApiResponseStatus.invalidroute, "Requested API route does not exist"));
    }
}

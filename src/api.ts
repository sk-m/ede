import * as Page from "./page";
import { pageTitleParser } from "./routes";
import * as User from "./user";
import { registry_apiRoutes } from "./registry";
import { GroupsAndRightsObject } from "./right";
import { renderWikitext } from "./wikitext";
import { Rejection, RejectionType } from "./utils";

export type ApiRoutesObject = { [route_name: string]: ApiRoute };
export interface ApiRoute {
    name: string;
    method: "GET" | "POST";

    description: string;

    required_arguments: string[];
    required_rights: string[];
    required_elevated_session?: true;
    anonymous_call_allowed?: boolean;

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
 * Construct a successfull API response (and send)
 *
 * @param res HTTP response object
 * @param api_route API route
 * @param data response data
 */
export function apiSendSuccess(res: any, api_route?: string, data?: any, warnings?: string[]): any {
    const response: any = {
        status: "success",
        warnings: warnings || []
    };

    if(api_route && data) response[api_route] = data;

    res.send(response);
}

/**
 * Construct an erroneous API response (and send)
 *
 * @param res HTTP response object
 * @param rejection rejection
 */
export function apiSendError(res: any, rejection: Rejection): void {
    res.status(403).send({
        status: "error",
        error_type: RejectionType[rejection.type],
        message: rejection.client_message
    });
}

// TODO @draft @cleanup @move move this somewhere else
export async function getPageRoute(req: any, res: any, client_user?: User.User, add_div_tag: boolean = true): Promise<void> {
    if(req.query.title) {
        // Get a page by title
        const parsed_title = pageTitleParser(req.query.title);

        const page = await Page.get({
            ...parsed_title,

            raw_url: req.raw.originalUrl
        }, client_user as User.User);

        // TODO get_raw does nothing here, Page.get renders it anyway
        apiSendSuccess(res, "page/get", { page });
    } else if(req.query.revid) {
        // Get a page by revid
        let get_deleted = false;

        if(req.query.allow_deleted) {
            // User wants to get a deleted revision, check if they have the right to do so
            let client_permissions_error = true;

            if(client_user) {
                await User.getRights(client_user.id)
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
        let page;
        let sql_error: Rejection | undefined;

        page = await Page.getPageByRevid(req.query.revid, get_deleted)
        .catch((rejection_and_page: [Rejection, Page.ResponsePage | undefined]) => {
            if(rejection_and_page[1] !== undefined) {
                page = rejection_and_page[1];
            } else {
                sql_error = rejection_and_page[0];
            }
        });

        if(sql_error || !page) {
            apiSendError(res, sql_error as Rejection);
            return;
        }

        // Do we have to render?
        if((!req.query.get_raw || req.query.get_raw === "false") && page.raw_content) {
            page.parsed_content = (await renderWikitext(page.raw_content, {}, add_div_tag)).content;
        }

        apiSendSuccess(res, "page/get", { page });
    } else {
        // Neither a title nor a revid were provided
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "Please provide a title or a revid"));
    }
}

/**
 * Root API route. (almost) All api routes get called from here
 *
 * For a POST call, this function checks if all the required arguments were sent and makes sure that the user is not blocked from editing
 */
export async function RootRoute(req: any, res: any): Promise<void> {
    let client_user;

    // Check if user wants to execute something anonymously
    if(!req.query || req.query.g_anonymous !== "true") {
        client_user = await User.getFromSession(req).catch(() => undefined);
    }

    // Get an api routes snapshot from the registry
    const registry_apiRoutes_snapshot = registry_apiRoutes.get();
    const route_name = req.params["*"].substring(1);

    // Get the api route
    const api_route_object = registry_apiRoutes_snapshot[route_name];

    // Check if requested route exists
    if(!api_route_object) {
        apiSendError(res, new Rejection(RejectionType.API_INVALID_ROUTE, "Requested API route does not exist"));
        return;
    }

    // Check if the request method is correct
    if(api_route_object.method !== req.raw.method) {
        apiSendError(res, new Rejection(RejectionType.API_INVALID_REQUEST_METHOD, "Invalid request method (did you make a GET request, instead of POST?)"));
        return;
    }

    // If this is a post request, make some checks
    if(api_route_object.method === "POST") {
        // Check if client is blocked from editing
        if(client_user && client_user.blocks.includes("edit")) {
            apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "You are blocked from editing"));
            return;
        }

        // Check if a body was provided
        if(!req.body) {
            apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "No POST body provided"));
            return;
        }

        // Check for required arguments
        for(const required_arg of api_route_object.required_arguments) {
            if(!req.body.hasOwnProperty(required_arg)) {
                apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, `Parameter '${ required_arg }' is required`));
                return;
            }
        }
    }

    // Call the api route handler
    api_route_object.handler(req, res, client_user);
}

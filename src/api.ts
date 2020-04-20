import * as Page from "./page";
import { pageTitleParser } from "./routes";
import * as User from "./user";
import { registry_apiRoutes } from "./registry";

export type ApiRoutesObject = { [route_name: string]: ApiRoute };
export interface ApiRoute {
    name: string;
    method: "GET" | "POST";

    handler: (req: any, res: any, client?: User.User) => void;
}

export enum ApiResponseStatus {
    success = "success",

    invalidrequestmethod = "invalidrequestmethod",
    invalidroute = "invalidroute",
    nopostbody = "nopostbody",

    unknownerror = "unknownerror",
    permissiondenied = "permissiondenied",
    invaliddata = "invaliddata"
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
            response.error = additional_data;
        }
    }

    return response;
}

// TODO @draft
export async function getPageRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    const name = pageTitleParser(req.query.title);

    const page = await Page.get({
        name: name.name,
        namespace: name.namespace,

        url_params: req.query.title.split("/"),
        query: req.query,

        raw_url: req.raw.originalUrl
    }, client_user as User.User);

    if(req.query.raw) {
        res.send(page.parsed_content);
    } else {
        res.send(page);
    }
}

export async function RootRoute(req: any, res: any): Promise<void> {
    // TODO catch may be a bug here
    const client_user = await User.getFromSession(req, "invalid").catch(() => undefined);

    const registry_apiRoutes_snapshot = registry_apiRoutes.get();
    const route_name = req.params["*"].substring(1);

    const api_route_object = registry_apiRoutes_snapshot[route_name];

    if(api_route_object) {
        if(api_route_object.method === req.raw.method) {
            // Check if body was provided for POST requests
            if(api_route_object.method === "POST" && !req.body) {
                res.status("403").send(apiResponse(ApiResponseStatus.nopostbody, "No POST body provided"));
            }

            api_route_object.handler(req, res, client_user);
        } else {
            res.status("403").send(apiResponse(ApiResponseStatus.invalidrequestmethod, "Invalid request method (did you make a GET request, instead of POST?)"));
        }
    } else {
        res.status("403").send(apiResponse(ApiResponseStatus.invalidroute, "That API route does not exist"));
    }
}

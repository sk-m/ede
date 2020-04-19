import * as Page from "./page";
import { pageTitleParser } from "./routes";
import * as User from "./user";
import { registry_apiRoutes, registry_usergroups } from "./registry";
import { Group, GroupsAndRightsObject } from "./right";
import { sql } from "./server";
import * as Util from "./utils"

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
function apiResponse(status: ApiResponseStatus, additional_data?: any): any {
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

/**
 * Moify user's group membership ("user/updategroups")
 */
export async function updateUserGroupMembership(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;
    let client_grouprights: any;

    let target_user_error = false;
    let target_user_grouprights: any;

    // Check if client has the rights to modify user's group membership
    await User.getUserGroupRights(client_user.id)
    .then((grouprights: GroupsAndRightsObject) => {
        client_grouprights = grouprights;

        if(grouprights.rights.modifyusergroupmembership) client_permissions_error = false;
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Only users with 'modifyusergroupmembership' right can modify \
user's group membership"));
        return;
    }

    // Check if target user exists
    const target_user = await User.getFromUsername(req.body.username)
    .catch(() => {
        target_user_error = true;
    })

    if(target_user_error || !target_user) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Target user does not exist"));
        return;
    }

    // Get target user's groups
    target_user_grouprights = await User.getUserGroupRights(target_user.id).catch(() => {
        target_user_error = true;
    })

    if(target_user_error) {
        res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Unknown error occured"));
        return;
    }

    if(req.body.groups) {
        let groups_obj;

        try {
            groups_obj = JSON.parse(req.body.groups);
        } catch(e) {
            res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Error parsing groups object JSON"));
            return;
        }

        const added_groups: string[] = [];
        const removed_groups: string[] = [];

        let insert_sql_query = "";

        // tslint:disable-next-line: forin
        for(const group_name in groups_obj) {
            if(!group_name.match(/^[a-z_-]{1,127}$/)) {
                res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, `Group name '${ Util.sanitize(group_name) }' is invalid`));
                return;
            }

            if(groups_obj[group_name] && !target_user_grouprights.groups.includes(group_name)) {
                // Group is added
                // Check if client has the rights to assign
                if( !client_grouprights ||
                    (!client_grouprights.rights.modifyusergroupmembership.add.includes(group_name) &&
                    !client_grouprights.rights.modifyusergroupmembership.add.includes("*"))
                ) {
                    res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, `You don't have the rights to assign group \
'${ Util.sanitize(group_name) }'`));
                    return;
                }

                added_groups.push(group_name);

                insert_sql_query += `(${ target_user.id },'${ group_name }'),`;
            } else if(!groups_obj[group_name] && target_user_grouprights.groups.includes(group_name)) {
                // Group is removed
                // Check if client has the rights to remove
                if( !client_grouprights ||
                    (!client_grouprights.rights.modifyusergroupmembership.remove.includes(group_name) &&
                    !client_grouprights.rights.modifyusergroupmembership.remove.includes("*"))
                ) {
                    res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, `You don't have the rights to remove group \
'${ Util.sanitize(group_name) }'`));
                    return;
                }

                removed_groups.push(group_name);
            }
        }

        // Remove last comma from sql query
        insert_sql_query = insert_sql_query.substring(0, insert_sql_query.length - 1);

        // TODO maybe somehow make it into one query

        let error_occured = false;

        // TODO @performance
        // We currently have two PRIMARY KEYS in the database to prevent duplicates, I don't think this is a good approach
        // Maybe we can do it more efficiently?

        // TODO These sould be debug logs
        Util.log(`Adding groups: ${ added_groups || "(none)" }`, 1);
        Util.log(`Removing groups: ${ removed_groups || "(none)" }`, 1);

        // Remove groups
        if(removed_groups.length !== 0) {
            await new Promise((resolve: any, reject: any) => {
                sql.query(`DELETE FROM \`user_group_membership\` WHERE \`user\` = ${ target_user.id } \
        AND \`group\` IN ('${ removed_groups.join("','") }')`, (remove_error: any) => {
                    if(remove_error) {
                        Util.log(`Could not remove groups from user id ${ target_user.id }`, 3, remove_error)

                        reject();
                    } else {
                        resolve();
                    }
                });
            }).catch(() => {
                // TODO log incident
                res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Could not remove groups from user"));

                error_occured = true;
            });
        }

        // Add groups (don't continue if error occured)
        if(!error_occured && added_groups.length !== 0) {
            await new Promise((resolve: any, reject: any) => {
                sql.query(`INSERT IGNORE INTO \`user_group_membership\` (\`user\`,\`group\`) VALUES ${ insert_sql_query }`,
                (add_error: any) => {
                    if(add_error) {
                        Util.log(`Could not add groups to user id ${ target_user.id }`, 3, add_error)

                        reject();
                    } else {
                        resolve();
                    }
                });
            }).catch(() => {
                // TODO log incident
                res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Could not add groups to user"));

                error_occured = true;
            });
        }

        // We don't really need a check here
        if(!error_occured) {
            res.send(apiResponse(ApiResponseStatus.success));
        }
    } else {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "groups JSON object must be provided"));
    }
}

/**
 * Modify the user group ("usergroup/update")
 */
export async function updateUserGroupRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;

    // Check if client has the rights to modify user groups
    await User.getUserGroupRights(client_user.id)
    .then((client_grouprights: GroupsAndRightsObject) => {
        if(client_grouprights.rights.modifyusergroups) client_permissions_error = false;
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Only users with 'modifyusergroups' right can modify user groups"));
        return;
    }

    // Check if the name is correct
    if(!req.body.group_name.match(/^[a-z_-]{1,127}$/) ||
       !req.body.new_group_name.match(/^[a-z_-]{1,127}$/)) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Group name is invalid"));
        return;
    }

    // New usergroup object
    const new_usergroup: Group = {
        name: req.body.new_group_name || req.body.group_name,

        added_rights: {}
    };

    // Check if the group exsists
    if(!registry_usergroups.get()[req.body.group_name]) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Specified group doesn't exists"));
        return;
    }

    const usergroup_added_rights = Object.assign({}, registry_usergroups.get()[req.body.group_name].added_rights);

    // Rights
    if(req.body.rights) {
        let rights_obj;

        try {
            rights_obj = JSON.parse(req.body.rights);
        } catch(e) {
            res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Error parsing rights object JSON"));
            return;
        }

        for(const right_name in rights_obj) {
            // Right removed from group
            if(!rights_obj[right_name] && usergroup_added_rights[right_name]) {
                usergroup_added_rights[right_name] = false;
            }

            // Right added to group
            else if(rights_obj[right_name] && !usergroup_added_rights[right_name]) {
                usergroup_added_rights[right_name] = {};
            }
        }
    }

    // Right arguments
    if(req.body.right_arguments) {
        let arguments_obj;

        try {
            arguments_obj = JSON.parse(req.body.right_arguments);
        } catch(e) {
            res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Error parsing right_arguments object JSON"));
            return;
        }

        for(const right_name in arguments_obj) {
            if(arguments_obj[right_name]) {
                // Change arguments only if the right is assigned to the group
                if(usergroup_added_rights[right_name]) {
                    // tslint:disable-next-line: forin
                    for(const argument_name in arguments_obj[right_name]) {
                        let argument_value = arguments_obj[right_name][argument_name];

                        // Array: translate "1,2,3" to [1, 2, 3]
                        if(argument_value.indexOf(",") !== -1) {
                            argument_value = argument_value.split(",");
                        }

                        usergroup_added_rights[right_name][argument_name] = argument_value;
                    }
                }
            }
        }
    }

    if(!req.body.rights && req.body.right_arguments) {
        res.status("403").send(apiResponse(ApiResponseStatus.invaliddata, "rights and/or right_arguments JSON objects must be provided"));
        return;
    }

    // Write updated group to the database
    new_usergroup.added_rights = usergroup_added_rights;
    User.saveUserGroup(new_usergroup, req.body.group_name)
    .then(() => {
        // Update groups registry
        registry_usergroups.update();

        res.send(apiResponse(ApiResponseStatus.success));
    })
    .catch(() => {
        res.status("403").send(apiResponse(ApiResponseStatus.unknownerror, "Unknown error occured when saving the group"));
        // TODO log this incident to file
        // TODO also might be nice to have a systempage with such incidents
    });
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

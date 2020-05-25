import * as User from "../user";
import * as Log from "../log";
import { GroupsAndRightsObject } from "../right";
import { sql } from "../server";
import * as Util from "../utils"

import { apiResponse, ApiResponseStatus } from "../api";

/**
 * Moify user's group membership ("user/updategroups")
 */
export async function updateUserGroupMembershipRoute(req: any, res: any, client_user?: User.User): Promise<void> {
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

        let error_occured = false;

        // TODO @performance
        // We currently have two PRIMARY KEYS in the database to prevent duplicates, I don't think this is a good approach
        // Maybe we can do it more efficiently?

        // Check if user changed anything
        if(added_groups.length === 0 && removed_groups.length === 0) {
            res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "No groups altered"));
            return;
        }

        // TODO maybe somehow make it into one query

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

        // Add new Log entry
        // TODO get group names from sysmsgs
        let log_str = "";

        if(added_groups.length !== 0) log_str = `added <i>${ added_groups.join(", ") }</i>`;
        if(removed_groups.length !== 0) {
            if(log_str) log_str += "; ";

            log_str += `removed <i>${ removed_groups.join(", ") }</i>`;
        }

        Log.createEntry("usergroupsupdate", client_user.id, target_user.id,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> updated groups for <a href="/User:${ target_user.username }">\
${ target_user.username }</a>: ${ log_str }`, Util.sanitize(req.body.summary));

        res.send(apiResponse(ApiResponseStatus.success));
    } else {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "groups JSON object must be provided"));
    }
}

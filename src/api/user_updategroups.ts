import * as User from "../user";
import * as Log from "../log";
import { GroupsAndRightsObject } from "../right";
import { sql } from "../server";
import * as Util from "../utils"

import { apiSendError, apiSendSuccess } from "../api";

/**
 * Moify user's group membership ("user/updategroups")
 */
export async function updateUserGroupMembershipRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;
    let client_grouprights: any;

    let target_user_error = false;
    let target_user_grouprights: any;

    // Check if client has the rights to modify user's group membership
    await User.getRights(client_user.id)
    .then((grouprights: GroupsAndRightsObject) => {
        client_grouprights = grouprights;

        if(grouprights.rights.modifyusergroupmembership) client_permissions_error = false;
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "Only users with 'modifyusergroupmembership' right can modify \
        user's group membership"));
        return;
    }

    // Get the target user
    const target_user = await User.getFromUsername(req.body.username)
    .catch(() => {
        target_user_error = true;
    });

    // Check if target user exists
    if(target_user_error || !target_user) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.USER_NOT_FOUND, "Target user does not exist"));
        return;
    }

    // Get target user's groups
    target_user_grouprights = await User.getRights(target_user.id).catch(() => {
        target_user_error = true;
    });

    if(target_user_error) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not retrieve user's groups list"));
        return;
    }
    let groups_obj;

    // Parse groups JSON
    try {
        groups_obj = JSON.parse(req.body.groups);
    } catch(e) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "Error parsing groups object JSON"));
        return;
    }

    const added_groups: string[] = [];
    const removed_groups: string[] = [];

    let insert_sql_query = "";

    // Go through all groups rercieved from the client
    // tslint:disable-next-line: forin
    for(const group_name in groups_obj) {
        // Check if group name is correct
        // We do this because we allow assgning nonexistent groups to users
        if(!group_name.match(/^[a-z_-]{1,127}$/)) {
            apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, `Group name '${ Util.sanitize(group_name) }' is invalid`));
            return;
        }

        if(groups_obj[group_name] && !target_user_grouprights.groups.includes(group_name)) {
            // Group is added
            // Check if client has the rights to assign such group
            if( !client_grouprights ||
                (!client_grouprights.rights.modifyusergroupmembership.add.includes(group_name) &&
                !client_grouprights.rights.modifyusergroupmembership.add.includes("*"))
            ) {
                apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, `You don't have the rights to assign group \
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
                apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, `You don't have the rights to remove group \
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

    // Check if client changed anything
    if(added_groups.length === 0 && removed_groups.length === 0) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "No groups altered"));
        return;
    }

    // TODO @cleanup I think this can be a bit cleaner

    // First, remove groups, if any
    if(removed_groups.length !== 0) {
        await sql.promise().execute(`DELETE FROM \`user_group_membership\` WHERE \`user\` = ? \
AND \`group\` IN ('${ removed_groups.join("','") }')`,
        [target_user.id])
        .catch((error: Error) => {
            apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not remove groups from user"));
            Util.log(`Could not remove groups from user id ${ target_user.id }`, 3, error);

            error_occured = true;
        });
    }

    // Add groups, if any (don't continue if error occured)
    if(!error_occured && added_groups.length !== 0) {
        await sql.promise().query(`INSERT IGNORE INTO \`user_group_membership\` (\`user\`,\`group\`) VALUES ${ insert_sql_query }`)
        .catch((error: Error) => {
            apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not assign groups to user"));
            Util.log(`Could not assign groups to user id ${ target_user.id }`, 3, error);

            error_occured = true;
        });
    }

    // Don't continue if error occured
    if(error_occured) return;

    // Add new Log entry
    let log_str = "";

    // Construct log string
    if(added_groups.length !== 0) log_str = `added <i>${ added_groups.join(", ") }</i>`;
    if(removed_groups.length !== 0) {
        if(log_str) log_str += "; ";

        log_str += `removed <i>${ removed_groups.join(", ") }</i>`;
    }

    // Add log entry
    Log.createEntry("usergroupsupdate", client_user.id, target_user.id,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> updated groups for <a href="/User:${ target_user.username }">\
${ target_user.username }</a>: ${ log_str }`, req.body.summary);

    apiSendSuccess(res);
}

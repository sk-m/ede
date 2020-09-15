import * as User from "../user";
import * as Log from "../log";
import { GroupsAndRightsObject } from "../right";
import { apiResponse, ApiResponseStatus } from "../api";

export async function blockUserRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;
    let client_allow_lockout = false;
    let client_restricted_groups: string[] = [];

    // Check if client has the rights to block users
    await User.getUserGroupRights(client_user.id)
    .then((client_grouprights: GroupsAndRightsObject) => {
        if(client_grouprights.rights.blockuser) {
            client_permissions_error = false;
            client_restricted_groups = client_grouprights.rights.blockuser.restricted_user_groups;
            client_allow_lockout = client_grouprights.rights.blockuser.allow_lockout;
        }
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Only users with 'blockuser' right can block users"));
        return;
    }

    // Final restrictions array
    // TODO Add "Disallow creating new accounts" and "Also block ip-address"
    let final_restrictions: string[] = [];

    if(req.body.restrictions && req.body.restrictions.indexOf(";") !== -1) {
        final_restrictions = req.body.restrictions.split(";");
    }

    // Check if client has a right to lock users out
    if(final_restrictions.includes("lockout") && !client_allow_lockout) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You are not allowed to lock users out"));
        return;
    }

    // Remove the last element, if it's just an empty string
    if(final_restrictions[final_restrictions.length - 1] === "") final_restrictions.pop();

    // Get the target user
    User.getFromUsername(req.body.username)
    .then(async (target_user: User.User) => {
        User.getUserGroupRights(target_user.id)
        .then((target_user_groups: GroupsAndRightsObject) => {
            let error_group: string | false = false;

            // Check if target user is a member of a group that the client can't block
            for(const target_group of target_user_groups.groups) {
                if(client_restricted_groups.includes(target_group)) {
                    error_group = target_group;
                    break;
                }
            }

            if(error_group) {
                res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, `You are not allowed to block members of ${ error_group } group`));
            } else {
                const user_id = Number.parseInt(target_user.id, 10);
                const destroy_sessions = final_restrictions.includes("lockout");

                // Destroy sessions, if locked from logging in
                // We don't have to await here
                if(destroy_sessions) User.destroyUserSessions(user_id);

                User.updateUserBlocks(user_id, final_restrictions)
                .then(() => {
                    // TODO more detailed log message
                    Log.createEntry("blockuser", client_user.id, target_user.id,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> changed block settings for <a href="/User:${ req.body.username }">${ req.body.username }</a>\
${ destroy_sessions ? " and invalidated their sessions" : "" }`, req.body.summary);

                    res.send(apiResponse(ApiResponseStatus.success));
                })
                .catch(() => {
                    res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Unknown error occured when blocking a user"));
                    // TODO log this incident to file
                    // TODO also might be nice to have a systempage with such incidents
                });
            }
        })
        .catch(() => {
            res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Unknown error occured when blocking a user"));
        });
    })
    .catch(() => {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Target user does not exist."));
    });
}
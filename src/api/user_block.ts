import * as User from "../user";
import * as Log from "../log";
import { GroupsAndRightsObject } from "../right";
import { apiSendError, apiSendSuccess } from "../api";
import { sql } from "../server";
import { Rejection, RejectionType } from "../utils";

export async function blockUserRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;
    let client_allow_lockout = false;
    let client_restricted_groups: string[] = [];

    // Check if client has the rights to block users
    await User.getRights(client_user.id)
    .then((client_grouprights: GroupsAndRightsObject) => {
        if(client_grouprights.rights.blockuser) {
            client_permissions_error = false;
            client_restricted_groups = client_grouprights.rights.blockuser.restricted_user_groups;
            client_allow_lockout = client_grouprights.rights.blockuser.allow_lockout;
        }
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Only users with 'blockuser' right can block users"));
        return;
    }

    // Create a final restrictions array
    // TODO Add "Disallow creating new accounts" and "Also block ip-address"
    let final_restrictions: string[] = [];

    if(req.body.restrictions && req.body.restrictions.indexOf(";") !== -1) {
        final_restrictions = req.body.restrictions.split(";");
    }

    // Check if client has a right to lock users out
    if(final_restrictions.includes("lockout") && !client_allow_lockout) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "You are not allowed to lock users out"));
        return;
    }

    // Remove the last element, if it's just an empty string
    if(final_restrictions[final_restrictions.length - 1] === "") final_restrictions.pop();

    // Get the target user
    // TODO @performance This is bad
    User.getFromUsername(req.body.username)
    .then(async (target_user: User.User) => {
        // Get target user's groups
        User.getRights(target_user.id)
        .then(async (target_user_groups: GroupsAndRightsObject) => {
            let error_group: string | false = false;

            // Check if target user is a member of a group that the client can't block
            for(const target_group of target_user_groups.groups) {
                if(client_restricted_groups.includes(target_group)) {
                    error_group = target_group;
                    break;
                }
            }

            if(error_group) {
                apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, `You are not allowed to block members of ${ error_group } group`));
                return;
            } else {
                const destroy_sessions = final_restrictions.includes("lockout");
                const restrict_new_accounts_ip = final_restrictions.includes("account_creation");

                // Destroy sessions, if "lockout" block option is enabled
                // We don't have to await here
                if(destroy_sessions) User.destroyUserSessions(target_user.id);

                // Block ip from creating new accounts, if "account_creation" block option is enabled
                // TODO idk if this is a good idea, maybe we turn off ip blocking for now?
                if(restrict_new_accounts_ip) {
                    let ip_block_error = false;
                    let last_target_ip;

                    // Get target user's last IP address
                    last_target_ip = await sql.promise().execute("SELECT `ip_address` FROM `user_tracking` WHERE `user` = ? ORDER BY id DESC LIMIT 1",
                    [target_user.id])
                    .catch(() => {
                        ip_block_error = true;
                    });

                    if(!last_target_ip) {
                        // Could not get the address

                        apiSendError(res, new Rejection(RejectionType.GENERAL_UNKNOWN, "Could not get user's ip address"));
                        return;
                    }

                    // We have the last ip of the target user, block it from creating new accounts
                    await User.blockAddress(last_target_ip.toString(), ["account_creation"]).catch(() => { ip_block_error = true });

                    // Check if we blocked successfully
                    if(ip_block_error) {
                        apiSendError(res, new Rejection(RejectionType.GENERAL_UNKNOWN, "Unknown error occured when blocking user's ip address"));
                        return;
                    }
                }

                // Update user's blocks
                User.updateUserBlocks(target_user.id, final_restrictions)
                .then(() => {
                    // TODO more detailed log message
                    Log.createEntry("blockuser", client_user.id, target_user.id,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> changed block settings for <a href="/User:${ req.body.username }">${ req.body.username }</a>\
${ destroy_sessions ? " and invalidated their sessions" : "" }`, req.body.summary);

                    apiSendSuccess(res);
                })
                .catch((rejection: Rejection) => {
                    // TODO log this incident to file
                    // TODO also might be nice to have a systempage with such incidents
                    apiSendError(res, rejection);
                });
            }
        })
        .catch((rejection: Rejection) => {
            apiSendError(res, rejection);
        });
    })
    .catch((rejection: Rejection) => {
        apiSendError(res, rejection);
    });
}
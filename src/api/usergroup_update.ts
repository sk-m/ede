import * as User from "../user";
import * as Log from "../log";
import * as Util from "../utils";
import { registry_config, registry_usergroups } from "../registry";
import { Group, GroupsAndRightsObject } from "../right";
import { apiSendError, apiSendSuccess } from "../api";

/**
 * Modify the user group ("usergroup/update")
 */
export async function updateUserGroupRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;

    // Check if client has the rights to modify user groups
    await User.getRights(client_user.id)
    .then((client_grouprights: GroupsAndRightsObject) => {
        if(client_grouprights.rights.modifyusergroups) client_permissions_error = false;
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "Only users with 'modifyusergroups' right can modify user groups"));
        return;
    }

    // Check if the group exsists
    if(!registry_usergroups.get()[req.body.group_name]) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "Specified group doesn't exists"));
        return;
    }

    // Get the current group and create an object for an updated one
    const current_usergroup = registry_usergroups.get()[req.body.group_name];
    const new_usergroup: Group = {
        name: req.body.group_name,

        added_rights: [],
        right_arguments: {}
    };

    const registry_config_snapshot = registry_config.get();

    // Function to check if the right is restricted and can not be added or removed from the group
    function check_restricted(right_name: string): boolean {
        return registry_config_snapshot["security.restricted_rights"].value instanceof Array
            && registry_config_snapshot["security.restricted_rights"].value.includes(right_name);
    }

    // Deal with rights
    if(req.body.rights) {
        let rights_obj;

        // Check if rights object was provided correctly
        try {
            rights_obj = JSON.parse(req.body.rights);
        } catch(e) {
            apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "Error parsing rights object JSON"));
            return;
        }

        // Deal with every right

        // tslint:disable-next-line: forin
        for(const right_name in rights_obj) {
            if(rights_obj[right_name] === false && current_usergroup.added_rights.includes(right_name)) {
                // Right is being removed from the group, so we don't have to push it to the new group object

                if(check_restricted(right_name)) {
                    // Tried to remove a restricted right from the group

                    apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, `Right '${ right_name }' is restricted and can not be altered.`));
                    return;
                }
            }
            else if(rights_obj[right_name] === true && !current_usergroup.added_rights.includes(right_name)) {
                // Right is being added to the group, push it to the new object

                if(check_restricted(right_name)) {
                    // Tried to add a restricted right to the group

                    apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, `Right '${ right_name }' is restricted and can not be altered.`));
                    return;
                }

                // Push the right to the new group
                new_usergroup.added_rights.push(right_name);
            }
            else if(rights_obj[right_name] === true) {
                // Right was already assigned -> push to the new group object.
                // We don't have to check if it is restricted, because it already was there

                new_usergroup.added_rights.push(right_name);
            }
        }
    }

    // Right with right arguments
    if(req.body.right_arguments) {
        let arguments_obj;

        // Check if right arguments object was provided correctly
        try {
            arguments_obj = JSON.parse(req.body.right_arguments);
        } catch(e) {
            apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "Error parsing right_arguments object JSON"));
            return;
        }

        // Deal with every right argument

        for(const right_name in arguments_obj) {
            if(arguments_obj[right_name]) {
                // Change arguments only if the right is assigned to the group. If it is not, the arguments mean nothing

                if(new_usergroup.added_rights.includes(right_name)) {
                    if(check_restricted(right_name)) {
                        // If the right is restricted, set args to current (not new), or to {}, if undefined

                        if(current_usergroup.right_arguments[right_name] === undefined) {
                            new_usergroup.right_arguments[right_name] = {};
                        } else {
                            new_usergroup.right_arguments[right_name] = current_usergroup.right_arguments[right_name];
                        }
                    } else if(arguments_obj[right_name] !== undefined) {
                        // If it is not restricted, set the args to user-specified

                        new_usergroup.right_arguments[right_name] = arguments_obj[right_name];
                    }
                }
            }
        }
    }

    // Write updated group to the database
    User.saveUserGroup(new_usergroup)
    .then(() => {
        // Update groups registry
        registry_usergroups.update();

        // Log the update
        // TODO more detailed log message
        Log.createEntry("groupupdate", client_user.id, req.body.group_name,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> updated group <a href="/System:UserGroupManagement/${ req.body.group_name }">${ req.body.group_name }</a>`, req.body.summary);

        apiSendSuccess(res);
    })
    .catch((rejection: Util.Rejection) => {
        // TODO log this incident to file
        // TODO also might be nice to have a systempage with such incidents
        apiSendError(res, rejection);
    });
}

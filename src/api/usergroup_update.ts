import * as User from "../user";
import * as Log from "../log";
import * as Util from "../utils";
import { registry_config, registry_usergroups } from "../registry";
import { Group, GroupsAndRightsObject } from "../right";
import { apiResponse, ApiResponseStatus } from "../api";

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
    if(!req.body.group_name.match(/^[a-z_-]{1,127}$/)) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Group name is invalid"));
        return;
    }

    // Check if the group exsists
    if(!registry_usergroups.get()[req.body.group_name]) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Specified group doesn't exists"));
        return;
    }

    const current_usergroup = registry_usergroups.get()[req.body.group_name];

    const registry_config_snapshot = registry_config.get();

    // Rights
    if(req.body.rights) {
        let rights_obj;

        try {
            rights_obj = JSON.parse(req.body.rights);
        } catch(e) {
            res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Error parsing rights object JSON"));
            return;
        }

        // tslint:disable-next-line: forin
        for(const right_name in rights_obj) {
            // Check if the right is restricted
            if(registry_config_snapshot["security.restricted_rights"].value instanceof Array
            && registry_config_snapshot["security.restricted_rights"].value.includes(right_name)) {
                res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, `Right '${ right_name }' is restricted and can not be altered.`));
                return;
            }

            // Right removed from group
            if(rights_obj[right_name] === false && current_usergroup.added_rights.includes(right_name)) {
                current_usergroup.added_rights.splice(current_usergroup.added_rights.indexOf(right_name), 1);
            }

            // Right added to group
            else if(rights_obj[right_name] === true && !current_usergroup.added_rights.includes(right_name)) {
                current_usergroup.added_rights.push(right_name);
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
                if(current_usergroup.added_rights.includes(right_name)) {
                    // tslint:disable-next-line: forin
                    for(const argument_name in arguments_obj[right_name]) {
                        if(current_usergroup.right_arguments[right_name] === undefined) {
                            current_usergroup.right_arguments[right_name] = {};
                        }

                        current_usergroup.right_arguments[right_name][argument_name] = arguments_obj[right_name][argument_name];
                    }
                } else {
                    // Delete the argument from the object if the right is not assigned
                    // TODO @bug test for bugs
                    if(current_usergroup.right_arguments.hasOwnProperty(right_name)) delete current_usergroup.right_arguments[right_name];
                }
            }
        }
    }

    // New usergroup object
    const new_usergroup: Group = {
        name: req.body.group_name,

        added_rights: current_usergroup.added_rights,
        right_arguments: current_usergroup.right_arguments
    };

    // Write updated group to the database
    User.saveUserGroup(new_usergroup)
    .then(() => {
        // Update groups registry
        registry_usergroups.update();

        // Log the update
        // TODO more detailed log message
        Log.createEntry("groupupdate", client_user.id, req.body.group_name,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> updated group <a href="/System:UserGroupManagement/${ req.body.group_name }">${ req.body.group_name }</a>`, Util.sanitize(req.body.summary || ""));

        res.send(apiResponse(ApiResponseStatus.success));
    })
    .catch(() => {
        res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Unknown error occured when saving the group"));
        // TODO log this incident to file
        // TODO also might be nice to have a systempage with such incidents
    });
}

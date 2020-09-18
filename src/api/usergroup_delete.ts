import * as User from "../user";
import * as Log from "../log";
import { registry_config, registry_usergroups } from "../registry";
import { GroupsAndRightsObject } from "../right";
import { apiResponse, ApiResponseStatus } from "../api";

export async function deleteUserGroupRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;

    // Check if client has the rights to delete user groups
    await User.getUserGroupRights(client_user.id)
    .then((client_grouprights: GroupsAndRightsObject) => {
        if(client_grouprights.rights.modifyusergroups) client_permissions_error = false;
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Only users with 'modifyusergroups' right can delete user groups"));
        return;
    }

    // Check if the name is correct
    if(!req.body.group_name.match(/^[a-z_-]{1,127}$/)) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Group name is invalid"));
        return;
    }

    // Check if the group exsists
    if(!registry_usergroups.get()[req.body.group_name]) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Group with such name does not exist"));
        return;
    }

    // Check if group is protected
    const registry_config_snapshot = registry_config.get();

    if(registry_config_snapshot["security.protected_groups"].value instanceof Array
    && registry_config_snapshot["security.protected_groups"].value.includes(req.body.group_name)) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "This group is protected and can not be deleted"));
        return;
    }

    User.deleteUserGroup(req.body.group_name)
    .then(() => {
        // Update groups registry
        registry_usergroups.update();

        // TODO more detailed log message
        Log.createEntry("groupupdate", client_user.id, req.body.group_name,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> deleted <a href="/System:UserGroupManagement/${ req.body.group_name }">${ req.body.group_name }</a> group`, "");

        res.send(apiResponse(ApiResponseStatus.success));
    })
    .catch(() => {
        res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Unknown error occured when deleting a user group"));
        // TODO log this incident to file
        // TODO also might be nice to have a systempage with such incidents
    });
}
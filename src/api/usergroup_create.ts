import * as User from "../user";
import * as Log from "../log";
import { registry_usergroups } from "../registry";
import { GroupsAndRightsObject } from "../right";
import { apiResponse, ApiResponseStatus } from "../api";

export async function createUserGroupRoute(req: any, res: any, client_user?: User.User): Promise<void> {
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
    if(!req.body.new_group_name.match(/^[a-z_-]{1,127}$/)) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Group name is invalid"));
        return;
    }

    // Check if the group exsists
    if(registry_usergroups.get()[req.body.new_group_name]) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Group with such name already exists"));
        return;
    }

    User.createUserGroup(req.body.new_group_name)
    .then(() => {
        // Update groups registry
        registry_usergroups.update();

        // TODO more detailed log message
        Log.createEntry("groupupdate", client_user.id, req.body.new_group_name,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> created a new group <a href="/System:UserGroupManagement/${ req.body.new_group_name }">${ req.body.new_group_name }</a>`, "");

        res.send(apiResponse(ApiResponseStatus.success));
    })
    .catch(() => {
        res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Unknown error occured when creating a new user group"));
        // TODO log this incident to file
        // TODO also might be nice to have a systempage with such incidents
    });
}
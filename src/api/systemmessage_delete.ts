import * as User from "../user";
import * as Log from "../log";
import * as SystemMessage from "../system_message";
import { GroupsAndRightsObject } from "../right";
import { apiResponse, ApiResponseStatus } from "../api";

export async function systemmessageDeleteRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;
    // Check if client has the rights to delete systemmessages
    await User.getUserGroupRights(client_user.id)
    .then((client_grouprights: GroupsAndRightsObject) => {
        if(client_grouprights.rights.editsystemmessages) client_permissions_error = false;
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Only users with 'editsystemmessages' right can delete system messages"));
        return;
    }

    // Check if the name is correct
    if(!req.body.name.match(/^[a-z_-]{1,256}$/)) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "System message name is invalid"));
        return;
    }

    // Check if system message is deletable
    SystemMessage.get([req.body.name])
    .then((sysmsgs: SystemMessage.SystemMessagesObject) => {
        if(!sysmsgs[req.body.name].is_deletable) {
            res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Requested system message is not deletable"));
        } else {
            SystemMessage.remove(req.body.name)
            .then(() => {
                // TODO add summary
                Log.createEntry("updatesystemmessage", client_user.id, req.body.name,
`<a href="/User:${ client_user.username }">${ client_user.username }</a> deleted <a href="/System:SystemMessages/${ req.body.name }">${ req.body.name }</a> system message`, "");

                res.send(apiResponse(ApiResponseStatus.success));
            })
            .catch(() => {
                res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Unknown error occured when deleting a system message"));
            });
        }
    })
    .catch(() => {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Requested system message does not exist"));
    });
}
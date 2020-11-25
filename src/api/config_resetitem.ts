import * as User from "../user";
import * as Config from "../config";

import { apiResponse, ApiResponseStatus } from "../api";
import { GroupsAndRightsObject } from "../right";
import { registry_config } from "../registry";
import { ConfigItemAccessLevel } from "../config";

export async function configResetItemRoute(req: any, res: any, client_user?: User.User): Promise<void> {
   // Check if client is logged in
   if(!client_user) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;
    let client_permits: any;

    // Check if client has the rights to modify user's group membership
    await User.getRights(client_user.id)
    .then((grouprights: GroupsAndRightsObject) => {
        if(grouprights.rights.modifyconfig) {
            client_permissions_error = false;
            client_permits = grouprights.rights.modifyconfig.restricted_permits;
        }
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "Only users with 'modifyconfig' right can modify \
EDE configuration"));
        return;
    }

    // Requested config item
    const registry_config_snapshot = registry_config.get();
    const config_item = registry_config_snapshot[req.body.key];

    // Check if client can alter
    if(config_item.write_access === ConfigItemAccessLevel.None || config_item.read_access === ConfigItemAccessLevel.None) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "This config item can be modified using CLI only"));
        return;
    }

    if( config_item.write_access === ConfigItemAccessLevel.Permit &&
        !client_permits.includes(req.body.key)
    ) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "This config item is restricted and you don't \
have permission to modify it"));
        return;
    }

    // Everything is ok, update the config item
    Config.resetItem(req.body.key)
    .then(() => {
        // Update the registry config
        registry_config.update();

        res.send(apiResponse(ApiResponseStatus.success, { new_value: config_item.default_value }));
    })
    .catch((error: Error) => {
        res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, error.message));
    });
}

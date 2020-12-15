import * as User from "../user";
import * as Config from "../config";
import { apiSendError, apiSendSuccess } from "../api";
import { GroupsAndRightsObject } from "../right";
import { registry_config, registry_config_triggers } from "../registry";
import { ConfigItemAccessLevel } from "../config";
import { Rejection, RejectionType } from "../utils";

export async function configSetItemRoute(req: any, res: any, client_user?: User.User): Promise<void> {
   // Check if client is logged in
    if(!client_user) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    let client_permissions_error = true;
    let client_permits: any;

    // Check if client has the rights to alter the key
    await User.getRights(client_user.id)
    .then((grouprights: GroupsAndRightsObject) => {
        if(grouprights.rights.modifyconfig) {
            client_permissions_error = false;
            client_permits = grouprights.rights.modifyconfig.restricted_permits;
        }
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Only users with 'modifyconfig' right can modify \
EDE configuration"));
        return;
    }

    const registry_config_snapshot = registry_config.get();

    const key = req.body.key;
    const new_value = req.body.value;

    // Check if such config key exists
    if(!registry_config_snapshot[key]) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, `Config key '${ key }' does not exist`));
        return;
    }

    // Get requested config item
    const config_item = registry_config_snapshot[key];

    // Item is locked from editing (CLI only)
    if(config_item.write_access === ConfigItemAccessLevel.None || config_item.read_access === ConfigItemAccessLevel.None) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "This config item can be modified using CLI only"));
        return;
    }

    // Restricted key with no permit
    if( config_item.write_access === ConfigItemAccessLevel.Permit &&
        !client_permits.includes(key)
    ) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "This config item is restricted and you don't \
        have permission to modify it"));
        return;
    }

    // Everything is ok, update the config item
    Config.setValue(key, new_value)
    .then(() => {
        apiSendSuccess(res);

        // Update the registry config
        registry_config.update()
        .then(() => {
            // Process triggers
            if(config_item.triggers.length !== 0) {
                const registry_config_triggers_snapshot = registry_config_triggers.get();

                for(const trigger_name of config_item.triggers) {
                    // Call the trigger function
                    registry_config_triggers_snapshot[trigger_name].handler();
                }
            }
        });

        // TODO? log config update
    })
    .catch((rejection: Rejection) => {
        apiSendError(res, rejection);
    });
}

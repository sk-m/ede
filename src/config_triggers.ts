import { registry_config } from "./registry";
import * as Server from "./server";

export function managecachingserver(): void {
    const registry_config_snapshot = registry_config.get();

    // Check if we should connect or disconnect
    if(registry_config_snapshot["caching.enabled"].value as boolean === true) {
        // We have to connect to the caching server
        Server.redisConnect();
    } else {
        // We have to disconnect from the caching server
        Server.redisDisconnect();
    }
}

export function managemailer(): void {
    const registry_config_snapshot = registry_config.get();

    // Check if we should connect or disconnect
    if(registry_config_snapshot["mail.enabled"].value as boolean === true) {
        // We have to connect to the mail server
        Server.mailerConnect();
    } else {
        // We have to disconnect from the mail server
        Server.mailerDisconnect();
    }
}

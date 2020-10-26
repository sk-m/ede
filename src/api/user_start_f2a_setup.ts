import * as User from "../user";
import * as F2A from "../f2a";

// tslint:disable-next-line: no-var-requires
const tfa = require("2fa");

import { apiResponse, ApiResponseStatus } from "../api";
import { registry_config } from "../registry";

export async function userStart2FASetupRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user || !client_user.current_session) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You are not logged in"));
        return;
    }

    // Check the elevated session
    // TODO @cleanup User::id should be an int, not a string
    const elevated_session_correct = await User.checkElevatedSession(parseInt(client_user.id, 10), req.cookies.esid);

    if(!elevated_session_correct) {
        res.status(403).send(apiResponse(ApiResponseStatus.permissiondenied, "You must have a valid elevated session to perform this action"));
        return;
    }

    F2A.startSetup(parseInt(client_user.id, 10))
    .then((secret_key: string) => {
        const registry_config_snapshot = registry_config.get();

        // Generate qr code
        tfa.generateGoogleQR(registry_config_snapshot["instance.display_name"].value as string, client_user.username, secret_key,
        (error: any, qr_code: string) => {
            // qr_code is a data URL containing an image of the qr code

            if(error) {
                res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, "Could not start the 2FA setup"));
            } else {
                res.send(apiResponse(ApiResponseStatus.success, { qr_code }));
            }
        });
    })
    .catch((error: Error) => {
        res.status(403).send(apiResponse(ApiResponseStatus.unknownerror, error));
        // TODO log this incident to file
        // TODO also might be nice to have a systempage with such incidents
    });
}
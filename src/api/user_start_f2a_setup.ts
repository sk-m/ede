import * as User from "../user";
import * as F2A from "../f2a";

// tslint:disable-next-line: no-var-requires
const tfa = require("2fa");

import * as Util from "../utils";
import { apiSendError, apiSendSuccess } from "../api";
import { registry_config } from "../registry";
import { Rejection, RejectionType } from "../utils";

export async function userStart2FASetupRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user || !client_user.current_session) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    // Check the elevated session
    const elevated_session_correct = await User.checkElevatedSession(client_user.id, req.cookies.esid);

    if(!elevated_session_correct) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "You must have a valid elevated session to perform this action"));
        return;
    }

    // Start the f2a setup
    F2A.startSetup(client_user.id)
    .then((secret_key: string) => {
        const registry_config_snapshot = registry_config.get();

        // Generate the qr code
        tfa.generateGoogleQR(registry_config_snapshot["instance.display_name"].value as string, client_user.username, secret_key,
        (error: any, qr_code: string) => {
            // qr_code is a data URL containing an image of the qr code

            if(error) {
                // QR code generation failed

                apiSendError(res, new Rejection(RejectionType.GENERAL_UNKNOWN, "Could not generate a QR code"));

                Util.log("Could not generate a QR code for user/start_f2a_setup api route", 3, error, { username: client_user.username });
            } else {
                apiSendSuccess(res, "user/start_f2a_setup", { qr_code });
            }
        });
    })
    .catch((rejection: Rejection) => {
        apiSendError(res, rejection);
    });
}
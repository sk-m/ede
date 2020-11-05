import * as User from "../user";
import * as Mail from "../mail";
import * as MailTemplates from "../mail_templates";
import { apiResponse, ApiResponseStatus } from "../api";

export async function requestUserEmailChangeRoute(req: any, res: any, client_user?: User.User): Promise<void> {
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

    // Check new address
    if(!req.body.new_address.match(/^[A-Za-z0-9_@\.-]{6,128}$/)) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "Invalid email format"));
        return;
    }

    // Check if outbound email is enabled
    // TODO @cleanup we can just put this in .reject() of Mail.send
    if(!Mail.checkEnabled()) {
        res.status(403).send(apiResponse(ApiResponseStatus.other, "Outbound email is disabled"));
        return;
    }

    // Create an email_change token
    const email_verification_token = await User.createEmailToken(parseInt(client_user.id, 10), "email_change", req.body.new_address);

    // Send success status (we don't have to wait until the email is sent)
    res.send(apiResponse(ApiResponseStatus.success));

    // Send email verification email
    Mail.send(req.body.new_address,
        "Email change verification",
        MailTemplates.email_change(email_verification_token));
}
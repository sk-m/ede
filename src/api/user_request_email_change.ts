import * as User from "../user";
import * as Mail from "../mail";
import * as MailTemplates from "../mail_templates";
import { apiSendError, apiSendSuccess } from "../api";
import { Rejection, RejectionType } from "../utils";

export async function requestUserEmailChangeRoute(req: any, res: any, client_user?: User.User): Promise<void> {
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

    // Check new address
    if(!req.body.new_address.match(/^[A-Za-z0-9_@\.-]{6,128}$/)) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "Invalid email address format"));
        return;
    }

    // Check if outbound email is enabled
    // TODO @cleanup we can just put this in .reject() of Mail.send
    if(!Mail.checkEnabled()) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_OTHER, "Outbound email is disabled"));
        return;
    }

    // Create an email_change token
    const email_verification_token = await User.createEmailToken(client_user.id, "email_change", req.body.new_address);

    // Send success status (we don't have to wait until the email is sent)
    apiSendSuccess(res);

    // Send email verification email
    Mail.send(req.body.new_address,
        "Email change verification",
        MailTemplates.email_change(email_verification_token));
}
import fs from "fs";

import * as User from "../user";
import * as Page from "../page";
import * as F2A from "../f2a";
import { UI_CHECKBOX_SVG } from "../constants";
import { sql } from "../server";

async function page_account(client: User.User): Promise<string> {
    const email_text = `\
<div><div class="status-text ${ client.email_verified ? "c-blue" : "c-red" }">
<i class="fas fa-${ client.email_verified ? "check" : "exclamation" }-circle"></i>
${ client.email_address }
</div></div>`;

    // check if user has f2a enabled
    const is_f2a_enabled = (await F2A.check(parseInt(client.id, 10))).enabled;
    let f2a_text;

    if(is_f2a_enabled) {
        f2a_text = `\
        <div><div class="status-text c-green">
        <i class="fas fa-check"></i>Enabled</div></div>
        <button class="ui-button1" data-action="disable_f2a">Disable 2FA</button>`;
    } else {
        f2a_text = `\
        <div><div class="status-text c-orange">
        <i class="fas fa-exclamation-circle"></i>Not enabled</div></div>
        <button class="ui-button1" data-action="setup_f2a">Set up 2FA</button>`;
    }

    // Detect problems
    let problems_html = "";

    if(!client.email_verified) {
        problems_html += "<li>Your email address is not verified. Account restoration will not be possible!</li>"
    }

    return `\
        <div class="settings-category" data-category="account" shown>
            ${ problems_html ?
            `<div class="ui-info-box c-orange bigger-margin">
                <div class="icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="text">
                    <p>There are some problems with your account.</p>
                    <p>
                        Found problems:
                        <ul>${ problems_html }</ul>
                    </p>
                </div>
            </div>` : "" }

            <div class="settings-heading">Credentials and logging in</div>
            <div class="settings-item">
                <div class="key-value">
                    <div class="key">
                        <div>Username</div>
                    </div>
                    <div class="value">
                        <div class="ui-text monospace" style="font-size: 14px">${ client.username }</div>
                    </div>
                </div>
            </div>
            <div class="settings-item">
                <div class="key-value">
                    <div class="key">
                        <div>Password</div>
                        <div class="item-description ui-text">You can easilly change your password if you know your current one. If you forgot your current password, you can <a href="/System:ResetUserPassword">reset</a> it.</div>
                    </div>
                    <div class="value">
                        <button class="ui-button1" data-action="update_password">Change password</button>
                    </div>
                </div>
            </div>
            <div class="settings-item">
                <div class="key-value">
                    <div class="key">
                        <div>Email address</div>
                        <div class="item-description">It is recommended to use a <i>non-public</i> email address as it is used for password restoration.<br><br><i class="icon far fa-eye-slash"></i> Your email address is only visible to you.</div>
                    </div>
                    <div class="value">
                        ${ email_text }

                        <button class="ui-button1" data-action="change_email">Change email address</button>
                    </div>
                </div>
            </div>
            <div class="settings-item">
                <div class="key-value">
                    <div class="key">
                        <div>Two-factor authentication</div>
                        <div class="item-description">Enabling two-factor authentication significantly increases the security of your account. It is highly recommended that you turn it on.</div>
                    </div>
                    <div class="value">
                        ${ f2a_text }
                    </div>
                </div>
            </div>
            <div class="settings-item">
                <div class="item-name">Strict login protection</div>
                <div class="item-value">
                    <div input class="ui-checkbox-1 disabled">
                        <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
                        <div class="text">Enable</div>
                    </div>
                </div>
                <div class="item-description">
                    <p>Require scricter checks upon logging in to your account from new browsers/locations. Recommended for users with advanced rights.</p>
                    <p>If enabled, you will <i>not</i> be able to log in using your username, as you will be required to use your email address instead. Also, additional checks like email verification will be necessary upon logging in from different browsers or locations.</p>
                </div>
            </div>

            <div class="settings-heading">Password reset options</div>
            <div class="settings-item">
                <div class="item-name">Require valid email address for password restoration</div>
                <div class="item-value">
                    <div input class="ui-checkbox-1 disabled">
                        <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
                        <div class="text">Enable</div>
                    </div>
                </div>
                <div class="item-description">If disabled, anyone can initiate a password restoration by only knowing your username. It is still safe, because you will need access to your email address to reset the password, but if you are a potential target for attacks, it is recommended to enable this option to reduce the number of malicius password reset emails.</div>
            </div>
            <div class="settings-item">
                <div class="item-name">Require 2FA code for password restoration</div>
                <div class="item-value">
                    <div input class="ui-checkbox-1 disabled">
                        <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
                        <div class="text">Enable</div>
                    </div>
                </div>
                <div class="item-description">If enabled, a two-factor authentication code will also be necessary to reset the password.</div>
            </div>
        </div>
    `;
}

export async function userSettings(page: Page.ResponsePage, client: User.User): Promise<Page.ResponsePage> {
    return new Promise(async (resolve: any) => {
        // Set some info items
        page.info.hiddentitle = true;
        page.info.nocontainer = true;

        // Load css
        const page_css = fs.readFileSync("./static/UserSettings/styles.css", "utf8");
        page.additional_css = [page_css];

        // User is not logged in
        if(!client) {
            page.parsed_content = `\
<div class="ui-systempage-header-box">
    <div class="title-container">
        <div class="icon"><i class="fas fa-cog"></i></div>
        <div class="title">User Settings</div>
    </div>
</div>

<div id="systempage-usersettings-root">
    <div class="notice">
        <div class="ui-info-box c-orange">
            <div class="icon"><i class="fas fa-exclamation-triangle"></i></div>
            <div class="text">You have to be logged in to change your settings.</div>
        </div>
    </div>
</div>`;

            resolve(page);
            return;
        }

        // Load JS
        const page_js = fs.readFileSync("./static/UserSettings/script.js", "utf8");
        page.additional_js = [page_js];

        // Check email_token_action
        if(page.address.query.email_token_action && page.address.query.email_token) {
            // User wants to change their email address
            if(page.address.query.email_token_action === "change_email") {
                const verification_result = await User.checkEmailToken(parseInt(client.id, 10), page.address.query.email_token, "email_change");

                // TODO @hack @cleanup page.additional_js.push
                if(verification_result[0]) {
                    // Update the user
                    await sql.promise().execute("UPDATE `users` SET `email_verified` = 1, `email_address` = ? WHERE id = ?",
                    [verification_result[1], client.id]);

                    // Get the new user
                    client = await User.getById(parseInt(client.id, 10));

                    page.additional_js.push(`ede_onready.push(() => { \
ede.showNotification("useremailchange-success", "New email verified", "Your email address was successfully changed.");
ede.clearURLParams();\
});`);
                } else {
                    page.additional_js.push(`ede_onready.push(() => { ede.showNotification("useremailchange-error", "Email not changed", "Some error occured.", "error") });`);
                }
            }

            // User wants to verify email address
            else if(page.address.query.email_token_action === "verify_email") {
                const verification_result = await User.checkEmailToken(parseInt(client.id, 10), page.address.query.email_token, "email_verification");

                // TODO @hack @cleanup page.additional_js.push
                if(verification_result[0]) {
                    // Token is correct, check sent_to
                    if(verification_result[1] !== client.email_address) {
                        page.additional_js.push(`ede_onready.push(() => { ede.showNotification("useremailverification-error", "Email not verified", "Some error occured.", "error") });`);
                    } else {
                        // Everything is correct, update the user
                        await sql.promise().execute("UPDATE `users` SET `email_verified` = 1 WHERE id = ?",
                        [client.id]);

                        // Get the new user
                        client = await User.getById(parseInt(client.id, 10));

                        page.additional_js.push(`ede_onready.push(() => { \
    ede.showNotification("useremailverification-success", "Email verified", "Your email address was successfully verified.");
    ede.clearURLParams();\
    });`);
                    }
                } else {
                    page.additional_js.push(`ede_onready.push(() => { ede.showNotification("useremailverification-error", "Email not verified", "Some error occured.", "error") });`);
                }
            }
        }

        page.parsed_content = `\
<div class="ui-systempage-header-box">
    <div class="title-container">
        <div class="icon"><i class="fas fa-cog"></i></div>
        <div class="title">User Settings</div>
    </div>
</div>

<div id="systempage-usersettings-root">
    <div class="categories-container">
        <div class="item" data-category="account"><i class="fas fa-shield-alt"></i> Account & Security</div>
        <div class="item" data-category="editing"><i class="fas fa-pen"></i> Editing</div>
        <div class="item" data-category="notifications"><i class="fas fa-bell"></i> Notifications</div>
        <div class="item" data-category="sessions"><i class="fas fa-desktop"></i> Sessions</div>
    </div>

    <div class="settings-root">
        ${ await page_account(client) }
    </div>
</div>`;

        resolve(page);
    });
}
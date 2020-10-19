import fs from "fs";

import * as User from "../user";
import * as Page from "../page";
import * as SystemMessages from "../system_message";
import { UI_CHECKBOX_SVG } from "../constants";

function page_account(client: User.User): string {
    const email_text = `\
<div class="ui-text w-icon roboto">
<div class="icon ${ client.email_verified ? "green" : "red" }"><i class="fas fa-${ client.email_verified ? "check" : "exclamation" }-circle"></i></div>
${ client.email_address } <i style="margin-left: 0.5ch">(${ client.email_verified ? "verified" : "not verified" })</i>
</div>`;

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
                    <p>There are some problems with your account's security.</p>
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
                        <!-- <div class="ui-text w-icon roboto"><div class="icon blue"><i class="fas fa-info-circle"></i></div> Last changed on 01.01.2020</div> -->

                        <button class="ui-button1">Change password</button>
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

                        <button class="ui-button1">Change email address</button>
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
                        <div class="ui-text w-icon roboto"><div class="icon red"><i class="fas fa-exclamation-circle"></i></div>Not enabled</div>

                        <button class="ui-button1">Set up</button>
                    </div>
                </div>
            </div>
            <div class="settings-item">
                <div class="item-name">Disallow logging in using a username</div>
                <div class="item-value">
                    <div input class="ui-checkbox-1 disabled">
                        <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
                        <div class="text">Enable</div>
                    </div>
                </div>
                <div class="item-description">If enabled, you will need to enter your email address instead of a username to log in. This increases the security of your account a bit.</div>
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

        page.parsed_content = `\
<div class="ui-systempage-header-box">
    <div class="title-container">
        <div class="icon"><i class="fas fa-cog"></i></div>
        <div class="title">User Settings</div>
    </div>
</div>

<div id="systempage-usersettings-root">
    <div class="categories-container">
        <div class="item"><i class="fas fa-shield-alt"></i> Account & Security</div>
        <div class="item"><i class="fas fa-bell"></i> Notifications</div>
        <div class="item"><i class="fas fa-desktop"></i> Sessions</div>
    </div>

    <div class="settings-root">
        ${ page_account(client) }
    </div>
</div>`;

        resolve(page);
    });
}
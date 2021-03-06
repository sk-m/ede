import * as Page from "./page";
import * as User from "./user";
import * as Log from "./log";
import * as Util from "./utils";
import * as UI from "./ui";
import * as SystemMessages from "./system_message";
import { systempageBuilder } from "./systempage";
import { GroupsAndRightsObject, GroupsObject } from "./right";
import { registry_usergroups } from "./registry";
import { UI_CHECKBOX_SVG } from "./constants";

function profile_page(target_user: User.User, client: User.User): string {
    if(!target_user.stats) return "some error occured!";

    const stat_createdon = new Date(target_user.stats.created_on * 1000).toUTCString();

    return `\
<div class="ui-form-box no-title ui-keyvalue-container">
    <div class="item">
        <div class="key">Joined on</div>
        <div class="value">${ stat_createdon } (${ Util.formatTimeString(target_user.stats.created_on) })</div>
    </div>
</div>`;
}

async function groups_page(target_user: User.User, client: User.User, client_rights?: GroupsAndRightsObject, target_grouprights?: GroupsAndRightsObject): Promise<string> {
    return new Promise(async (resolve: any) => {
        const log_entries = await Log.getEntries("usergroupsupdate", undefined, target_user.id);

        if(target_grouprights) {
            let client_can_modify_groups = false;

            let client_modifiable_groups_add: string[] = [];
            let client_modifiable_groups_remove: string[] = [];

            if(client && client_rights && client_rights.rights.modifyusergroupmembership) {
                client_can_modify_groups = true;

                // Add
                client_modifiable_groups_add = client_rights.rights.modifyusergroupmembership.add;

                // Remove
                client_modifiable_groups_remove = client_rights.rights.modifyusergroupmembership.remove;
            }

            // Construct HTML
            let checkboxes_html = "";

            // TODO we should use Typescript's utility types more often
            const registry_usergroups_snapshot: Readonly<GroupsObject> = registry_usergroups.get();

            const sysmsgs_query_arr: string[] = [];

            // Query all needed system messages
            // tslint:disable-next-line: forin
            for(const group_name in registry_usergroups_snapshot) {
                sysmsgs_query_arr.push(`usergroup-${ group_name }-name`);
            }

            sysmsgs_query_arr.push("usergroupmembership-toptext");
            sysmsgs_query_arr.push("usergroupmembership-savetext");

            const sysmsgs = await SystemMessages.get_value(sysmsgs_query_arr, false, false);

            // For every available group
            for(const group_name in registry_usergroups_snapshot) {
                if(registry_usergroups_snapshot[group_name]) {
                    let is_modifiable = false;

                    const group_already_assigned = target_grouprights.groups.includes(group_name);

                    if(group_already_assigned) {
                        // Check if client can remove the group (target already in group)
                        if( client_modifiable_groups_remove.includes(group_name) ||
                            client_modifiable_groups_remove.includes("*")
                        ) {
                            is_modifiable = true;
                        }
                    } else {
                        // Check if client can add the group (target is not in the group)
                        if( client_modifiable_groups_add.includes(group_name) ||
                            client_modifiable_groups_add.includes("*")
                        ) {
                            is_modifiable = true;
                        }
                    }

                    checkboxes_html += `\
<div input class="ui-checkbox-1${ is_modifiable ? "" : " disabled" }" name="group;${ group_name }" \
data-checked="${ group_already_assigned ? "true" : "false" }">
<div class="checkbox">${ UI_CHECKBOX_SVG }</div>
<div class="text">\
    ${ sysmsgs[`usergroup-${ group_name }-name`] || `<code>${ group_name }</code>` }
    <a class="ui-text small" style="margin-left: 3px" href="/System:UserGroupManagement/${ group_name }"><i class="fas fa-arrow-right"></i></a>
</div>
</div>`;
                }
            }

            let nonexistent_groups_checkbox_included = false;

            // For every deleted group
            // For now, any user with modifyusergroups can remove deleted groups
            for(const group_name of target_grouprights.groups) {
                if(!registry_usergroups_snapshot[group_name]) {
                    if(!nonexistent_groups_checkbox_included) {
                        checkboxes_html += `\
<div input class="ui-checkbox-1 margin-top${ client_can_modify_groups ? "" : " disabled" }" name="all_nonexistent_groups" data-checked="true">
<div class="checkbox">${ UI_CHECKBOX_SVG }</div>
<div class="text">Groups that are no longer existent, but still assigned to the user (uncheck all)</div>
</div>`;

                        nonexistent_groups_checkbox_included = true;
                    }

                    checkboxes_html += `\
<div input class="ui-checkbox-1 second-level${ client_can_modify_groups ? "" : " disabled" }" data-nonexistent="true" name="group;${ group_name }" data-checked="true">
<div class="checkbox">${ UI_CHECKBOX_SVG }</div>
<div class="text"><i>${ group_name }</i></div>
</div>`;
                }
            }

            // Page is ready
            resolve(`\
<form class="ui-form-box" name="usergroupmembership-groups">
${ UI.constructFormBoxTitleBar("groups", "Groups", "Select groups this user will be a member of. Keep in mind that there could be groups that you won't be able to remove after assigning them") }

${ sysmsgs["usergroupmembership-toptext"] !== undefined ? `<div class="ui-text roboto margin-bottom">${ sysmsgs["usergroupmembership-toptext"] }</div>` : "" }

${ client_can_modify_groups ? `\
<div class="ui-text">You have permission to modify this user's groups</div>` : `<div class="ui-text">You don't have permission to modify this user's groups</div>` }
<div class="ui-form-container column margin-top">${ checkboxes_html }</div>
</form>

${ client_can_modify_groups ? `<form class="ui-form-box" name="usergroupmembership-save">
${ UI.constructFormBoxTitleBar("save", "Save") }

<div input-container class="ui-input-box">
    <div popup class="popup"></div>
    <div class="ui-input-name1">Summary</div>

    <div input class="ui-input-dropdown1" editable name="summary" data-handler="summary">
        <input type="text">
        <div class="arrow-icon"><i class="fas fa-chevron-down"></i></div>
        <div class="choices">
            <div class="choice">Trusted user</div>
            <div class="choice">Per [[System:Diff/_____|discussion]]</div>
            <div class="choice">Per [[System:Diff/_____|request]]</div>
            <div class="choice">Per request</div>
        </div>
    </div>
</div>
<div class="ui-form-container between margin-top">
<div class="ui-text">${ sysmsgs["usergroupmembership-savetext"] }</div>
<button name="submit" class="ui-button1"><i class="fas fa-check"></i> Save groups</button>
</div>
</form>` : "" }

<div class="ui-form-box">
${ UI.constructFormBoxTitleBar("logs", "User rights log") }

<div class="ui-form-container ui-logs-container column-reverse">${ Log.constructLogEntriesHTML(log_entries) }</div>
</div>`);
        } else {
            resolve("Some error occured!");
        }
    });
}

function rename_page(target_user: User.User, client?: User.User, client_rights?: GroupsAndRightsObject): string {
    if(!client_rights || !client_rights.rights.renameuser) {
        return "You don't have permission to rename users.";
    }

    return 'rename!';
}

function block_page(target_user: User.User, client?: User.User, client_rights?: GroupsAndRightsObject): Promise<string> {
    return new Promise(async (resolve: any) => {
        if(!client_rights || !client_rights.rights.blockuser) {
            resolve("You don't have permission to block users.");
            return;
        }

        const client_can_lock_out = client_rights.rights.blockuser.allow_lockout === true;

        const log_entries = await Log.getEntries("blockuser", undefined, target_user.id);

        // Some strings
        const not_blocked_text = `\
<div class="icon"><i class="fas fa-check"></i></div><div class="text">User is not currently blocked.</div>`;

        const blocked_text = `\
<div class="icon red"><i class="fas fa-times"></i></div><div class="text">User is currently blocked${ target_user.blocks.includes("lockout") ? " and locked out" : "" }.</div>`;

    const blocked_before_text = `\
<div class="icon orange"><i class="fas fa-exclamation-triangle"></i></div><div class="text">User was blocked before.</div>`;


        resolve(`\
${ client && target_user.id === client.id ?
`<div class="ui-info-box c-orange">
    <div class="icon"><i class="fas fa-exclamation-triangle"></i></div>
    <div class="text">You are about to block yourself. Be careful!</div>
</div>` : "" }

<div class="ui-form-box no-title">
    <div class="ui-form-container ui-keyvalue-container">
        <div class="item">
            <div class="key">Current status</div>
            <div class="value ui-text w-icon">${ target_user.blocks.length === 0 ? not_blocked_text : blocked_text }</div>
        </div>
        ${ (target_user.blocks.length === 0 && log_entries.length !== 0) ?
        `<div class="item">
            <div class="key">Past blocks</div>
            <div class="value ui-text w-icon">${ blocked_before_text }</div>
        </div>` : ""}
        ${ target_user.blocks.length !== 0 ?
        `<div class="item">
            <div class="key">Current settings</div>
            <div class="value ui-text w-icon monospace">${ target_user.blocks.join(", ") }</div>
        </div>` : ""}
    </div>
</div>

<form name="blockuser-form">
    <div class="ui-form-box">
        ${ UI.constructFormBoxTitleBar("restrictions", "Access restrictions", "Select actions that will be restricted for this user") }

        <div input name="restriction;lockout" data-checked="${ target_user.blocks.includes("lockout") ? "true" : "false" }" \
        class="ui-checkbox-1${ (client_can_lock_out || target_user.blocks.includes("lockout")) ? "" : " disabled" }">
            <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
            <div class="text">Completely lock out (destroy sessions and disable logging in)</div>
        </div>

        <div input name="restriction;edit" data-checked="${ target_user.blocks.includes("edit") ? "true" : "false" }" class="ui-checkbox-1 second-level">
            <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
            <div class="text">Disallow editing</div>
        </div>

        <div input name="restriction;account_creation" data-checked="${ target_user.blocks.includes("account_creation") ? "true" : "false" }" class="ui-checkbox-1" style="margin-top: 1em">
            <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
            <div class="text">Disallow creating new accounts</div>
        </div>
    </div>

    <div class="ui-form-box">
        ${ UI.constructFormBoxTitleBar("block", "Block") }

        <div input-container class="ui-input-box">
            <div popup class="popup"></div>
            <div class="ui-input-name1">Reason</div>

            <div input class="ui-input-dropdown1" editable name="summary" data-handler="summary">
                <input type="text">
                <div class="arrow-icon"><i class="fas fa-chevron-down"></i></div>
                <div class="choices">
                    <div class="choice">Inappropriate behaviour</div>
                    <div class="choice">Inactive account</div>
                    <div class="choice">Per [[System:Diff/_____|discussion]]</div>
                    <div class="choice">Per [[System:Diff/_____|request]]</div>
                    <div class="choice">Per request</div>
                </div>
            </div>
        </div>

        <div class="ui-form-container between margin-top">
            <div class="ui-form-container no-margin">
            <div input name="confirm_checkbox" class="ui-checkbox-1 red">
                <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
                <div class="text">Confirm block</div>
            </div>
            <div input name="confirm_lockout_checkbox" class="ui-checkbox-1 red" style="margin-left: 14px; visibility: hidden">
                <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
                <div class="text">Confirm lockout</div>
            </div>
            </div>
            <button name="submit" class="ui-button1 c-red disabled">Block user</button>
        </div>
    </div>
</form>

<div class="ui-form-box">
${ UI.constructFormBoxTitleBar("logs", "Block logs for this user") }

<div class="ui-form-container ui-logs-container column-reverse">${ Log.constructLogEntriesHTML(log_entries) }</div>
</div>
        `);
    });
}

function unblock_page(target_user: User.User, client?: User.User, client_rights?: GroupsAndRightsObject): string {
    if(!client_rights || !client_rights.rights.blockuser) {
        return "You don't have permission to unblock users.";
    }

    return 'unblock!';
}

export async function userNamespaceHandler(address: Page.PageAddress, client: User.User): Promise<Page.ResponsePage> {
    return new Promise(async (resolve: any) => {
        const username = address.root_name;

        let page: Page.ResponsePage = {
            address,

            display_title: username,

            additional_css: [],
            additional_js: [],

            badges: [],

            info: {},

            status: []
        };

        const page_config: Page.SystempageConfig = {
            page,

            breadcrumbs_data: [ ["User", "fas fa-user-cog"], [username, "fas fa-user", `/User:${ username }`], ],

            body_html: ""
        }

        // Get user
        let queried_user_error: Util.Rejection | false = false;

        const queried_user = await User.getFromUsername(username).catch((error: Util.Rejection) => { queried_user_error = error });

        if(!queried_user_error && queried_user) {
            // Get queried user's groups
            // TODO just get the groups, we don't need the rights
            const queried_user_groups = await User.getRights(queried_user.id);

            // Get blocked status
            const queried_user_blocked = queried_user.blocks.length !== 0;

            let client_groups;

            // Get client's groups
            if(client) {
                client_groups = await User.getRights(client.id).catch(() => undefined);
            }

            // Create a list of groups, assigned to target user
            let header_body = "";

            for(const group_name of queried_user_groups.groups) {
                header_body += `<a href="/System:UserGroupManagement/${ group_name }" class="item" \
title="This user is a member of the ${ group_name } group. Click to see the group.">${ group_name }</a>`;
            }

            // Indicate that the user is blocked
            if(queried_user_blocked) {
                header_body += `<div class="item c-red" title="This user is currently blocked (${ queried_user.blocks.join(", ") })"><i class="fas fa-minus-circle"></i> Blocked</div>`;
            }

            page_config.header_config = {
                icon: "fas fa-user",
                title: username,
                body: header_body ? `<div class="tags">${ header_body }</div>` : ""
            };

            page_config.sidebar_config = {
                links: [
                    {
                        type: "heading",
                        text: "Navigation"
                    },
                    {
                        type: "link",
                        icon: "fas fa-info-circle",
                        text: "Profile",
                        href: `/User:${ queried_user.username }`
                    },
                    {
                        type: "link",
                        icon: "fas fa-users-cog",
                        text: "View/change user's groups",
                        href: `/User:${ queried_user.username }/groups`
                    }
                ]
            }

            if(client_groups) {
                // Rename user button
                if(client_groups.rights.renameuser) {
                    page_config.sidebar_config.links.push({
                        type: "link",
                        icon: "fas fa-user-tag",
                        text: "Rename user",
                        disabled: !(client_groups && client_groups.rights.renameuser),
                        href: `/User:${ queried_user.username }/rename`
                    });
                }

                if(client_groups.rights.blockuser) {
                    // Block user button
                    page_config.sidebar_config.links.push({
                        type: "link",
                        icon: "fas fa-user-lock",
                        text: (queried_user_blocked ? "Change block settings" : "Block user"),
                        additional_classes: (queried_user_blocked ? "" : "red"),
                        href: `/User:${ queried_user.username }/block`
                    });

                    // Unblock user button
                    if(queried_user_blocked) {
                        page_config.sidebar_config.links.push({
                            type: "link",
                            icon: "fas fa-unlock",
                            text: "Unblock user",
                            href: `/User:${ queried_user.username }/unblock`
                        });
                    }
                }
            }

            switch(address.url_params[1]) {
                case "groups": {
                    // Get the files
                    const page_files = await Page.getPageFiles("User:", {
                        group_membership_js: "./static/User/group_membership.js"
                    });

                    page.additional_js = [page_files.group_membership_js];

                    page_config.breadcrumbs_data.push(["Manage groups"]);
                    page_config.body_html = await groups_page(queried_user, client, client_groups || undefined, queried_user_groups || undefined);
                } break;
                case "rename": {
                    page_config.breadcrumbs_data.push(["Rename"]);
                    page_config.body_html = rename_page(queried_user, client, client_groups || undefined);
                } break;
                case "block": {
                    // Get the files
                    const page_files = await Page.getPageFiles("User:", {
                        block_js: "./static/User/block.js"
                    });

                    page.additional_js = [page_files.block_js];

                    page_config.breadcrumbs_data.push(["Block"]);
                    page_config.body_html = await block_page(queried_user, client, client_groups || undefined);
                } break;
                case "unblock": {
                    page_config.breadcrumbs_data.push(["Unblock"]);
                    page_config.body_html = unblock_page(queried_user, client, client_groups || undefined);
                } break;
                default: {
                    page_config.breadcrumbs_data.push(["Profile"]);
                    page_config.body_html = profile_page(queried_user, client);
                }
            }
        } else {
            page_config.header_config = {
                icon: "fas fa-user",
                title: username,
                description: "Some error occured"
            };
        }

        // Build a page
        page = systempageBuilder(page_config);
        resolve(page);
    });
}

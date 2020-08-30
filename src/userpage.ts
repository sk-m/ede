import fs from "fs";

import * as Page from "./page";
import * as User from "./user";
import * as Log from "./log";
import * as Util from "./utils";
import * as UI from "./ui";
import { systempageBuilder } from "./systempage";
import { GroupsAndRightsObject, GroupsObject } from "./right";
import { registry_usergroups } from "./registry";
import { UI_CHECKBOX_SVG } from "./constants";

function profile_page(target_user: User.User, client: User.User): string {
    return "profile!";
}

async function groups_page(target_user: User.User, client: User.User, client_rights?: GroupsAndRightsObject): Promise<string> {
    return new Promise(async (resolve: any) => {
        const log_entries = await Log.getEntries("usergroupsupdate", undefined, target_user.id);

        // Get groups for target user
        User.getUserGroupRights(target_user.id)
        .then(async (target_grouprights: GroupsAndRightsObject) => {
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

                    // TODO Replace group_name in .text element with the real name of the group that is user configurable via
                    // System Messages

                    checkboxes_html += `\
<div input class="ui-checkbox-1${ is_modifiable ? "" : " disabled" }" name="group;${ group_name }" \
data-checked="${ group_already_assigned ? "true" : "false" }">
<div class="checkbox">${ UI_CHECKBOX_SVG }</div>
<div class="text">${ group_name }</div>
</div>`;
                }
            }

            // Page is ready
            resolve(`\
<div id="usergroupmembership-result-status-container" class="ui-form-box hidden">
<div class="ui-text"></div>
</div>

<form class="ui-form-box" name="usergroupmembership-groups">
${ UI.constructFormBoxTitleBar("groups", "Groups") }

${ client_can_modify_groups ? `\
<div class="ui-text">You have permission to modify this user's groups</div>
<div class="ui-form-container column margin-top">${ checkboxes_html }</div>`
: `<div class="ui-text">You don't have permission to modify this user's groups</div>` }
</form>

${ client_can_modify_groups ? `<form class="ui-form-box" name="usergroupmembership-save">
${ UI.constructFormBoxTitleBar("save", "Save") }

<div class="ui-input-box">
<div class="popup"></div>
<div class="ui-input-name1">Summary</div>
<input type="text" name="summary" data-handler="summary" class="ui-input1">
</div>
<div class="ui-form-container right margin-top">
<button name="submit" class="ui-button1"><i class="fas fa-check"></i> Save groups</button>
</div>
</form>` : "" }

<div class="ui-form-box">
${ UI.constructFormBoxTitleBar("logs", "User rights log") }

<div class="ui-form-container ui-logs-container column-reverse">${ Log.constructLogEntriesHTML(log_entries) }</div>
</div>`);
        })
        .catch((error: any) => {
            Util.log(`Error occured trying to get groups and rights for user id ${ target_user.id }`, 3, error);
            resolve("Some error occured!");
        });
    });
}

function rename_page(target_user: User.User, client?: User.User, client_rights?: GroupsAndRightsObject): string {
    if(!client_rights || !client_rights.rights.renameuser) {
        return "You don't have permission to rename users.";
    }

    return 'rename!';
}

function block_page(target_user: User.User, client?: User.User, client_rights?: GroupsAndRightsObject): string {
    if(!client_rights || !client_rights.rights.blockuser) {
        return "You don't have permission to block users.";
    }

    return 'block!';
}

export async function userNamespaceHandler(address: Page.PageAddress, client: User.User): Promise<Page.ResponsePage> {
    return new Promise(async (resolve: any) => {
        let page: Page.ResponsePage = {
            address,

            display_title: address.name,

            additional_css: [],
            additional_js: [],

            badges: [],

            info: {},

            status: []
        };

        const page_config: Page.SystempageConfig = {
            page,

            breadcrumbs_data: [ ["User", "fas fa-user-cog"], [address.name, "fas fa-user", `/User:${ address.name }`], ],

            body_html: ""
        }

        // Get user
        let queried_user_error = false;

        const queried_user = await User.getFromUsername(address.name).catch(error => { queried_user_error = error });

        if(queried_user && !queried_user_error) {
            // Get user's groups
            const queried_user_groups = await User.getUserGroupRights(queried_user.id);

            let client_logged_in = true;
            let client_groups;

            // Get client's groups
            if(client) {
                client_groups = await User.getUserGroupRights(client.id).catch(() => { client_logged_in = false });
            } else {
                client_logged_in = false;
            }

            // Create a list of groups, assigned to target user
            let queried_user_groups_list = "";

            for(const group_name of queried_user_groups.groups) {
                queried_user_groups_list += `<div class="item">${ group_name }</div>`;
            }

            page_config.header_config = {
                icon: "fas fa-user",
                title: address.name,
                body: queried_user_groups_list ? `<div class="tags">${ queried_user_groups_list }</div>` : ""
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

                // Block user button
                if(client_groups.rights.blockuser) {
                    page_config.sidebar_config.links.push({
                        type: "link",
                        icon: "fas fa-minus-circle",
                        text: "Block user",
                        additional_classes: "red",
                        href: `/User:${ queried_user.username }/block`
                    });
                }
            }

            switch(address.url_params[1]) {
                case "groups": {
                    const page_js = fs.readFileSync("./content/pages/User/UserGroupMembership/script.js", "utf8");

                    page_config.page.additional_js = [page_js];

                    page_config.breadcrumbs_data.push(["Manage groups"]);
                    page_config.body_html = await groups_page(queried_user, client, client_groups || undefined);
                } break;
                case "rename": {
                    page_config.breadcrumbs_data.push(["Rename"]);
                    page_config.body_html = rename_page(queried_user, client, client_groups || undefined);
                } break;
                case "block": {
                    page_config.breadcrumbs_data.push(["Block"]);
                    page_config.body_html = block_page(queried_user, client, client_groups || undefined);
                } break;
                default: {
                    page_config.breadcrumbs_data.push(["Profile"]);
                    page_config.body_html = profile_page(queried_user, client);
                }
            }
        } else {
            page_config.header_config = {
                icon: "fas fa-user",
                title: address.name,
                description: queried_user_error || "Some error occured"
            };
        }

        // Build a page
        page = systempageBuilder(page_config);
        resolve(page);
    });
}

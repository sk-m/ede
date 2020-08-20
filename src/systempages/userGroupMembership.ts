import fs from "fs";

import * as Page from "../page";
import * as User from "../user";
import * as Util from "../utils";
import * as Log from "../log";
import * as UI from "../ui";
import { registry_usergroups } from "../registry";
import { UI_CHECKBOX_SVG } from "../constants";
import { GroupsAndRightsObject, GroupsObject } from "../right";

export async function userGroupMembership(page: Page.ResponsePage, client: User.User): Promise<Page.ResponsePage> {
    return new Promise((resolve: any) => {
        const queried_username = page.address.url_params[1];

        // Load css and js files for this system page
        const page_js = fs.readFileSync("./content/pages/System/UserGroupMembership/script.js", "utf8");
        const page_css = fs.readFileSync("./content/pages/System/UserGroupMembership/styles.css", "utf8");

        page.additional_js = [page_js];
        page.additional_css = [page_css];

        // TODO bad system
        page.info.hidetitle = {
            display_name: "Hidden title",

            value_type: "boolean",
            value: true,

            source: "ede"
        }

        page.info.nocontainer = {
            display_name: "No container",

            value_type: "boolean",
            value: true,

            source: "ede"
        }

        // Check if username was provided
        if(!queried_username) {
            // Construct breadcrumbs HTML
            const breadcrumbs_html = UI.constructSystempageBreadcrumbs([
                ["User Group Membership", "fas fa-user-cog", "/System:UserGroupMembership"]
            ]);

            page.parsed_content = `\
${ breadcrumbs_html }
<div class="ui-systempage-header-box">
    <div class="title-container">
        <div class="icon"><i class="fas fa-user-cog"></i></div>
        <div class="title">User Group Membership</div>
    </div>
    <div class="text">Please, select a user</div>
</div>

<div id="systempage-usergroupmembership-content">
    <div id="usergroupmembership-result-status-container" class="ui-form-box hidden">
        <div class="ui-text"></div>
    </div>

    <form class="ui-form-box" name="usergroupmembership-query">
        ${ UI.constructFormBoxTitleBar("query", "User query") }

        <div class="ui-input-box">
            <div class="popup"></div>
            <div class="ui-input-name1">Username</div>
            <input type="text" value="${ queried_username || "" }" name="username" data-handler="username" class="ui-input1">
        </div>
        <div class="ui-form-container right margin-top">
            <button name="submit" class="ui-button1"><i class="fas fa-search"></i> Get groups</button>
        </div>
    </form>
</div>`;

            resolve(page);
            return;
        } else {
            // Get queried user
            User.getFromUsername(queried_username)
            .then(async (queried_user: User.User) => {
                const log_entries = await Log.getEntries("usergroupsupdate", undefined, queried_user.id);

                // Get groups for queried user
                User.getUserGroupRights(queried_user.id)
                .then(async (target_grouprights: GroupsAndRightsObject) => {
                    let client_can_modify_groups = false;

                    let client_modifiable_groups_add: string[] = [];
                    let client_modifiable_groups_remove: string[] = [];

                    if(client) {
                        // Get rights for client user
                        await User.getUserGroupRights(client.id)
                        .then((client_grouprights: any) => {
                            const client_rights = client_grouprights.rights;

                            if(client_rights.modifyusergroupmembership) {
                                client_can_modify_groups = true;

                                // Add
                                client_modifiable_groups_add = client_rights.modifyusergroupmembership.add;

                                // Remove
                                client_modifiable_groups_remove = client_rights.modifyusergroupmembership.remove;
                            }
                        })
                        .catch(() => undefined);
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

                    // Create a list of groups, assigned to target user
                    let targetuser_groups_list = "";

                    for(const group_name of target_grouprights.groups) {
                        targetuser_groups_list += `<div class="item">${ group_name }</div>`;
                    }

                    // Construct breadcrumbs HTML
                    const breadcrumbs_html = UI.constructSystempageBreadcrumbs([
                        ["User Group Membership", "fas fa-user-cog", "/System:UserGroupMembership"],
                        [queried_user.username, "fas fa-user"],
                    ]);

                    // Groups form
                    page.parsed_content = `\
${ breadcrumbs_html }
<div class="ui-systempage-header-box">
    <div class="title-container">
        <div class="icon"><i class="fas fa-user-cog"></i></div>
        <div class="title">${ queried_user.username }</div>
    </div>
    ${ targetuser_groups_list ? `<div class="tags">${ targetuser_groups_list }</div>` : "" }
</div>

<div id="systempage-usergroupmembership-content">
<div id="usergroupmembership-result-status-container" class="ui-form-box hidden">
    <div class="ui-text"></div>
</div>

<form class="ui-form-box" name="usergroupmembership-query">
    ${ UI.constructFormBoxTitleBar("query", "User query") }

    <div class="ui-input-box">
        <div class="popup"></div>
        <div class="ui-input-name1">Username</div>
        <input type="text" value="${ queried_username || "" }" name="username" data-handler="username" class="ui-input1">
    </div>
    <div class="ui-form-container right margin-top">
        <button name="submit" class="ui-button1"><i class="fas fa-search"></i> Get groups</button>
    </div>
</form>

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
</div></div>`;

                    resolve(page);
                })
                .catch((error: any) => {
                    Util.log(`Error occured trying to get groups and rights for user id ${ queried_user.id }`, 3, error);
                });
            })
            .catch(() => {
                // Nonexistent user
                const breadcrumbs_html = UI.constructSystempageBreadcrumbs([
                    ["User Group Membership", "fas fa-user-cog", "/System:UserGroupMembership"]
                ]);

                page.parsed_content = `\
${ breadcrumbs_html }
<div class="ui-systempage-header-box">
    <div class="title-container">
        <div class="icon"><i class="fas fa-user-cog"></i></div>
        <div class="title">User Group Membership</div>
    </div>
    <div class="text">Please, select a user</div>
</div>

<div id="systempage-usergroupmembership-content">
    <div id="usergroupmembership-result-status-container" class="ui-form-box hidden">
        <div class="ui-text"></div>
    </div>

    <form class="ui-form-box" name="usergroupmembership-query">
        ${ UI.constructFormBoxTitleBar("query", "User query") }

        <div class="ui-input-box">
            <div class="popup"></div>
            <div class="ui-input-name1">Username</div>
            <input type="text" value="${ queried_username || "" }" name="username" data-handler="username" class="ui-input1">
        </div>
        <div class="ui-form-container right margin-top">
            <button name="submit" class="ui-button1"><i class="fas fa-search"></i> Get groups</button>
        </div>
    </form>

    <div class="ui-text">Such user does not exist!</div>
</div>`;

                resolve(page);
                return;
            });
        }
    });
}

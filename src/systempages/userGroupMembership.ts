import fs from "fs";

import * as Page from "../page";
import * as User from "../user";
import * as Util from "../utils";
import { registry_usergroups } from "../registry";
import { UI_CHECKBOX_SVG } from "../constants";
import { GroupsAndRightsObject, GroupsObject } from "../right";

export async function userGroupMembership(page: Page.ResponsePage, client: User.User): Promise<Page.ResponsePage> {
    return new Promise((resolve: any) => {
        const queried_username = page.address.url_params[1];

        // Load css and js files for this system page
        const page_js = fs.readFileSync("./content/pages/System/UserGroupMembership/script.js", "utf8");
        page.additional_js = [page_js];

        // Query form
        page.parsed_content = `\
<div id="usergroupmembership-result-status-container" class="ui-form-box hidden">
    <div class="ui-text"></div>
</div>

<form class="ui-form-box" name="usergroupmembership-query">
    <div class="ui-input-box">
        <div class="popup"></div>
        <div class="ui-input-name1">Username</div>
        <input type="text" value="${ queried_username || "" }" name="username" data-handler="username" class="ui-input1">
    </div>
    <div class="ui-form-container right margin-top">
        <button name="submit" class="ui-button1">Get groups</button>
    </div>
</form>`;

        // TODO @sysmsg
        if(queried_username) {
            // Get queried user
            User.getFromUsername(queried_username)
            .then((queried_user: User.User) => {
                // Get groups for queried user
                User.getUserGroupRights(queried_user.id)
                .then(async (target_grouprights: GroupsAndRightsObject) => {
                    let client_can_modify_groups = false;
                    let client_modifiable_groups: string | string[] = [];
                    let client_can_modify_all = false;

                    if(client) {
                        // Get rights for client user
                        await User.getUserGroupRights(client.id)
                        .then((client_grouprights: any) => {
                            const client_rights = client_grouprights.rights;

                            if(client_rights.modifyusergroupmembership) {
                                // TODO !!! Add only for now !!!
                                client_can_modify_groups = true;

                                if(client_rights.modifyusergroupmembership.add.includes("*")) {
                                    client_can_modify_all = true
                                } else {
                                    client_modifiable_groups = client_rights.modifyusergroupmembership.add;
                                }
                            }
                        })
                        .catch(() => undefined);
                    }

                    // Construct HTML
                    let checkboxes_html = "";

                    // TODO we should use Typescript's utility types more often
                    const registry_usergroups_snapshot: Readonly<GroupsObject> = registry_usergroups.get();
                    let is_modifiable = false;

                    // For every available group
                    for(const group_name in registry_usergroups_snapshot) {
                        if(registry_usergroups_snapshot[group_name]) {
                            if(!client_can_modify_all) {
                                is_modifiable = client_modifiable_groups.includes(group_name);
                            } else {
                                is_modifiable = true;
                            }

                            // TODO Replace group_name in .text element with the real name of the group that is user configurable via
                            // System Messages

                            // TODO-3 !!!!!!!!!!!!!!!!!!!!! WIP, all checkboxes are enabled for now
                            checkboxes_html += `\
<div class="ui-checkbox-1${ true || is_modifiable ? "" : " disabled" }" name="group;${ group_name }" \
data-checked="${ target_grouprights.groups.includes(group_name) ? "true" : "false" }">
<div class="checkbox">${ UI_CHECKBOX_SVG }</div>
<div class="text">${ group_name }</div>
</div>`;
                        }
                    }

                    // Groups form
                    page.parsed_content += `\
<form class="ui-form-box" name="usergroupmembership-groups">
<div class="ui-form-container column">
    <div class="ui-text">Changing user groups for <b><a href="/User:Max">${ queried_username }</a></b>.</div>
    <div class="ui-text">Currently a member of: <b>${ target_grouprights.groups.length > 0 ? target_grouprights.groups.join(", ") : "<i>(none)</i>" }</b>.</div>
</div>

${ client_can_modify_groups ? `\
<div class="ui-form-container column">${ checkboxes_html }</div>
<div class="ui-form-container right">
    <button name="submit" class="ui-button1">Save groups</button>
</div>` : "" }
</form>

<div class="ui-form-box">
<div class="ui-form-container">
    <div class="ui-text">User rights log for <b>${ queried_username }</b>:</div>
</div>
<div class="ui-form-container">
    <div class="ui-log-item">
        <span class="time">(30 Mar 2020, 16:04 GMT)</span>\
        <span><a href="/User:Max">Max</a> set <a href="/User:Max">Max</a>'s groups to:
        <code>sysadmin, test [<span class="green">+sysadmin</span>, <span class="red">-interfaceadmin</span>]</code></span>
        <span><i>(Test log item...)</i></span>
    </div>
</div>
</div>`;

                    resolve(page);
                })
                .catch((error: any) => {
                    Util.log(`Error occured trying to get groups and rights for user id ${ queried_user.id }`, 3, error);
                });
            })
            .catch(() => {
                // Nonexistent user
                page.parsed_content += `\
                <form class="ui-form-box" name="usergroupmembership-groups">
                    <div class="ui-form-container column">
                        <div class="ui-text">Changing user groups for <b><a href="/User:Max">${ queried_username }</a></b>.</div>
                        <div class="ui-text">Such user does not exist.</div>
                    </div>
                </form>`;

                resolve(page);
                return;
            });
        }
    });
}

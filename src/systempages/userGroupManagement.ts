import fs from "fs";

import * as Page from "../page";
import * as User from "../user";
import * as Log from "../log";
import * as UI from "../ui";
import { registry_usergroups, registry_rights } from "../registry";
import { UI_CHECKBOX_SVG } from "../constants";
import { GroupsAndRightsObject } from "../right";

export async function userGroupManagement(page: Page.ResponsePage, client: User.User): Promise<Page.ResponsePage> {
    return new Promise(async (resolve: any) => {
        const queried_group_name = page.address.url_params[1];
        let client_can_alter = false;

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

        // Load css and js files for this system page
        const page_css = fs.readFileSync("./content/pages/System/UserGroupManagement/styles.css", "utf8");
        const page_js = fs.readFileSync("./content/pages/System/UserGroupManagement/script.js", "utf8");

        page.additional_css = [page_css];
        page.additional_js = [page_js];

        // Check if client can alter requeted group
        if(client) {
            await User.getUserGroupRights(client.id)
            .then((client_rights: GroupsAndRightsObject) => {
                if(client_rights.rights.modifyusergroups) client_can_alter = true;
            })
            .catch(() => undefined);
        }

        // Check if a group name was provided
        if(!queried_group_name) {
            // Construct breadcrumbs HTML
            const breadcrumbs_html = UI.constructSystempageBreadcrumbs([
                ["User Group Management", "fas fa-users-cog", "/System:UserGroupManagement"]
            ]);

            page.parsed_content = `\
${ breadcrumbs_html }
<div class="ui-systempage-header-box">
    <div class="title-container">
        <div class="icon"><i class="fas fa-users-cog"></i></div>
        <div class="title">User Group Management</div>
    </div>
    <div class="text">Please, select a user group</div>
</div>

<div id="systempage-usergroupmanagement-content">
<form class="ui-form-box" name="usergroupmanagement-query">
    ${ UI.constructFormBoxTitleBar("query", "Group query") }

    <div class="ui-input-box">
        <div class="popup"></div>
        <div class="ui-input-name1">Group name</div>
        <input type="text" value="${ queried_group_name || "" }" name="group_name" data-handler="group_name" class="ui-input1">
    </div>
    <div class="ui-form-container right margin-top">
        <button name="submit" class="ui-button1"><i class="fas fa-search"></i> Query group</button>
    </div>
</form>

<div class="ui-text">no group provided!</div>
</div>`;

            resolve(page);
            return;
        }

        const queried_group =  registry_usergroups.get()[queried_group_name];

        // Check if queried group exists
        if(!queried_group) {
            // Construct breadcrumbs HTML
            const breadcrumbs_html = UI.constructSystempageBreadcrumbs([
                ["User Group Management", "fas fa-users-cog", "/System:UserGroupManagement"]
            ]);

            page.parsed_content = `\
${ breadcrumbs_html }
<div class="ui-systempage-header-box">
    <div class="title-container">
        <div class="icon"><i class="fas fa-users-cog"></i></div>
        <div class="title">User Group Management</div>
    </div>
    <div class="text">Please, select a user group</div>
</div>

<div id="systempage-usergroupmanagement-content">
<form class="ui-form-box" name="usergroupmanagement-query">
    ${ UI.constructFormBoxTitleBar("query", "Group query") }

    <div class="ui-input-box">
        <div class="popup"></div>
        <div class="ui-input-name1">Group name</div>
        <input type="text" value="${ queried_group_name || "" }" name="group_name" data-handler="group_name" class="ui-input1">
    </div>
    <div class="ui-form-container right margin-top">
        <button name="submit" class="ui-button1"><i class="fas fa-search"></i> Query group</button>
    </div>
</form>

<div class="ui-text">such group does not exist!</div>
</div>`;

            resolve(page);
            return;
        }

        let available_rights_html = "";
        const registry_rights_snapshot = registry_rights.get();

        // Get logs for this group
        const log_entries = await Log.getEntries("groupupdate", undefined, queried_group_name);

        // Loop through all available rigths
        for(const right_name in registry_rights_snapshot) {
            if(registry_rights_snapshot[right_name]) {
                const right = registry_rights_snapshot[right_name];
                let arguments_html = "";

                // Right takes argumens
                if(right.arguments) {
                    // Loop through all arguments
                    for(const argument_name in right.arguments) {
                        if(right.arguments[argument_name]) {
                            const argument = right.arguments[argument_name];
                            let argument_value;

                            // Get argument's current value or set to default value
                            if(queried_group.added_rights[right_name]) {
                                argument_value = queried_group.added_rights[right_name][argument_name];
                            } else {
                                argument_value = argument.default_value;
                            }

                            // Input might is an array
                            if(argument.type.includes("array")) {
                                let current_values_html = "";

                                // Check if current value is actually an array
                                if(argument_value instanceof Array) {
                                    for(const item of argument_value) {
                                        current_values_html += `<div>${ item }</div>`;
                                    }
                                }

                                arguments_html += `\
<div class="ui-form-container" style="margin-top: 5px">
    <div class="ui-input-box">
        <div class="popup"></div>
        <div class="ui-input-name1">${ argument.description } (array)</div>
        <div input class="ui-input-array1" name="right_argument;${ right_name };${ argument_name }">
            <div class="items">${ current_values_html }</div>
            <input text="text">
            <div class="buttons">
                <div title="Undo changes" class="reset-button"><i class="fas fa-undo"></i></div>
                <div title="Remove all" class="red clean-button"><i class="fas fa-trash"></i></div>
            </div>
        </div>
    </div>
</div>`;

                            } else {
                                // TODO allow boolean input types (checkboxes). Text inputs only for now
                                // TODO "string|array" input handlers are not implemented yet
                                // Create HTML snippet for single argument input
                                arguments_html += `\
<div class="ui-form-container" style="margin-top: 5px">
    <div class="ui-input-box">
        <div class="popup"></div>
        <div class="ui-input-name1">${ argument.description } (${ argument.type.join(" or ") })</div>
        <input type="text" value="${ argument_value }" name="right_argument;${ right_name };${ argument_name }" data-handler="${ argument.type.join("|") }" class="ui-input1 monospace${ client_can_alter ? "" : " disabled" }">
    </div>
</div>`;
                            }
                        }
                    }
                }

                const arguments_count = Object.keys(right.arguments).length;

                // HTML snippet for a single right (with arguments)
                available_rights_html += `\
<div class="right${ arguments_count ? " w-arguments" : "" }">
    <div class="left-container">
        <div input name="right;${ right_name }" style="width: 33%; min-width: 250px; flex-shrink: 0" class="ui-checkbox-1${ client_can_alter ? "" : " disabled" }" data-checked="${ queried_group.added_rights[right_name] ? "true" : "false" }">
            <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
            <div class="text">${ right_name }</div>
        </div>
    </div>
    <div class="right-container" style="width: 100%">
        <div class="description-container">
            <div>
                <div class="ui-text">${ right.description }</div>
                <div class="ui-text small gray i"><i class="ui-text small gray fas fa-caret-down"></i> ${ arguments_count || "no" } arguments</div>
            </div>
            <div class="icon">${ arguments_count ? '<i class="fas fa-chevron-down"></i>' : "" }</div>
        </div>
        <div class="arguments-container">
            ${ arguments_html }
        </div>
    </div>
</div>`;
            }
        }

        // Construct breadcrumbs HTML
        const breadcrumbs_html = UI.constructSystempageBreadcrumbs([
            ["User Group Management", "fas fa-users-cog", "/System:UserGroupManagement"],
            [queried_group.name, "fas fa-users"]
        ]);

        // TODO "Main information" block should be moved to the systempage header box
        page.parsed_content = `\
${ breadcrumbs_html }
<div class="ui-systempage-header-box">
    <div class="title-container">
        <div class="icon"><i class="fas fa-users-cog"></i></div>
        <div class="title">${ queried_group.name }</div>
    </div>
</div>

<div id="systempage-usergroupmanagement-content">
    <form class="ui-form-box" name="usergroupmanagement-query">
        ${ UI.constructFormBoxTitleBar("query", "Group query") }

        <div class="ui-input-box">
            <div class="popup"></div>
            <div class="ui-input-name1">Group name</div>
            <input type="text" value="${ queried_group_name || "" }" name="group_name" data-handler="group_name" class="ui-input1">
        </div>
        <div class="ui-form-container right margin-top">
            <button name="submit" class="ui-button1"><i class="fas fa-search"></i> Query group</button>
        </div>
    </form>

    <form name="usergroupmanagement" data-onsubmit="test">
        <div class="ui-form-box result-status-container hidden">
            <div class="ui-text"></div>
        </div>

        <div class="ui-form-box">
            ${ UI.constructFormBoxTitleBar("main-info", "Main information") }

            <div class="ui-form-container column">
                <div class="ui-text">Name: <i class="gray">(not set)</i> <i>(<a href="/System:SystemMessage/group-${ queried_group_name }-name">edit</a>)</i></div>
                <div class="ui-text">Short description: <i class="gray">(not set)</i> <i>(<a href="/System:SystemMessage/group-${ queried_group_name }-description">edit</a>)</i></div>
            </div>
        </div>

        <div class="ui-form-box user-group-management-rights-root">
            ${ UI.constructFormBoxTitleBar("rights", "Rights") }

            <div class="text-container">${ client_can_alter ? "You can modify rights for this group" : "You don't have permission to modify\
    rights for this group" }</div>

            <div class="rights-container">
            ${ available_rights_html }
            </div>
        </div>

        ${ client_can_alter ? `\
        <div class="ui-form-box">
            ${ UI.constructFormBoxTitleBar("save", "Save") }

            <div class="ui-input-box">
                <div class="popup"></div>
                <div class="ui-input-name1">Summary</div>
                <input type="text" name="summary" data-handler="summary" class="ui-input1">
            </div>

            <div class="ui-form-container between margin-top">
                <div class="ui-text"><i class="gray">Tip:</i> Arrays are separated by comma.</div>
                <button name="submit" class="ui-button1"><i class="fas fa-check"></i> Save group</button>
            </div>
        </div>` : "" }

        <div class="ui-form-box">
            ${ UI.constructFormBoxTitleBar("logs", "Logs for this group") }

            <div class="ui-form-container ui-logs-container column-reverse">${ Log.constructLogEntriesHTML(log_entries) }</div>
        </div>
    </form>
</div>`;

        resolve(page);
    });
}

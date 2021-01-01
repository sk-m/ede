import * as Page from "../page";
import * as User from "../user";
import * as Log from "../log";
import * as UI from "../ui";
import * as SystemMessage from "../system_message";
import { registry_usergroups, registry_rights, registry_config } from "../registry";
import { UI_CHECKBOX_SVG } from "../constants";
import { GroupsAndRightsObject } from "../right";
import { getAllGrantRights } from "../action_restrictions";

// TODO add summary field for create and delete actions
export async function userGroupManagement(page: Page.ResponsePage, client: User.User): Promise<Page.SystempageConfig> {
    return new Promise(async (resolve: any) => {
        const queried_group_name = page.address.url_params[1];
        let client_can_alter = false;

        const page_config: Page.SystempageConfig = {
            page,

            breadcrumbs_data: [ ["User Group Management", "fas fa-users-cog", "/System:UserGroupManagement"] ],

            body_html: ""
        }

        // Get the files
        const page_files = await Page.getPageFiles("System:UserGroupManagement", {
            js: "./static/UserGroupManagement/script.js",
            css: "./static/UserGroupManagement/styles.css",
        });

        page.additional_css = [page_files.css];
        page.additional_js = [page_files.js];

        // Check if client can alter requeted group
        if(client) {
            await User.getRights(client.id)
            .then((client_rights: GroupsAndRightsObject) => {
                if(client_rights.rights.modifyusergroups) client_can_alter = true;
            })
            .catch(() => undefined);
        }

        // Check if a group name was provided
        if(!queried_group_name) {
            page_config.header_config = {
                icon: "fas fa-users-cog",
                title: "User Group Management",
                description: "Please, select a group"
            };

            page_config.body_html = `\
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

<form class="ui-form-box" name="usergroupmanagement-create">
    ${ UI.constructFormBoxTitleBar("create", "Create a group") }

    <div class="ui-input-box">
        <div class="popup"></div>
        <div class="ui-input-name1">New group name</div>
        <input type="text" name="new_group_name" data-handler="group_name" class="ui-input1">
    </div>
    <div class="ui-form-container right margin-top">
        <button name="submit" class="ui-button1"><i class="fas fa-star-of-life"></i> Create group</button>
    </div>
</form>`;

            resolve(page_config);
            return;
        }

        const queried_group = registry_usergroups.get()[queried_group_name];

        // Check if queried group exists
        if(!queried_group) {
            page_config.header_config = {
                icon: "fas fa-users-cog",
                title: queried_group_name,
                description: "Group not found"
            };

            page_config.body_html = `<div class="ui-text">Sorry, but such group does not exist.</div>`;

            resolve(page_config);
            return;
        }

        let available_rights_html = "";
        let available_grant_rights_html = "";
        let deleted_grant_rigths_html = "";

        const registry_rights_snapshot = registry_rights.get();
        const registry_config_snapshot = registry_config.get();
        const sysmsgs_query_arr: string[] = [];

        // TODO @performance store grant rights in the registry
        const available_grant_rights = await getAllGrantRights();

        let is_group_protected = false;

        // Check if this action requires a signature
        let signature_required = false;

        if(registry_config_snapshot["security.protected_actions"].value instanceof Array
        && registry_config_snapshot["security.protected_actions"].value.includes("usergroup/update")) {
            signature_required = true;
        }

        // Check if the group is deletable
        if(registry_config_snapshot["security.protected_groups"].value instanceof Array
        && registry_config_snapshot["security.protected_groups"].value.includes(queried_group_name)) {
            is_group_protected = true;
        }

        // Get all system messages for normal and grant rights
        // tslint:disable-next-line: forin
        for(const rigth_name in registry_rights_snapshot) {
            sysmsgs_query_arr.push(`right-description-${ rigth_name }`);
        }

        // tslint:disable-next-line: forin
        for(const grant_name in available_grant_rights) {
            sysmsgs_query_arr.push(`grantright-description-${ grant_name }`);
        }

        // Also load a name and a description for this group
        sysmsgs_query_arr.push(`usergroupmanagement-toptext`);
        sysmsgs_query_arr.push(`usergroupmanagement-savetext`);
        sysmsgs_query_arr.push(`usergroup-${ queried_group_name }-name`);
        sysmsgs_query_arr.push(`usergroup-${ queried_group_name }-shortdescription`);
        sysmsgs_query_arr.push(`usergroup-${ queried_group_name }-fulldescription`);

        const sysmsgs = await SystemMessage.get_value(sysmsgs_query_arr);

        // Get logs for this group
        const log_entries = await Log.getEntries("groupupdate", undefined, queried_group_name);

        // Loop through all available grant rights
        for(const grant_name in available_grant_rights) {
            if(!available_grant_rights[grant_name]) continue;

            available_grant_rights_html += `\
<div id="right-${ grant_name }" class="right">
<div class="left-container">
    <div input name="right;~${ grant_name }" style="width: 33%; min-width: 250px; flex-shrink: 0" class="ui-checkbox-1${ client_can_alter ? "" : " disabled" }" data-checked="${ queried_group.added_rights.includes("~" + grant_name) ? "true" : "false" }">
        <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
        <div class="text">
            <div class="name">~${ grant_name }</div>
            <div class="tag">Grant right</div>
        </div>
    </div>
</div>
<div class="right-container" style="width: 100%">
    <div class="description-container">
        <div>
            <div class="ui-text">${ sysmsgs[`grantright-description-${ grant_name }`] }</div>
            <div class="ui-text small gray i">${ available_grant_rights[grant_name].dependents_num || "no" } dependent(s)</div>
        </div>
    </div>
</div>
</div>`;
        }

        // Find deleted grant rights
        for(const grant_name of queried_group.added_rights) {
            const clean_grant_name = grant_name.substring(1);
            if(grant_name[0] === "~" && !available_grant_rights[clean_grant_name]) {

                deleted_grant_rigths_html += `\
<div id="right-${ clean_grant_name }" class="right one-side">
    <div class="left-container">
        <div input name="right;${ grant_name }" style="width: 33%; min-width: 250px; flex-shrink: 0" class="ui-checkbox-1${ client_can_alter ? "" : " disabled" }" data-checked="true">
            <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
            <div class="text">
                <div class="name">${ grant_name }</div>
                <div class="tag"><i class="fas fa-times"></i> Deleted grant right</div>
            </div>
        </div>
    </div>
</div>`;
            }
        }

        // Loop through all available rigths
        for(const right_name in registry_rights_snapshot) {
            if(registry_rights_snapshot[right_name]) {
                const right = registry_rights_snapshot[right_name];

                let arguments_html = "";
                let right_restricted = false;

                // Check if the right is restricted (can not be assigned or removed using the web interface)
                if(registry_config_snapshot["security.restricted_rights"].value instanceof Array) {
                    if(registry_config_snapshot["security.restricted_rights"].value.includes(right_name)) right_restricted = true;
                }

                // Right takes argumens
                if(right.arguments) {
                    // Loop through all arguments
                    for(const argument_name in right.arguments) {
                        if(right.arguments[argument_name]) {
                            const argument = right.arguments[argument_name];
                            let argument_value;

                            // Get argument's current value or set to default value
                            if(queried_group.right_arguments[right_name]) {
                                argument_value = queried_group.right_arguments[right_name][argument_name];
                            } else {
                                argument_value = argument.default_value;
                            }

                            if(argument.type.includes("boolean")) {
                                // Input can be a boolean

                                arguments_html += `\
<div class="ui-form-container" style="margin-top: 5px">
    <div class="ui-input-box">
        <div class="popup"></div>
        <div class="ui-input-name1">${ argument.description } (${ argument.type.join(" or ") })</div>

        <div input class="ui-checkbox-1${ client_can_alter ? "" : " disabled" }" name="right_argument;${ right_name };${ argument_name }" \
        data-checked="${ argument_value === true ? "true" : "false" }">
        <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
        <div class="text">${ argument.description }</div>
        </div>
    </div>
</div>`;
                            } else if(argument.type.includes("array")) {
                                // Input can be an array

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
<div id="right-${ right_name }" class="right${ arguments_count ? " w-arguments" : "" }">
    <div class="left-container">
        <div input name="right;${ right_name }" style="width: 33%; min-width: 250px; flex-shrink: 0" class="ui-checkbox-1${ (!right_restricted && client_can_alter) ? "" : " disabled" }" data-checked="${ queried_group.added_rights.includes(right_name) ? "true" : "false" }">
            <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
            <div class="text">
                <div class="name">${ right_name }</div>
                ${ right_restricted ? `<div class="tag">Restricted right</div>`
                : (right.risk_text ? `<div class="tag">${ right.risk_text }</div>` : "") }
            </div>
        </div>
    </div>
    <div class="right-container" style="width: 100%">
        <div class="description-container">
            <div>
                <div class="ui-text">${ sysmsgs[`right-description-${ right_name }`] }</div>
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

        // Page is ready
        // Header
        page_config.header_config = {
            icon: "fas fa-users-cog",
            title: queried_group.name
        };

        // Breadcrumbs
        page_config.breadcrumbs_data.push([queried_group.name, "fas fa-users"]);

        // Sidebar
        page_config.sidebar_config = { links: [
            {
                type: "heading",
                text: "Configure"
            },
            {
                type: "link",
                text: "Change the color of this group",
                icon: "fas fa-palette"
            },
            {
                type: "heading",
                text: "Related links"
            },
            {
                type: "link",
                text: "Users in this group",
                icon: "fas fa-users"
            },
            {
                type: "link",
                text: "Related system messages",
                icon: "fas fa-list",
                href: `/System:SystemMessages/usergroup-${ queried_group_name }`
            },
            {
                type: "heading",
                text: "Danger zone"
            },
            {
                id: "deletegroup",
                disabled: is_group_protected,
                title: is_group_protected ? "This group is protected and can not be deleted" : undefined,
                type: "link",
                additional_classes: "red",
                text: "Delete group",
                icon: "fas fa-trash"
            },
        ] };

        // Assigned rights and grants list
        let assigned_rights_html = "";
        let assigned_grants_html = "";

        for(const right_name of queried_group.added_rights) {
            if(right_name[0] === "~") {
                assigned_grants_html += `<a href="#right-${ right_name.substring(1) }">&rarr;${ right_name }</a>, `;
            } else {
                assigned_rights_html += `<a href="#right-${ right_name }">&rarr;${ right_name }</a>, `;
            }
        }

        // Remove the last ', '
        // TODO @cleanup @performance
        assigned_rights_html = assigned_rights_html.substring(0, assigned_rights_html.length - 2);
        assigned_grants_html = assigned_grants_html.substring(0, assigned_grants_html.length - 2);

        // TODO "Main information" block should be moved to the systempage header box
        page_config.body_html = `\
<form name="usergroupmanagement" data-onsubmit="test">
    ${ sysmsgs["usergroupmanagement-toptext"] !== "" ? `\
<div class="ui-info-box">
    <div class="icon"><i class="fas fa-exclamation-triangle"></i></div>
    <div class="text ui-text">${ sysmsgs["usergroupmanagement-toptext"] }</div>
</div>` : "" }

    <div class="ui-form-box">
        ${ UI.constructFormBoxTitleBar("main-info", "Main information") }

        <div class="ui-form-container ui-keyvalue-container">
            <div class="item">
                <div class="key">Name</div>
                <div class="value ui-text">${ sysmsgs[`usergroup-${ queried_group_name }-name`] }</div>
            </div>
            <div class="item">
                <div class="key">Short description</div>
                <div class="value ui-text">${ sysmsgs[`usergroup-${ queried_group_name }-shortdescription`] }</div>
            </div>
            <div class="item">
                <div class="key">Currently assigned rights</div>
                <div class="value ui-text monospace">${ assigned_rights_html || "<i>(none)</i>" }</div>
            </div>
            <div class="item">
                <div class="key">Currently assigned grants</div>
                <div class="value ui-text monospace">${ assigned_grants_html || "<i>(none)</i>" }</div>
            </div>
        </div>
    </div>

    <div class="ui-form-box user-group-management-rights-root">
        ${ UI.constructFormBoxTitleBar("rights", "Rights") }

        ${ sysmsgs[`usergroup-${ queried_group_name }-fulldescription`] !== "" ? `<div class="ui-text">${ sysmsgs[`usergroup-${ queried_group_name }-fulldescription`] }</div>` : "" }

        <div class="text-container">${ client_can_alter ? "You can modify rights for this group" : "You don't have permission to modify\
rights for this group" }</div>

        <div class="rights-container">
        <div class="section-header">
            <div class="header">Main rights</div>
            <div class="description">Main rights are defined in the engine itself and can not be created or removed.</div>
        </div>
        ${ available_rights_html }
        ${ available_grant_rights_html ? `<div class="section-header">
            <div class="header">Grant rights</div>
            <div class="description">Grant rights are needed to perform restricted actions. Grant rights have a higher priority than main rights as they are needed to supress the restrictions on objects. They can be created and removed at any time and always start with a tilda (~).</div>
        </div>` : "" }
        ${ available_grant_rights_html }
        ${ deleted_grant_rigths_html ? `<div class="section-header">
            <div class="header">Deleted grant rights</div>
            <div class="description">These grant rights are currently assigned to the group but were deleted and no longer affect anything.</div>
        </div>` : "" }
        ${ deleted_grant_rigths_html }
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

        ${ signature_required ? `<div class="ui-signature-container">
            <div class="left">
                <div class="icon"><i class="fas fa-key"></i></div>
                <div class="text">This action requires a two-factor verification</div>
            </div>
            <div class="input-container">
                <input class="ui-input1" type="text" name="signature" data-handler="otp" placeholder="Please, enter your one-time password here">
            </div>
        </div>` : "" }

        <div class="ui-form-container between margin-top">
            <div class="ui-text">${ sysmsgs["usergroupmanagement-savetext"] }</div>
            <button name="submit" type="button" class="ui-button1"><i class="fas fa-check"></i> Save group</button>
        </div>
    </div>` : "" }

    <div class="ui-form-box">
        ${ UI.constructFormBoxTitleBar("logs", "Logs for this group") }

        <div class="ui-form-container ui-logs-container column-reverse">${ Log.constructLogEntriesHTML(log_entries) }</div>
    </div>
</form>`;

        resolve(page_config);
    });
}

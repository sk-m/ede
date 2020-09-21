import fs from "fs";

import * as User from "../user";
import * as Page from "../page";
import * as SystemMessages from "../system_message";
import { ConfigItemsObject, ConfigItemAccessLevel } from "../config";
import { registry_config } from "../registry";
import { GroupsAndRightsObject } from "../right";

interface CategoriesConstructorResponse {
    html: string;
    categories: string[];
}

function constructCategoriesHTML(registry_config_snapshot: ConfigItemsObject, system_messages: SystemMessages.SystemMessagesObject,
selected_category?: string): CategoriesConstructorResponse {
    const added_categories: string[] = [];
    let result_html = "";

    // tslint:disable-next-line: forin
    for(const key in registry_config_snapshot) {
        const category_name = key.split(".")[0];

        // Check if this category was already added to the HTML
        if(!added_categories.includes(category_name)) {
            added_categories.push(category_name);

            // TODO @cleanup
            const icon_class = system_messages[`edeconfig-category-${ category_name }-iconclass`].does_exist ?
            system_messages[`edeconfig-category-${ category_name }-iconclass`].value : "fas fa-cog";

            result_html += `\
<div class="category${ selected_category === category_name ? " selected" : "" }" data-name="${ category_name }">
    <div class="icon"><i class="${ icon_class }"></i></div>
    <div class="name">${ system_messages[`edeconfig-category-${ category_name }-name`].value }</div>
</div>`;
        }
    }

    return {
        html: result_html,
        categories: added_categories
    };
}

// TODO @cleanup
function constructItemsHTML(category_name: string, registry_config_snapshot: ConfigItemsObject, client_can_alter: boolean,
restricted_permits: string[], system_messages: SystemMessages.SystemMessagesObject): string {
    // TODO @sysmsg
    let result_html = `\
<div class="category-intro">
    <div class="name">${ system_messages[`edeconfig-category-${ category_name }-name`].value }</div>
    <div class="description">${ system_messages[`edeconfig-category-${ category_name }-description`].value }</div>
</div>
`;

    const category_name_length = category_name.length + 1;

    for(const key in registry_config_snapshot) {
        if(key.startsWith(`${ category_name }.`)) {
            // Get the actual config item and it's value
            const config_item = registry_config_snapshot[key];
            const config_value = config_item.is_default ? "" : config_item.value;

            let indicator_html = "";
            let buttons_html = "";
            let input_html = "";

            // Check if the item can be changed by the client
            let changeable = client_can_alter;
            let viewable = true;

            if(config_item.access_level === ConfigItemAccessLevel.rXwX) {
                changeable = false;
                viewable = false;

                indicator_html = `<div class="indicator" title="This config item is CLI-locked and can be changed or viewed using CLI \
only"><i class="fas fa-eye-slash"></i> CLI Only</div>`;
            } else if(config_item.access_level === ConfigItemAccessLevel.rAwX) {
                changeable = false;

                indicator_html = `<div class="indicator" title="This config item is CLI-locked and can be changed using CLI \
only"><i class="fas fa-lock"></i> CLI Only</div>`;
            } else if(config_item.access_level === ConfigItemAccessLevel.rPwP) {
                if(restricted_permits.includes(key)) {
                    indicator_html = `<div class="indicator" title="This config item is restricted, but you have permission to view and \
change it"><i class="fas fa-lock-open"></i> Permitted</div>`;
                } else {
                    changeable = false;
                    viewable = false;

                    indicator_html = `<div class="indicator" title="This config item is restricted, you do not have permission to read or \
modify it"><i class="fas fa-eye-slash"></i> Restricted</div>`;
                }
            }

            // Construct the buttons HTML
            if(changeable) {
                buttons_html = `<button name="save" class="ui-button1 s-small disabled save-button"><i class="fas fa-check"></i> Save</button>`;

                // Check if we should show the "Reset" button
                if(!config_item.is_default && config_item.default_value) {
                    buttons_html += `<button name="reset" class="ui-button1 s-small t-frameless c-red"><i class="fas fa-redo"></i> Reset</button>`;
                }
            }

            // Construct the input HTML
            if(config_item.value_type === "array") {
                let current_values_html = "";

                // Check if current value is actually an array
                if(config_item.value instanceof Array) {
                    for(const item of config_item.value) {
                        current_values_html += `<div>${ item }</div>`;
                    }
                }

                // TODO add allowed_values (dropdown) type
                // Array input type
                input_html = `\
<div input class="ui-input-array1" name="${ config_item.key }"${ !changeable ? " disabled": "" }>
    <div class="items">${ current_values_html }</div>
    <input text="text"${ config_item.value_pattern ? ` patern="${ config_item.value_pattern }"` : "" }>
</div>`;
            } else {
                // Text input type
                input_html = `\
<input type="${ config_item.value_type === "int" ? "number" : "text" }" value="${ config_value }" name="${ config_item.key }" \
data-handler="${ config_item.value_type }" data-cleanvalue="${ config_value }" class="ui-input1 small"\
${ !changeable ? " disabled": "" }${ config_item.value_pattern ? ` patern="${ config_item.value_pattern }"` : "" }>`
            }

            result_html += `\
<form name="${ config_item.key }" class="config-option" data-changeable="${ changeable ? "true" : "false" }">
    <div class="left">
        <div class="config-option-key">${ key.substr(category_name_length) }${ indicator_html }</div>
        <div class="config-option-description">${ config_item.description }</div>
        <div class="config-option-internalkey">${ config_item.key }</div>
    </div>
    ${ !viewable ? "" :
    `<div class="right">
        <div class="status"><i class="fas fa-check"></i> Saved successfully</div>
        <div class="input-container">
            ${ input_html }
        </div>
        <div class="bottom-container">
            <div class="buttons">
                ${ buttons_html }
            </div>
            <div title="Default value" class="ui-text small gray default-value">
                <code>${ config_item.default_value || "<em>(no default)</em>" }</code>
            </div>
        </div>
    </div>`
    }
</form>`
        }
    }

    return result_html;
}

// TODO don't forget to add tags like `wip_placeholder`
export async function config(page: Page.ResponsePage, client: User.User): Promise<Page.ResponsePage> {
    return new Promise(async (resolve: any) => {
        // Load css and js files for this system page
        const page_css = fs.readFileSync("./static/Config/styles.css", "utf8");
        const page_js = fs.readFileSync("./static/Config/script.js", "utf8");

        page.additional_css = [page_css];
        page.additional_js = [page_js];

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

        let client_can_alter = false;
        let client_restricted_permits: string[] = [];

        const selected_category = page.address.url_params[1];

        // Check if client can modify the config
        if(client) {
            await User.getUserGroupRights(client.id)
            .then((client_rights: GroupsAndRightsObject) => {
                if(client_rights.rights.modifyconfig) {
                    client_can_alter = true;
                    client_restricted_permits = client_rights.rights.modifyconfig.restricted_permits;
                }
            })
            .catch(() => undefined);
        }

        // Get the current config
        const registry_config_snapshot = registry_config.get();

        // Get systemmessages
        const sysmsgs_query: string[] = [];
        const discovered_categories: string[] = [];

        // tslint:disable-next-line: forin
        for(const key in registry_config_snapshot) {
            const cat_name = key.split(".", 2)[0];

            if(!discovered_categories.includes(cat_name)) {
                discovered_categories.push(cat_name);

                sysmsgs_query.push(`edeconfig-category-${ cat_name }-name`);
                sysmsgs_query.push(`edeconfig-category-${ cat_name }-description`);
                sysmsgs_query.push(`edeconfig-category-${ cat_name }-iconclass`);
            }
        }

        const sysmsgs = await SystemMessages.get(sysmsgs_query);

        let options_html = "";
        const categories_response = constructCategoriesHTML(registry_config_snapshot, sysmsgs, selected_category);

        for(const category of categories_response.categories) {
            options_html += `<div class="config-options${ selected_category === category ? " shown" : "" }" data-category="${ category }">\
${ constructItemsHTML(category, registry_config_snapshot, client_can_alter, client_restricted_permits, sysmsgs) }</div>`;
        }

        page.parsed_content = `\
<div class="ui-systempage-header-box">
    <div class="title-container">
        <div class="icon"><i class="fas fa-cog"></i></div>
        <div class="title">EDE Configuration</div>
    </div>
</div>

<div id="systempage-config-content">
    <div id="systempage-config-root">
        <div class="left-panel">
            <div class="categories">
                ${ categories_response.html }
            </div>
        </div>
        <div class="right-panel">
            ${ options_html }
        </div>
    </div>
</div>`;

        resolve(page);
    });
}

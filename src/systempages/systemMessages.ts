import fs from "fs";

import * as User from "../user";
import * as Page from "../page";
import * as UI from "../ui";
import * as SystemMessage from "../system_message";
import { GroupsAndRightsObject } from "../right";
import he from "he";

export async function systemMessages(page: Page.ResponsePage, client: User.User): Promise<Page.SystempageConfig> {
    return new Promise(async (resolve: any) => {
        const page_config: Page.SystempageConfig = {
            page,

            breadcrumbs_data: [ ["System Messages", "fas fa-list", "/System:SystemMessages"] ],

            body_html: ""
        }

        // Load css and js files for this system page
        const page_css = fs.readFileSync("./content/pages/System/SystemMessages/styles.css", "utf8");
        const page_js = fs.readFileSync("./content/pages/System/SystemMessages/script.js", "utf8");

        page.additional_css = [page_css];
        page.additional_js = [page_js];

        // Get the queried system message name
        const queried_message = page.address.url_params[1];

        // Some strings
        const query_form_html = `\
<form class="ui-form-box" name="systemmessages-query">
    ${ UI.constructFormBoxTitleBar("query", "Find a system message", "You don't have to enter a full name, just the start of it") }

    <div class="ui-input-box">
        <div class="popup"></div>
        <div class="ui-input-name1">System message name</div>
        <input type="text" name="message_name" value="${ queried_message || "" }" data-handler="systemmessage_name" class="ui-input1">
    </div>
    <div class="ui-form-container between margin-top">
        <button name="create" class="ui-button1"><i class="fas fa-star-of-life"></i> Create</button>
        <button name="submit" class="ui-button1"><i class="fas fa-search"></i> Search</button>
    </div>
</form>`;

        // Nothing queried, display a query page
        if(!queried_message) {
            page_config.header_config = {
                icon: "fas fa-list",
                title: "System Messages",
                description: "Please, select a message"
            };

            page_config.body_html = query_form_html;

            resolve(page_config);
        } else {
            // Query provided
            const messages = await SystemMessage.get_all(undefined, undefined, queried_message);
            let client_can_modify = false;
            let sysmsgs_html = "";

            // Get client's rights
            if(client) {
                await User.getUserGroupRights(client.id)
                .then((client_grouprights: GroupsAndRightsObject) => {
                    if(client_grouprights.rights.editsystemmessages) client_can_modify = true;
                })
                .catch(() => undefined);
            }

            for(const msg_name in messages) {
                if(messages[msg_name]) {
                    const msg = messages[msg_name];

                    // TODO @performance we he.decode in SystemMessage.get(..) and then encode again here. We should have a flag to tell
                    // the getter to not decode instead
                    sysmsgs_html += `\
<div class="systemmessage" data-systemmessage-name="${ msg.name }">
    <div class="top">
        <div class="name-container">
        <div class="text">${ msg.name }</div>
        </div>
        <div class="buttons-container">
            ${ (client_can_modify && msg.is_deletable) ? `<button class="ui-button1 t-frameless c-red s-small delete-btn"><i class="fas fa-trash"></i> Delete</button>` : "" }
        </div>
    </div>
    <div class="middle">
        <div class="current-value-container${ !client_can_modify ? " disabled" : "" }" title="Click to edit">
            <div class="text">${ he.encode(msg.value) }</div>
        </div>
        <div class="edit-form hidden">
            <textarea class="ui-input1 monospace">${ msg.value }</textarea>
            <div class="ui-form-container between margin-top">
                <button class="ui-button1 t-frameless close-btn">Close</button>
                <button class="ui-button1 t-frameless c-blue save-btn"><i class="fas fa-check"></i> Save</button>
            </div>
        </div>
    </div>
</div>`
                }
            }

            page_config.header_config = {
                icon: "fas fa-list",
                title: `${ queried_message }&hellip;`,
                description: `Displaying messages starting with '${ queried_message }'`
            };

            page_config.breadcrumbs_data.push([queried_message])

            page_config.body_html = `\
${ query_form_html }
<div id="systempage-systemmessages-root" class="hidden">
    <div id="systempage-systemmessages-create-form" class="hidden">
        <div class="systemmessage">
            <div class="top">
                <div class="name-container">
                    <div class="text"></div>
                </div>
            </div>
            <div class="middle">
                <div class="edit-form">
                    <textarea class="ui-input1 monospace"></textarea>
                    <div class="ui-form-container between margin-top">
                        <button class="ui-button1 t-frameless close-btn">Close</button>
                        <button class="ui-button1 t-frameless c-blue create-btn"><i class="fas fa-star-of-life"></i> Create</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div id="systempage-systemmessages-list">
        ${ sysmsgs_html }
    </div>
</div>`;

        resolve(page_config);
        }
    });
}

import * as User from "../user";
import * as Page from "../page";
import * as UI from "../ui";
import * as SystemMessage from "../system_message";
import { GroupsAndRightsObject } from "../right";

export async function systemMessages(page: Page.ResponsePage, client: User.User): Promise<Page.SystempageConfig> {
    return new Promise(async (resolve: any) => {
        const page_config: Page.SystempageConfig = {
            page,

            breadcrumbs_data: [ ["System Messages", "fas fa-list", "/System:SystemMessages"] ],

            body_html: ""
        }

        // Get the files
        const page_files = await Page.getPageFiles("System:SystemMessages", {
            js: "./static/SystemMessages/script.js",
            css: "./static/SystemMessages/styles.css",
        });

        page.additional_css = [page_files.css];
        page.additional_js = [page_files.js];

        // Get the queried system message name
        const queried_message = page.address.url_params[1];

        // Get client's rights
        let client_can_modify = false;

        if(client) {
            await User.getRights(client.id)
            .then((client_grouprights: GroupsAndRightsObject) => {
                if(client_grouprights.rights.editsystemmessages) client_can_modify = true;
            })
            .catch(() => undefined);
        }

        // Save whether or not the client can modify the system messages to the additional_info page object
        page_config.page.additional_info = {
            client_can_modify_sysmsgs: client_can_modify
        };

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

        const create_form_html = `\
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
</div>`;

        // Nothing queried, display a query page
        if(!queried_message) {
            page_config.header_config = {
                icon: "fas fa-list",
                title: "System Messages",
                description: "Please, enter a query"
            };

            page_config.body_html = `\
${ query_form_html }
<div id="systempage-systemmessages-root" class="hidden">
    ${ create_form_html }
    <div id="systempage-systemmessages-list"></div>
</div>`;

            resolve(page_config);
        } else {
            // Query provided
            const messages = await SystemMessage.get_all(undefined, undefined, queried_message, true);
            let sysmsgs_html = "";
            let sysmsgs_returned = false;

            for(const msg_name in messages) {
                if(messages[msg_name]) {
                    sysmsgs_returned = true;

                    const msg = messages[msg_name];

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
            <div class="text">${ msg.value }</div>
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

            if(!sysmsgs_returned) {
                sysmsgs_html = `<div class="no-sysmsgs-notice">No system messages found</div>`;
            }

            page_config.header_config = {
                icon: "fas fa-list",
                title: "System Messages",
                description: `Displaying messages starting with '${ queried_message }'`
            };

            page_config.breadcrumbs_data.push([queried_message])

            page_config.body_html = `\
${ query_form_html }
<div id="systempage-systemmessages-root" class="hidden">
    ${ create_form_html }
    <div id="systempage-systemmessages-list">
        ${ sysmsgs_html }
    </div>
</div>`;

            resolve(page_config);
        }
    });
}

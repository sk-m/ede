import fs from "fs";

import * as Page from "../page";
import * as User from "../user";
import * as Log from "../log";
import * as Util from "../utils";
import * as UI from "../ui";
import * as SystemMessage from "../system_message";
import { UI_CHECKBOX_SVG } from "../constants";
import { GroupsAndRightsObject } from "../right";
import { sql } from "../server";
import { pageTitleParser } from "../routes";

async function info_page(queried_page: any, client?: User.User): Promise<string> {
    // TODO include deletion logs
    const create_log_entries = await Log.getEntries("createwikipage", undefined, queried_page.id);

    const stat_createdon = new Date(queried_page.page_info.created_on * 1000).toUTCString();

    let user_error = false;
    const created_user: any = await new Promise((resolve: any) => {
        sql.execute("SELECT `username` FROM `users` WHERE id = ?",
        [queried_page.page_info.created_by],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                user_error = true;
                resolve();
            } else {
                resolve(results[0]);
            }
        });
    });

    return `\
<div class="ui-form-box no-title ui-keyvalue-container">
    <div class="item">
        <div class="key">Page id</div>
        <div class="value ui-text monospace">${ queried_page.id }</div>
    </div>
    <div class="item">
        <div class="key">Current revision id</div>
        <div class="value ui-text monospace">${ queried_page.revision }</div>
    </div>
    <div class="spacer"></div>
    <div class="item">
        <div class="key">Namespace</div>
        <div class="value">${ queried_page.namespace }</div>
    </div>
    <div class="item">
        <div class="key">Created on</div>
        <div class="value">${ stat_createdon } (${ Util.formatTimeString(queried_page.page_info.created_on) })</div>
    </div>
    <div class="item">
        <div class="key">Created by</div>
        <div class="value ui-text">${ user_error ? "(unknown)" : `<a href="/User:${ created_user.username }">${ created_user.username }</a>` }</div>
    </div>
</div>

<div class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("info_logs", "Related logs") }

    <div class="ui-form-container ui-logs-container column-reverse">${ Log.constructLogEntriesHTML(create_log_entries) }</div>
</div>`;
}

async function delete_page(queried_page: any, client?: User.User, client_rights?: GroupsAndRightsObject): Promise<string> {
    return new Promise(async (resolve: any) => {
        if(!client_rights || !client_rights.rights.wiki_deletepage) {
            resolve("You don't have permission to delete wiki pages.");
            return;
        }

        const client_can_completely_remove = client_rights.rights.wiki_deletepage.allow_complete_erase === true;
        const delete_log_entries = await Log.getEntries("deletewikipage", undefined, queried_page.id);

        const sysmsgs = await SystemMessage.get([
            "wikipagedelete-toptext"
        ]) as SystemMessage.SystemMessagesObject;

        resolve(`\
<form name="deletepage-form" class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("delete_delete", "Delete page") }

    ${ queried_page.is_deleted.readInt8(0) !== 1 ?
    `<div class="ui-text margin-bottom">${ sysmsgs["wikipagedelete-toptext"].value }</div>

    <div input name="db_removal" class="ui-checkbox-1${ client_can_completely_remove? "" : " disabled" }">
        <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
        <div class="text">Completely remove this page and all related information from the database instead</div>
    </div>

    <div class="ui-input-box margin-top">
        <div class="popup"></div>
        <div class="ui-input-name1">Reason</div>
        <input type="text" name="summary" data-handler="summary" class="ui-input1">
    </div>

    <div class="ui-form-container between margin-top">
        <div input name="confirm_db_removal_checkbox" class="ui-checkbox-1 red" style="visibility: hidden">
            <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
            <div class="text">Confirm complete removal</div>
        </div>
        <button name="submit" class="ui-button1 c-red">Delete page</button>
    </div>` : "<div class=\"ui-text\">This page can not be deleted because it already is.</div>" }
</form>

<div class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("delete_logs", "Delete logs for this page") }

    <div class="ui-form-container ui-logs-container column-reverse">${ Log.constructLogEntriesHTML(delete_log_entries) }</div>
</div>`);
});
}

export async function wikiPageManagement(page: Page.ResponsePage, client: User.User): Promise<Page.SystempageConfig> {
    return new Promise(async (resolve: any) => {
        const queried_page_fullname = page.address.url_params[2];

        const page_config: Page.SystempageConfig = {
            page,

            breadcrumbs_data: [ ["Page Management", "fas fa-file-alt", "/System:WikiPageManagement"] ],

            body_html: ""
        }

        // Load css and js files for this system page
        // TODO move to appropriate route
        const page_js = fs.readFileSync("./static/PageManagement/script.js", "utf8");

        page.additional_js = [page_js];

        // Check if page name was provided
        if(!queried_page_fullname) {
            page_config.header_config = {
                icon: "fas fa-file-alt",
                title: "Page Management",
                description: "Please, select a page"
            };

            page_config.body_html = `\
<form class="ui-form-box" name="usergroupmanagement-query">
    ${ UI.constructFormBoxTitleBar("query", "Find a page") }

    <div class="ui-input-box">
        <div class="popup"></div>
        <div class="ui-input-name1">Page name</div>
        <input type="text" name="page_name" data-handler="page_name" class="ui-input1">
    </div>
    <div class="ui-form-container right margin-top">
        <button name="submit" class="ui-button1"><i class="fas fa-search"></i> Query page</button>
    </div>
</form>`;

            resolve(page_config);
            return;
        }

        const page_address = pageTitleParser(queried_page_fullname);
        let page_error = false;

        const queried_page: any = await new Promise((resolve: any) => {
            sql.execute("SELECT * FROM `wiki_pages` WHERE `namespace` = ? AND `name` = ?",
            [page_address.namespace, page_address.name],
            (error: any, results: any) => {
                if(error || results.length < 1) {
                    page_error = true;
                    resolve();
                } else {
                    resolve(results[0]);
                }
            });
        });

        if(page_error) {
            page_config.header_config = {
                icon: "fas fa-file-alt",
                title: "Page Management",
                description: "Page not found"
            };

            page_config.body_html = "Page was not found.";

            resolve(page_config);
            return;
        }

        const queried_page_is_deleted = queried_page.is_deleted.readInt8(0) === 1;

        let client_groups;

        // Get client's groups
        if(client) {
            client_groups = await User.getUserGroupRights(client.id).catch(() => undefined);
        }

        // We have the info about the page
        const page_fullname = `${ queried_page.namespace }:${ queried_page.name }`;

        // Header
        page_config.header_config = {
            icon: "fas fa-file",
            title: page_fullname
        };

        // Breadcrumbs
        page_config.breadcrumbs_data.push([page_fullname, "fas fa-file"]);

        // Sidebar
        page_config.sidebar_config = { links: [
            {
                type: "heading",
                text: "Page"
            },
            {
                type: "link",
                text: "Page info",
                icon: "fas fa-info-circle",
                href: `/System:WikiPageManagement/info/${ queried_page_fullname }`
            },
            {
                type: "link",
                text: "View page",
                icon: "fas fa-eye",
                href: `/${ queried_page_fullname }`
            },
            {
                type: "link",
                text: "Edit page",
                icon: "fas fa-pen",
                href: `/${ queried_page_fullname }?edit=1`
            },
            {
                type: "heading",
                text: "Actions"
            },
            {
                type: "link",
                text: "Rename page",
                icon: "fas fa-tag",
                href: `/System:WikiPageManagement/rename/${ queried_page_fullname }`
            },
            {
                type: "link",
                text: "Edit restriction settings",
                icon: "fas fa-unlock",
                href: `/System:WikiPageManagement/restrictions/${ queried_page_fullname }`
            },
        ] };

        // Page is deleted, add a restore link
        if(queried_page_is_deleted) {
            page_config.sidebar_config.links.push({
                type: "link",
                text: "Restore page",
                icon: "fas fa-trash-restore",
                href: `/System:WikiPageManagement/restore/${ queried_page_fullname }`
            });
        } else {
            page_config.sidebar_config.links.push({
                type: "link",
                text: "Delete page",
                additional_classes: "red",
                icon: "fas fa-trash",
                href: `/System:WikiPageManagement/delete/${ queried_page_fullname }`
            });
        }

        switch(page.address.url_params[1]) {
            case "delete": {
                page_config.breadcrumbs_data.push(["Delete"]);
                page_config.header_config = {
                    icon: "fas fa-file",
                    title: `Delete ${ page_fullname}`
                };

                page_config.body_html = await delete_page(queried_page, client, client_groups || undefined);
            } break;
            default: {
                page_config.breadcrumbs_data.push(["Info"]);
                page_config.body_html = await info_page(queried_page, client);
            }
        }

        resolve(page_config);
    });
}
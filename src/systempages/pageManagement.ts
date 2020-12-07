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
import { registry_namespaces } from "../registry";

async function info_page(queried_page: any, queried_page_title: string, client?: User.User): Promise<string> {
    // TODO include deletion logs
    const all_log_entries = await Log.getEntries(["createwikipage", "deletewikipage", "restorewikipage", "movewikipage"], undefined, queried_page_title);

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
        <div class="key">Namespace</div>
        <div class="value">${ queried_page.namespace }</div>
    </div>
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
        <div class="key">Current restriction status</div>
        <div class="value ui-text w-icon"><div class="icon"><i class="fas fa-check"></i></div> No restrictions</div>
    </div>
    <div class="spacer"></div>
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
    ${ UI.constructFormBoxTitleBar("info_logs", "All related logs") }

    <div class="ui-form-container ui-logs-container column-reverse">${ Log.constructLogEntriesHTML(all_log_entries) }</div>
</div>`;
}

async function move_page(queried_page: Page.PageInfo, queried_page_title: string, client?: User.User, client_rights?: GroupsAndRightsObject): Promise<string> {
    return new Promise(async (resolve: any) => {
        if(!client_rights || !client_rights.rights.wiki_movepage) {
            resolve("You don't have permission to move wiki pages.");
            return;
        }

        // Get log entries
        const log_entries = await Log.getEntries("movewikipage", undefined, queried_page_title);

        // Get system messages
        const sysmsgs = await SystemMessage.get([
            "wikipagemove-toptext"
        ]);

        // Get all namespaces
        const registry_namespaces_snapshot = registry_namespaces.get();
        let namespace_select_html = "";

        // tslint:disable-next-line: forin
        for(const name in registry_namespaces_snapshot) {
            // We can only move to namespaces with 'wiki' content model
            if(registry_namespaces_snapshot[name].content_model === "wiki") {
                namespace_select_html += `<div class="choice">${ name }</div>`;
            }
        }

        resolve(`\
<form name="movepage-form" class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("move_move", "Move page") }

    <div class="ui-text margin-bottom">${ sysmsgs["wikipagemove-toptext"].value }</div>

    <div input-container class="ui-input-box margin-top">
        <div class="ui-input-name1">Move to</div>
        <div class="ui-form-container between">
            <div input class="ui-input-dropdown1" name="new_namespace" style="margin-right: 3px">
                <input disabled type="text" value="${ queried_page.namespace }">
                <div class="arrow-icon"><i class="fas fa-chevron-down"></i></div>
                <div class="choices">
                    ${ namespace_select_html }
                </div>
            </div>

            <input type="text" name="new_name" value="${ decodeURIComponent(queried_page.name) }" data-handler="page_names" class="ui-input1" style="margin-left: 3px">
        </div>
    </div>

    <div class="ui-text small gray" style="margin-top: 5px">Page can only be moved to <code>wiki</code> namespaces. You can manage namespaces <a href="/System:Namespaces">here</a>.</div>

    <div class="ui-input-box margin-top">
        <div class="popup"></div>
        <div class="ui-input-name1">Reason</div>
        <input type="text" name="summary" data-handler="summary" class="ui-input1">
    </div>

    <div class="ui-form-container right margin-top">
        <button name="submit" class="ui-button1">Move page</button>
    </div>
</form>

<div class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("move_logs", "Move logs for this page") }

    <div class="ui-form-container ui-logs-container column-reverse">${ Log.constructLogEntriesHTML(log_entries) }</div>
</div>`);
});
}

async function delete_page(queried_page: Page.PageInfo, queried_page_title: string, client?: User.User, client_rights?: GroupsAndRightsObject): Promise<string> {
    return new Promise(async (resolve: any) => {
        if(!client_rights || !client_rights.rights.wiki_deletepage) {
            resolve("You don't have permission to delete wiki pages.");
            return;
        }

        const client_can_completely_remove = client_rights.rights.wiki_deletepage.allow_complete_erase === true;
        const log_entries = await Log.getEntries(["deletewikipage", "restorewikipage"], undefined, queried_page_title);

        const sysmsgs = await SystemMessage.get([
            "wikipagedelete-toptext"
        ]);

        resolve(`\
<form name="deletepage-form" class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("delete_delete", "Delete page") }

    <div class="ui-text margin-bottom">${ sysmsgs["wikipagedelete-toptext"].value }</div>

    <div input name="db_removal" class="ui-checkbox-1${ client_can_completely_remove? "" : " disabled" }">
        <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
        <div class="text">Completely remove this page and all related information from the database instead</div>
    </div>

    <div input-container class="ui-input-box margin-top">
        <div popup class="popup"></div>
        <div class="ui-input-name1">Reason</div>

        <div input class="ui-input-dropdown1" editable name="summary" data-handler="summary">
            <input type="text">
            <div class="arrow-icon"><i class="fas fa-chevron-down"></i></div>
            <div class="choices">
                <div class="choice">No longer needed</div>
                <div class="choice">Per [[System:Diff/_____|discussion]]</div>
            </div>
        </div>
    </div>

    <div class="ui-form-container between margin-top">
        <div input name="confirm_db_removal_checkbox" class="ui-checkbox-1 red" style="visibility: hidden">
            <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
            <div class="text">Confirm complete removal</div>
        </div>
        <button name="submit" class="ui-button1 c-red">Delete page</button>
    </div>
</form>

<div class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("delete_logs", "Delete and restore logs for this page") }

    <div class="ui-form-container ui-logs-container column-reverse">${ Log.constructLogEntriesHTML(log_entries) }</div>
</div>`);
});
}

export async function wikiPageManagement(page: Page.ResponsePage, client: User.User): Promise<Page.SystempageConfig> {
    return new Promise(async (resolve: any) => {
        const queried_page_fullname = page.address.query.title;

        const page_config: Page.SystempageConfig = {
            page,

            breadcrumbs_data: [ ["Page Management", "fas fa-file-alt", "/System:WikiPageManagement"] ],

            body_html: ""
        }

        if(!queried_page_fullname) {
            // No title provided

            page_config.header_config = {
                icon: "fas fa-file-alt",
                title: "Page Management",
                description: "Please, select a page"
            };

            page_config.body_html = `\
<form class="ui-form-box" name="wikipagemanagement-query">
    ${ UI.constructFormBoxTitleBar("query", "Find a page") }

    <div class="ui-input-box">
        <div class="popup"></div>
        <div class="ui-input-name1">Page title</div>
        <input type="text" name="page_title" data-handler="page_title" class="ui-input1">
    </div>
    <div class="ui-form-container right margin-top">
        <button name="submit" class="ui-button1"><i class="fas fa-search"></i> Query page</button>
    </div>
</form>`;

            // Load query js
            const page_js = fs.readFileSync("./static/PageManagement/query.js", "utf8");

            page_config.page.additional_js = [page_js];

            resolve(page_config);
            return;
        }

        // Get the page
        const page_address = pageTitleParser(queried_page_fullname);

        const page_query = await Page.getPageInfo(page_address, true);

        if(page_query[0] === true) {
            // Title was provided, but such page does not exist

            page_config.header_config = {
                icon: "fas fa-file-alt",
                title: page_address.display_title,
                description: "Page not found"
            };

            page_config.breadcrumbs_data.push([page_address.display_title, "fas fa-file"]);

            page_config.body_html = `\
<div class="ui-info-box c-orange">
    <div class="icon"><i class="fas fa-exclamation-triangle"></i></div>
    <div class="text">Page was not found. Maybe it was deleted or moved?</div>
</div>`;

            if(page_query[1].length !== 0) {
                page_config.body_html +=`\
<div class="ui-info-box">
    <div class="icon"><i class="fas fa-exclamation-triangle"></i></div>
    <div class="text ui-text">Deleted pages with such name were found. You can manage them here — \
    <a href="/System:DeletedWikiPages?title=${ page_address.display_title }">${ page_address.display_title }</a>.</div>
</div>`;
            }

            const log_entries = await Log.getEntries(["deletewikipage", "movewikipage", "restorewikipage"], undefined, page_address.title);

            page_config.body_html += `\
<div class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("delete_move_logs", "Delete, restore and move logs for this page") }

    <div class="ui-form-container ui-logs-container column-reverse">${ Log.constructLogEntriesHTML(log_entries) }</div>
</div>`

            resolve(page_config);
            return;
        }

        // No errors with a page
        const queried_page = page_query[1][0];

        let client_groups;

        // Get client's groups
        if(client) {
            client_groups = await User.getRights(client.id).catch(() => undefined);
        }

        // Header
        page_config.header_config = {
            icon: "fas fa-file",
            title: page_address.display_title
        };

        // Breadcrumbs
        page_config.breadcrumbs_data.push([page_address.display_title, "fas fa-file"]);

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
                href: `/System:WikiPageManagement/info?title=${ page_address.display_title }`
            },
            {
                type: "link",
                text: "View page",
                icon: "fas fa-eye",
                href: `/${ page_address.display_title }`
            },
            {
                type: "link",
                text: "Edit page",
                icon: "fas fa-pen",
                href: `/${ page_address.display_title }?v=edit`
            },
            {
                type: "link",
                text: "Archives for this title",
                icon: "fas fa-archive",
                href: `/System:DeletedWikiPages?title=${ page_address.display_title }`
            },
            {
                type: "heading",
                text: "Actions"
            },
            {
                type: "link",
                text: "Move page (rename)",
                icon: "fas fa-arrow-right",
                href: `/System:WikiPageManagement/move?title=${ page_address.display_title }`
            },
            {
                type: "link",
                text: "Edit restriction settings",
                icon: "fas fa-unlock",
                href: `/System:WikiPageManagement/restrictions?title=${ page_address.display_title }`
            },
            {
                type: "link",
                text: "Delete page",
                additional_classes: "red",
                icon: "fas fa-trash",
                href: `/System:WikiPageManagement/delete?title=${ page_address.display_title }`
            }
        ] };

        switch(page.address.url_params[1]) {
            case "delete": {
                const page_js = fs.readFileSync("./static/PageManagement/delete.js", "utf8");

                page_config.page.additional_js = [page_js];

                page_config.breadcrumbs_data.push(["Delete"]);
                page_config.header_config = {
                    icon: "fas fa-trash",
                    title: `Delete ${ page_address.display_title }`
                };

                page_config.body_html = await delete_page(queried_page, page_address.title, client, client_groups || undefined);
            } break;
            case "move": {
                const page_js = fs.readFileSync("./static/PageManagement/move.js", "utf8");

                page_config.page.additional_js = [page_js];

                page_config.breadcrumbs_data.push(["Move"]);
                page_config.header_config = {
                    icon: "fas fa-file-export",
                    title: `Move ${ page_address.display_title }`
                };

                page_config.body_html = await move_page(queried_page, page_address.title, client, client_groups || undefined);
            } break;
            default: {
                page_config.breadcrumbs_data.push(["Info"]);
                page_config.body_html = await info_page(queried_page, page_address.title, client);
            }
        }

        resolve(page_config);
    });
}
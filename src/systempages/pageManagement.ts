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

async function info_page(queried_page: any, client?: User.User): Promise<string> {
    // TODO include deletion logs
    const all_log_entries = await Log.getEntries(["createwikipage", "deletewikipage", "restorewikipage", "movewikipage"], undefined, queried_page.id);

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

async function move_page(queried_page: any, client?: User.User, client_rights?: GroupsAndRightsObject): Promise<string> {
    return new Promise(async (resolve: any) => {
        if(!client_rights || !client_rights.rights.wiki_movepage) {
            resolve("You don't have permission to move wiki pages.");
            return;
        }

        // Get log entries
        const log_entries = await Log.getEntries("movewikipage", undefined, queried_page.id);

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

    <div class="ui-input-name1">Move to</div>
    <div class="ui-form-container between">
        <div input class="ui-input-dropdown1" name="new_namespace" style="margin-right: 3px">
            <input disabled type="text" value="${ queried_page.namespace }">
            <div class="arrow-icon"><i class="fas fa-chevron-down"></i></div>
            <div class="choices">
                ${ namespace_select_html }
            </div>
        </div>

        <input type="text" name="new_name" value="${ queried_page.name }" data-handler="page_names" class="ui-input1" style="margin-left: 3px">
    </div>

    <div class="ui-text small gray">Page can only be moved to <code>wiki</code> namespaces. You can manage namespaces <a href="/System:Namespaces">here</a>.</div>

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

async function restore_page(queried_page: any, client?: User.User, client_rights?: GroupsAndRightsObject): Promise<string> {
    return new Promise(async (resolve: any) => {
        if(!client_rights || !client_rights.rights.wiki_restorepage) {
            resolve("You don't have permission to restore wiki pages.");
            return;
        }

        const log_entries = await Log.getEntries(["deletewikipage", "restorewikipage"], undefined, queried_page.id);
        const deleted_page = await Page.getRaw(queried_page.namespace, queried_page.name, true);

        let deleted_page_contents = "";
        if(deleted_page && deleted_page.raw_content) {
            deleted_page_contents = deleted_page.raw_content.replace(/\n/g, "<br>");
        }

        const sysmsgs = await SystemMessage.get([
            "wikipagerestore-toptext"
        ]);

        resolve(`\
<div name="restorepage-preview" class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("restore_preview", "Preview", "Deleted contents of the page") }
    <div class="ui-text monospace">${ deleted_page_contents }</div>
</div>

<form name="restorepage-form" class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("restore_restore", "Restore page") }

    <div class="ui-text margin-bottom">${ sysmsgs["wikipagerestore-toptext"].value }</div>

    <div class="ui-input-box margin-top">
        <div class="popup"></div>
        <div class="ui-input-name1">Reason</div>
        <input type="text" name="summary" data-handler="summary" class="ui-input1">
    </div>

    <div class="ui-form-container right margin-top">
        <button name="submit" class="ui-button1">Restore page</button>
    </div>
</form>

<div class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("restore_logs", "Restore and delete logs for this page") }

    <div class="ui-form-container ui-logs-container column-reverse">${ Log.constructLogEntriesHTML(log_entries) }</div>
</div>`);
});
}

async function delete_page(queried_page: Page.PageInfo, client?: User.User, client_rights?: GroupsAndRightsObject): Promise<string> {
    return new Promise(async (resolve: any) => {
        if(!client_rights || !client_rights.rights.wiki_deletepage) {
            resolve("You don't have permission to delete wiki pages.");
            return;
        }

        const client_can_completely_remove = client_rights.rights.wiki_deletepage.allow_complete_erase === true;
        const log_entries = await Log.getEntries(["deletewikipage", "restorewikipage"], undefined, queried_page.id);

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

    <div input-container class="ui-input-box">
        <div popup class="popup"></div>
        <div class="ui-input-name1">Reaon</div>

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
        const queried_page_fullname = page.address.url_params[2];

        const page_config: Page.SystempageConfig = {
            page,

            breadcrumbs_data: [ ["Page Management", "fas fa-file-alt", "/System:WikiPageManagement"] ],

            body_html: ""
        }

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

        // Get the page
        const page_address = pageTitleParser(queried_page_fullname);
        let page_error = false;

        const page_query: any = await Page.getInfo(page_address.namespace, page_address.name, true)
        .catch(() => { page_error = true });

        if(page_error || page_query[0] === true) {
            page_config.header_config = {
                icon: "fas fa-file-alt",
                title: "Page Management",
                description: "Page not found"
            };

            page_config.body_html = "Page was not found.";

            if(page_query[0] === true) {
                page_config.body_html +=
`<br><br>Deleted pages with such name were found. You can manage them here → <a class="ui-text" href="/System:DeletedWikiPages/${ queried_page_fullname }">\
System:DeletedWikiPages/${ queried_page_fullname }</a>.`;
            }

            resolve(page_config);
            return;
        }

        // No errors with a page
        const queried_page = page_query[1][0];

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
                text: "Move page (rename)",
                icon: "fas fa-arrow-right",
                href: `/System:WikiPageManagement/move/${ queried_page_fullname }`
            },
            {
                type: "link",
                text: "Edit restriction settings",
                icon: "fas fa-unlock",
                href: `/System:WikiPageManagement/restrictions/${ queried_page_fullname }`
            },
            {
                type: "link",
                text: "Delete page",
                additional_classes: "red",
                icon: "fas fa-trash",
                href: `/System:WikiPageManagement/delete/${ queried_page_fullname }`
            }
        ] };

        switch(page.address.url_params[1]) {
            case "delete": {
                const page_js = fs.readFileSync("./static/PageManagement/delete.js", "utf8");

                page_config.page.additional_js = [page_js];

                page_config.breadcrumbs_data.push(["Delete"]);
                page_config.header_config = {
                    icon: "fas fa-trash",
                    title: `Delete ${ page_fullname}`
                };

                page_config.body_html = await delete_page(queried_page, client, client_groups || undefined);
            } break;
            // case "restore": {
            //     const page_js = fs.readFileSync("./static/PageManagement/restore.js", "utf8");

            //     page_config.page.additional_js = [page_js];

            //     page_config.breadcrumbs_data.push(["Restore"]);
            //     page_config.header_config = {
            //         icon: "fas fa-trash-restore",
            //         title: `Restore ${ page_fullname}`
            //     };

            //     page_config.body_html = await restore_page(queried_page, client, client_groups || undefined);
            // } break;
            case "move": {
                const page_js = fs.readFileSync("./static/PageManagement/move.js", "utf8");

                page_config.page.additional_js = [page_js];

                page_config.breadcrumbs_data.push(["Move"]);
                page_config.header_config = {
                    icon: "fas fa-file-export",
                    title: `Move ${ page_fullname}`
                };

                page_config.body_html = await move_page(queried_page, client, client_groups || undefined);
            } break;
            default: {
                page_config.breadcrumbs_data.push(["Info"]);
                page_config.body_html = await info_page(queried_page, client);
            }
        }

        resolve(page_config);
    });
}
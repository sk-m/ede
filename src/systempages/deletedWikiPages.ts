import fs from "fs";

import * as Page from "../page";
import * as User from "../user";
import * as Log from "../log";
import * as Util from "../utils";
import * as UI from "../ui";
import * as SystemMessage from "../system_message";
import { UI_CHECKBOX_SVG } from "../constants";
import { sql } from "../server";
import { pageTitleParser } from "../routes";

export async function deletedWikiPages(page: Page.ResponsePage, client: User.User): Promise<Page.SystempageConfig> {
    return new Promise(async (resolve: any) => {
        const queried_page_fullname = page.address.url_params[1];

        const page_config: Page.SystempageConfig = {
            page,

            breadcrumbs_data: [ ["Deleted Pages", "fas fa-archive", "/System:DeletedWikiPages"] ],

            body_html: ""
        }

        // Check if page name was provided
        if(!queried_page_fullname) {
            page_config.header_config = {
                icon: "fas fa-archive",
                title: "Deleted Pages",
                description: "Please, enter the title of the page"
            };

            page_config.body_html = `\
<form class="ui-form-box" name="deletedwikipages-query">
    ${ UI.constructFormBoxTitleBar("query", "Find a page") }

    <div class="ui-input-box">
        <div class="popup"></div>
        <div class="ui-input-name1">Page title</div>
        <input type="text" name="page_name" data-handler="page_name" class="ui-input1">
    </div>
    <div class="ui-form-container right margin-top">
        <button name="submit" class="ui-button1"><i class="fas fa-search"></i> Query page</button>
    </div>
</form>`;

            resolve(page_config);
            return;
        }

        let client_groups;

        // Get client's groups
        if(client) {
            client_groups = await User.getUserGroupRights(client.id).catch(() => undefined);
        }

        if(!client_groups || !client_groups.rights.wiki_restorepage) {
            page_config.header_config = {
                icon: "fas fa-archive",
                title: "Deleted Pages",
                description: `Access denied`
            };

            page_config.body_html = "You don't have permission to view or restore wiki pages.";

            resolve(page_config);
            return;
        }

        // Get the page
        const page_address = pageTitleParser(queried_page_fullname);

        const existent_page_query: any = await Page.getInfo(page_address.namespace, page_address.name);
        const deleted_page_query: any = await Page.getDeletedPagesInfo(page_address.namespace, page_address.name);

        // Page with such name currenly exists
        let page_with_such_name_exists = existent_page_query[1].length !== 0;

        // No pages in archive found
        if(deleted_page_query.length === 0) {
            page_config.header_config = {
                icon: "fas fa-archive",
                title: "Deleted Pages",
                description: `No records for ${ queried_page_fullname }`
            };

            page_config.body_html = "No records found for the requested title.";

            resolve(page_config);
            return;
        }

        // Page is ready

        // Header
        page_config.header_config = {
            icon: "fas fa-archive",
            title: `${ queried_page_fullname } — Archive`
        };

        // Breadcrumbs
        page_config.breadcrumbs_data.push([queried_page_fullname, "fas fa-file"]);

        // Get js and css
        const page_js = fs.readFileSync("./static/DeletedWikiPages/script.js", "utf8");

        page_config.page.additional_js = [page_js];

        // Get users
        const users: any = {};
        const userids: string[] = [];
        let user_query_error = false;

        for(const p of deleted_page_query) {
            if(!userids.includes(p.deleted_by)){
                userids.push(p.deleted_by);
            }
        }

        // Query users
        await new Promise((resolve_user_query: any) => {
            sql.query(`SELECT id, \`username\` FROM \`users\` WHERE id IN (${ userids.join(",") })`,
            (error: any, results: any) => {
                if(error || results.length === 0) {
                    user_query_error = true;
                } else {
                    for(const result of results) {
                        users[result.id] = result.username;
                    }
                }

                resolve_user_query();
            });
        });

        // Versions HTML
        let versions_html = "";

        for(const p of deleted_page_query) {
            const deleted_on = new Date(p.deleted_on * 1000).toUTCString();

            versions_html += `\
<div data-pageid="${ p.id }" class="ui-checkbox-1">
    <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
    <div class="text ui-text"><code>${ p.id }:</code> \
deleted by <a href="/User:${ users[p.deleted_by] }">${ users[p.deleted_by] }</a> on ${ deleted_on } \
<i>(${ p.delete_summary || "no summary given" })</i></div>
</div>`;
        }

        // Body HTML
        page_config.body_html = `\
<form name="deletedwikipages-versionselect" class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("versionselect", "Versions", "If the page was deleted more than once, select the version you need \
from the list.") }

    ${ versions_html }
</form>

<form name="deletedwikipages-revisions" class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("revisions", "Revisions for selected version") }

    <div class="ui-text" id="deletedwikipages-revisions-status-text">No version selected</div>
    <div class="ui-form-container column-reverse margin-top" id="deletedwikipages-revisions-container"></div>
</form>

<form name="deletedwikipages-preview" class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("preview", "Revision preview") }

    <div input name="retrieve_rendered_revisions" class="ui-checkbox-1">
        <div class="checkbox">${ UI_CHECKBOX_SVG }</div>
        <div class="text">Show rendered revisions instead of wikitext</div>
    </div>

    <div style="with: 100%; height: 1px; margin: 15px 25px; background-color: var(--color-gray3)"></div>

    <div class="ui-text" id="deletedwikipages-revision-content">Select a revision you want to preview from the revisions list</div>
</form>

<form name="deletedwikipages-restoreform" class="ui-form-box" data-restore-prohibited="${ page_with_such_name_exists ? "true" : "false" }">
    ${ UI.constructFormBoxTitleBar("restore", "Restore page") }

    ${ page_with_such_name_exists ? `<div class="ui-text w-icon margin-bottom">
    <div class="icon orange"><i class="fas fa-exclamation-triangle"></i></div>
    <div class="text">This page can not be restored because a page with such name currently exists.</div>
    </div>` : "" }

    <div class="ui-text margin-bottom">Keep in mind that <i>all</i> the revisions from the selected version will be restored. \
The selected revision will not affect anything, it is there just for previewing purposes.</div>

    <div class="ui-text margin-bottom">Selected version: <span id="deletedwikipages-selectedversion-text"><i>(none)</i></span></div>

    <div class="ui-input-box margin-top">
        <div class="popup"></div>
        <div class="ui-input-name1">Reason</div>
        <input type="text" name="summary" data-handler="summary" class="ui-input1">
    </div>

    <div class="ui-form-container right margin-top">
        <button name="submit" class="ui-button1 disabled">Restore page</button>
    </div>
</form>
`;

        resolve(page_config);
    });
}
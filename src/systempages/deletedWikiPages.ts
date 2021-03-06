import * as Page from "../page";
import * as User from "../user";
import * as UI from "../ui";
import { UI_CHECKBOX_SVG } from "../constants";
import { sql } from "../server";
import { pageTitleParser } from "../routes";
import { registry_namespaces } from "../registry";

export async function deletedWikiPages(page: Page.ResponsePage, client: User.User): Promise<Page.SystempageConfig> {
    return new Promise(async (resolve: any) => {
        const queried_page_fullname = page.address.query.title;

        const page_config: Page.SystempageConfig = {
            page,

            breadcrumbs_data: [ ["Deleted Pages", "fas fa-archive", "/System:DeletedWikiPages"] ],

            body_html: ""
        }

        // Get the files
        const page_files = await Page.getPageFiles("System:DeletedWikiPages", {
            js: "./static/DeletedWikiPages/script.js"
        });

        page.additional_js = [page_files.js];

        if(!queried_page_fullname) {
            // No page title

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
        <input type="text" name="page_title" data-handler="page_title" class="ui-input1">
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
            client_groups = await User.getRights(client.id).catch(() => undefined);
        }

        if(!client_groups || !client_groups.rights.wiki_restorepage) {
            // No permission

            page_config.header_config = {
                icon: "fas fa-archive",
                title: "Deleted Pages",
                description: `Access denied`
            };

            page_config.body_html = `\
            <div class="ui-info-box c-red">
                <div class="icon"><i class="fas fa-times"></i></div>
                <div class="text">You don't have permission to view or restore wiki pages.</div>
            </div>`;

            resolve(page_config);
            return;
        }

        // Get the page
        const page_address = pageTitleParser(queried_page_fullname);

        const existent_page_query: any = await Page.getPageInfo(page_address);
        const deleted_page_query = await Page.getDeletedPageInfo(page_address);

        // Page with such name currenly exists
        const page_with_such_name_exists = existent_page_query[1].length !== 0;

        // No pages in archive found
        if(!deleted_page_query || deleted_page_query.length === 0) {
            page_config.header_config = {
                icon: "fas fa-archive",
                title: `${ page_address.display_title } — Archive`,
                description: `No records found`
            };

            page_config.body_html = `\
            <div class="ui-info-box c-red">
                <div class="icon"><i class="fas fa-times"></i></div>
                <div class="text">No records were found for the requested title.</div>
            </div>`;

            page_config.breadcrumbs_data.push([page_address.display_title, "fas fa-file"]);

            resolve(page_config);
            return;
        }

        // Page is ready

        // Header
        page_config.header_config = {
            icon: "fas fa-archive",
            title: `${ page_address.display_title } — Archive`
        };

        // Breadcrumbs
        page_config.breadcrumbs_data.push([page_address.display_title, "fas fa-file"]);

        // Get users
        const users: any = {};
        const userids: number[] = [];

        // TODO figure out what i was trying to do here :P
        // let user_query_error = false;

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
                    // user_query_error = true;
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

    <div class="ui-form-spacer-thin"></div>

    <div class="ui-text" id="deletedwikipages-revision-content">Select a revision you want to preview from the revisions list</div>
</form>

<form name="deletedwikipages-restoreform" class="ui-form-box">
    ${ UI.constructFormBoxTitleBar("restore", "Restore page") }

    ${ page_with_such_name_exists ? `
    <div class="ui-info-box c-orange">
        <div class="icon"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="text">A page with such title already exists. Please, pick another title to restore the page to.</div>
    </div>` : "" }

    <div class="ui-text margin-bottom">Keep in mind that <i>all</i> the revisions from the selected version will be restored. \
The selected revision will not affect anything, it is there just for previewing purposes.</div>

    <div class="ui-text margin-bottom">Selected version: <span id="deletedwikipages-selectedversion-text"><i>(none)</i></span></div>

    <div class="ui-form-spacer-thin"></div>

    <div input-container class="ui-input-box margin-top">
        <div class="ui-input-name1">Restore to</div>
        <div class="ui-form-container between">
            <div input class="ui-input-dropdown1" name="new_namespace" style="margin-right: 3px">
                <input disabled type="text" value="${ page_address.namespace }">
                <div class="arrow-icon"><i class="fas fa-chevron-down"></i></div>
                <div class="choices">
                    ${ namespace_select_html }
                </div>
            </div>

            <input type="text" name="new_name" value="${ decodeURIComponent(page_address.name) }" data-handler="page_names" class="ui-input1" style="margin-left: 3px">
        </div>
    </div>

    <div class="ui-text small gray" style="margin-top: 5px">Page can only be restored to <code>wiki</code> namespaces. You can manage namespaces <a href="/System:Namespaces">here</a>.</div>

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
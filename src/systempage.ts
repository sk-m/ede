import fs from "fs";
import path from "path";

import * as Page from "./page";
import * as Util from "./utils";
import { registry_systempages } from "./registry";

/**
 * Register system pages that are not provided by the ede backend. For example, System:Login is not provided by the backend,
 * it's just a simple page in System namespace
 */
export function registerNonSytemSystempages(): void {
    const registry_systempages_snapshot = registry_systempages.get();

    fs.readdir(path.join(__dirname, "../content/pages/System"), (dirs_error: any, folders: string[]) => {
        if(dirs_error) {
            const error_message = "Could not read system namespace (\"/content/pages/System\")";

            Util.log(error_message, 3);
            return new Error(error_message);
        }

        for(const folder_name of folders) {
            // Namespace is not registered, register here
            const lowercase_name = folder_name.toLowerCase();

            if(registry_systempages_snapshot[lowercase_name] === undefined) {
                registry_systempages_snapshot[lowercase_name] = {
                    name: lowercase_name,
                    display_title: folder_name,

                    source: "ede",

                    static_fs_content: true
                };
            }
        }

        // Update the registry
        registry_systempages.set(registry_systempages_snapshot);

        return;
    });
}

// TODO maybe get rid entirely
export async function defaultSystempageHandler(page: Page.ResponsePage): Promise<Page.ResponsePage> {
    return new Promise(async (resolve: any) => {
        const raw_page: Page.ResponsePage = await Page.getRaw(page.address);

        // TODO there should be a better way
        const js_address = Object.assign({}, page.address);
        js_address.url_params = [ ...page.address.url_params, "script.js" ];

        const css_address = Object.assign({}, page.address);
        css_address.url_params = [ ...page.address.url_params, "styles.css" ];

        let page_css;
        let page_js;

        // Check if requesting a .js, .css or .json file
        if(raw_page.page_lang !== "none") {
            page.page_lang = raw_page.page_lang;
        } else {
            page_css = await Page.getRaw(css_address, true);
            page_js = await Page.getRaw(js_address, true);

            page.info = raw_page.info;
        }

        page.parsed_content = raw_page.raw_content;
        page.status = raw_page.status;

        page.additional_css = [page_css ? page_css.raw_content as string : ""];
        page.additional_js = [page_js ? page_js.raw_content as string : ""];

        resolve(page);
    });
}

/**
 * Function for constructing HTML for systempages
 *
 * @param config systempage configuration
 *
 * Example for config.sidebar_config: {
 *   links: [
 *       {
 *           type: "heading",
 *           text: "Actions on selected user"
 *       },
 *       {
 *           type: "link",
 *           text: "Related logs",
 *           icon: "fas fa-list"
 *       },
 *       {
 *           type: "spacer",
 *           invisible: true
 *       },
 *       {
 *           type: "link",
 *           text: "Manage this user",
 *           icon: "fas fa-cog"
 *       },
 *       {
 *           type: "link",
 *           additional_classes: "red",
 *           text: "Block this user",
 *           icon: "fas fa-minus-circle"
 *       },
 *   ],
 *   something: "this <i>pure HTML</i> will be added to the sidebar"
 * }
 */
export function systempageBuilder(config: Page.SystempageConfig): Page.ResponsePage {
    let header_html = "";
    let breadcrumbs_html = "";
    let sidebar_html = "";

    // Construct header
    if(config.header_config) {
        header_html = `\
<div class="ui-systempage-header-box">
    <div class="title-container">
        <div class="icon"><i class="${ config.header_config.icon }"></i></div>
        <div class="title">${ config.header_config.title }</div>
    </div>
    ${ config.header_config.description ? `<div class="text">${ config.header_config.description }</div>` : "" }
    ${ config.header_config.body || "" }
</div>`;
    }

    // Construct breadcrumbs
    if(config.breadcrumbs_data) {
        let items_html = "";
        let is_first = true;

        for(const item of config.breadcrumbs_data) {
            // Add a separator
            if(!is_first) items_html += `<div class="separator"><i class="fas fa-chevron-right"></i></div>`;

            items_html += `<a ${ item[2] ? `href="${ item[2] }" title="Go to ${ item[2] }"` : "" }class="item">\
${ item[1] ? `<i class="${ item[1] }"></i>` : "" }\
${ item[0] }</a>`;

            is_first = false;
        }

        breadcrumbs_html = `<div class="ui-systempage-breadcrumbs">${ items_html }</div>`;
    }

    // Construct sidebar
    if(config.sidebar_config) {
        for(const key in config.sidebar_config) {
            if(config.sidebar_config[key]) {
                if(key === "links") {
                    // Config for links
                    const links_array = config.sidebar_config[key];

                    if(Array.isArray(links_array)) {
                        let links_html = "";

                        for(const el of links_array) {
                            // Element types
                            if(el.type === "heading") links_html += `<div class="heading">${ el.text }</div>`
                            else if(el.type === "spacer") links_html += `<div class="spacer${ el.invisible ? " invisible" : "" }"></div>`
                            else if(el.type === "link") links_html += `<a href="${ el.href || "#" }" class="link ${ el.additional_classes || "" }"><i class="${ el.icon }"></i> ${ el.text }</a>`
                        }

                        sidebar_html += `<div class="links">${ links_html }</div>`;
                    }
                } else {
                    // Something custom, just add HTML to the final string
                    if(typeof config.sidebar_config[key] === "string") {
                        sidebar_html += config.sidebar_config[key];
                    }
                }
            }
        }
    }

    config.page.parsed_content = `\
${ breadcrumbs_html }
${ header_html }

<div class="ui-systempage-content-container">
    <div class="ui-systempage-main-content">
        ${ config.body_html }
    </div>
    ${ sidebar_html ? `\
    <div class="ui-systempage-sidebar-right">
        <div class="sidebar">
            ${ sidebar_html }
        </div>
    </div>` : "" }
</div>`;

    return config.page;
}
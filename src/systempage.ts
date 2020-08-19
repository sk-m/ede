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

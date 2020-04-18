import * as Page from "./page";

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

import * as User from "../user";
import * as Page from "../page";

export async function login(page: Page.ResponsePage, _client: User.User): Promise<Page.ResponsePage> {
    return new Promise(async (resolve: any) => {
        // Get the files
        const page_files = await Page.getPageFiles("System:Login", {
            js: "./static/Login/script.js",
            css: "./static/Login/styles.css",
            html: "./static/Login/content.html",
        });

        page.additional_css = [page_files.css];
        page.additional_js = [page_files.js];
        page.parsed_content = page_files.html;

        // Set some info items
        page.info.hiddentitle = true;

        resolve(page);
    });
}
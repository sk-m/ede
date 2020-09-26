import fs from "fs";

import * as User from "../user";
import * as Page from "../page";

export async function login(page: Page.ResponsePage, _client: User.User): Promise<Page.ResponsePage> {
    return new Promise((resolve: any) => {
        // Load css and js files for this system page
        const page_css = fs.readFileSync("./static/Login/styles.css", "utf8");
        const page_js = fs.readFileSync("./static/Login/script.js", "utf8");

        page.additional_css = [page_css];
        page.additional_js = [page_js];

        const page_content = fs.readFileSync("./static/Login/content.html", "utf8");
        page.parsed_content = page_content;

        // Set some info items
        page.info.hiddentitle = true;
        page.info.nocontainer = true;

        resolve(page);
    });
}
import fs from "fs";

import * as User from "../user";
import * as Page from "../page";
import * as SystemMessages from "../system_message";
import { registry_systempages } from "../registry";

// TODO @performance
async function constructSystemPagesListHTML(): Promise<string> {
    const systempages_snapshot = registry_systempages.get();
    const sysmsgs = await SystemMessages.get_all(undefined, undefined, "dashboard-categoryname");
    const categories: { [category_name: string]: string } = {};
    let final_html = "";

    // For every system page
    for(const systempage_name in systempages_snapshot) {
        if(systempages_snapshot[systempage_name]) {
            const systempage = systempages_snapshot[systempage_name];
            const display_category = systempage.display_category || "other";

            if(!categories[display_category]) categories[display_category] = "";

            categories[display_category] += `\
<div class="systempage-item" onclick="ede.navigate('/System:${ systempage_name }')">
    <div class="left">
        <div class="icon"><i class="${ systempage.display_icon || "fas fa-ellipsis-h" }"></i></div>
        <div class="name-container">
            <div class="name">${ systempage.display_title }</div>
            ${ systempage.display_description ? `<div class="description">${ systempage.display_description }</div>` : "" }
        </div>
    </div>
    <div class="right">
        <div class="icons">
            ${ systempage.source !== "ede" ? `<div class="icon" title="System page provided by '${ systempage.source }' extension"><i class="fas fa-puzzle-piece"></i></div>` : "" }
        </div>
    </div>
</div>`;
        }
    }

    // Construct sections
    // tslint:disable-next-line: forin
    for(const cat_name in categories) {
        const sysmsg_name = `dashboard-categoryname-${ cat_name }`;

        final_html += `\
<div class="section">
    <div class="section-name">
        <div class="name">${ sysmsgs[sysmsg_name] ? sysmsgs[sysmsg_name].value : `[! SYSMSG ${ sysmsg_name } !]` }</div>
        <div class="line"></div>
    </div>
    ${ categories[cat_name] }
</div>`;
    }

    return final_html;
}

export async function dashboard(page: Page.ResponsePage, client: User.User): Promise<Page.ResponsePage> {
    return new Promise(async (resolve: any) => {
        // Load css and js files for this system page
        const page_css = fs.readFileSync("./static/Dashboard/styles.css", "utf8");
        const page_js = fs.readFileSync("./static/Dashboard/script.js", "utf8");

        page.additional_css = [page_css];
        page.additional_js = [page_js];

        // Set some info items
        page.info.hiddentitle = true;
        page.info.nocontainer = true;

        page.parsed_content = `\
<div class="ui-systempage-header-box">
    <div class="title-container">
        <div class="icon"><i class="fas fa-tachometer-alt"></i></div>
        <div class="title">Dashboard</div>
    </div>
</div>

<div id="systempage-dashboard-root">
    ${ await constructSystemPagesListHTML() }
</div>`;

        resolve(page);
    });
}
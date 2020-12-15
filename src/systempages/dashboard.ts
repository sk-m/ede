import * as User from "../user";
import * as Page from "../page";
import * as SystemMessages from "../system_message";
import { registry_systempages } from "../registry";
import { _mailer_failed, _mailer_ok, _redis_failed, _redis_ok } from "../server";

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
        // Get the files
        const page_files = await Page.getPageFiles("System:Dashboard", {
            js: "./static/Dashboard/script.js",
            css: "./static/Dashboard/styles.css",
        });

        page.additional_css = [page_files.css];
        page.additional_js = [page_files.js];

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
    <div class="status-root">
        <div class="column" style="width: 50%">
            <div class="row">
                <div class="status-panel"><i>Something will be here some day...</i></div>
            </div>
        </div>
        <div class="column" style="width: 50%">
            <div class="row">
                <div class="status-panel clients-status">
                    <div class="client c-${ _mailer_ok ? "green" : (_mailer_failed ? "red" : "gray") }">
                        <div class="left">
                            <div class="icon"><i class="fas fa-envelope"></i></div>
                            <div class="name">Mailer</div>
                        </div>
                        <div class="right">
                            <div class="status"><i class="fas fa-${ _mailer_ok ? "check" : (_mailer_failed ? "exclamation" : "dot-circle") }"></i></div>
                        </div>
                    </div>
                    <div class="client c-${ _redis_ok ? "green" : (_redis_failed ? "red" : "gray") }">
                        <div class="left">
                            <div class="icon"><i class="fas fa-fire"></i></div>
                            <div class="name">Caching client</div>
                        </div>
                        <div class="right">
                            <div class="status"><i class="fas fa-${ _redis_ok ? "check" : (_redis_failed ? "exclamation" : "dot-circle") }"></i></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    ${ await constructSystemPagesListHTML() }
</div>`;

        resolve(page);
    });
}
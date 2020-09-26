import * as Sqrl from "squirrelly";

import * as Page from "./page";
import { registry_skins, registry_config } from "./registry";
import * as Util from "./utils";
import * as User from "./user";

export function pageTitleParser(raw_title: string): any {
    let name: string;
    let namespace: string;

    const url_params = raw_title.split("/");

    // Check if namespace was provided
    if(raw_title.indexOf(":") > -1) {
        const name_split = url_params[0].split(":", 2);

        namespace = name_split[0];
        name = name_split[1];
    } else {
        namespace = "Main";
        name = raw_title;
    }

    return { name, namespace };
}

/** @ignore */
export function directRouteWrapper(page: Page.ResponsePage, additional_options?: any): string {
    const registry_config_snapshot = registry_config.get();
    const registry_skins_snapshot = registry_skins.get();

    const current_instance_displayname = registry_config_snapshot["instance.display_name"].value as string;
    const current_skin_name = registry_config_snapshot["instance.current_skin"].value as string;
    let current_skin = registry_skins_snapshot[current_skin_name];

    if(!current_skin) {
        current_skin = registry_skins_snapshot.Omicron;

        Util.log(`Current skin '${ current_skin_name }' is not loaded. Reverting to 'Omicron'`, 3);
    }

    const frontend_page_object: Page.ResponsePage = {
        ...page,

        parsed_content: undefined,

        additional_css: [],
        additional_js: [],
    };

    // TODO we should have an object on frontend with common config items such as instance_name,
    // current_skin, etc.
    const page_info_js: string[] =
    [`/* This script was automatically generated by the EDE engine. */\n\n\
ede.current_page = ${ JSON.stringify(frontend_page_object) };
ede.instance_display_name = \`${ current_instance_displayname }\`;`];

    return Sqrl.Render(current_skin.html, {
        ede_page_title: (page.display_title && decodeURIComponent(page.display_title)) || "",
        ede_page_content: page.parsed_content || "",
        ede_page_additionalinfo_badges: page.badges,
        ede_page_subnametext: registry_config_snapshot["instance.page_subnametext"].value as string || "",
        ede_page_hiddentitle: page.info && page.info.hiddentitle as boolean,
        ede_page_nocontainer: page.info && page.info.nocontainer as boolean,

        ede_instance_displayname: current_instance_displayname,

        ede_js: [page_info_js, ...page.additional_js],
        ede_css: page.additional_css,

        ...additional_options
    });
}

/** @ignore */
// TODO most of this should be moved to the getPage() method
export async function directRoute(req: any, res: any): Promise<void> {
    if(req.params["*"] === "favicon.ico") {
        res.status(404).send();
        return;
    }

    const client_user = await User.getFromSession(req, "invalid").catch(() => undefined);

    const url_split = req.raw.originalUrl.substring(1).split("?", 2);
    const url_params = url_split[0].split("/");

    let name: string;
    let namespace: string;

    // Check if namespace was provided
    // TODO @refactor made a small change, check if everything still works
    if(url_split[0].indexOf(":") > -1) {
        const name_split = url_params[0].split(":", 2);

        namespace = name_split[0];
        name = name_split[1];
    } else {
        namespace = "Main";
        name = url_split[0];
    }

    const address: Page.PageAddress = {
        name,
        namespace,

        raw_url: req.raw.originalUrl,
        query: req.query,
        url_params,
    };

    // Get the requested page and send to the client
    Page.get(address, client_user as User.User)
    .then((page: Page.ResponsePage) => {
        if(client_user) {
            res.type("text/html").send(directRouteWrapper(page, {
                ede_user_username: client_user.username
            }));
        } else {
            res.type("text/html").send(directRouteWrapper(page));
        }
    })
}

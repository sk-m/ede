import fs from "fs";

import { sql } from "./server";
import * as Util from "./utils";
import { registry_namespaces, registry_systempages } from "./registry";
import * as SystemMessage from "./system_message";
import { defaultSystempageHandler, systempageBuilder } from "./systempage";
import * as User from "./user";

export type SystemPageDescriptorsObject = { [name: string]: SystemPageDescriptor };

/** The params are primarily used for system pages that list other system pages (like dashboard) */
export interface SystemPageDescriptor {
    /** Internal name */
    name: string;

    display_title: string;
    display_category?: string;
    display_description?: string;
    display_icon?: string;

    /** Extension that provides this system page */
    source: string;

    static_content?: string;
    static_fs_content?: boolean;
    systempage_config?: (page: ResponsePage, client: User.User) => Promise<SystempageConfig>;
    dynamic_content?: (page: ResponsePage, client: User.User) => Promise<ResponsePage> | ResponsePage;
}

export interface SystempageConfig {
    page: ResponsePage;

    body_html: string;

    header_config?: SystempageHeaderConfig;
    breadcrumbs_data?: any;
    sidebar_config?: any;
}

export interface SystempageHeaderConfig {
    icon: string;
    title: string;

    description?: string;
    body?: string;
}

export interface ResponsePage {
    readonly address: PageAddress;

    display_title?: string;

    raw_content?: string;
    parsed_content?: string;

    status: string[];

    /** Page's language (ex. json, js, css, none) */
    page_lang?: string;

    info: PageInfoItemsObject;

    badges: string[];

    additional_css: string[];
    additional_js: string[];

    access_time_ms?: number;
    parse_time_ms?: number;
}

export interface PageAddress {
    namespace: string;
    name: string;

    query: string[];
    url_params: string[];

    raw_url: string;
}

// TODO This is not a good system. We have to describe the value type, source and display every time we set the option
// So, if we want to hide a titlebar of a page, we can't just do `page.info.hidetitle = false`
// We have to write `page.info.hidetitle = { value_type: "boolean", source: "ede", display_name: "abc" ... }`
export type PageInfoItemsObject = { [internal_name: string]: PageInfoItem };
export interface PageInfoItem {
    display_name: string;

    value_type: "string" | "number" | "boolean" | "json" | "array";
    value: string | number | boolean | string[] | undefined;

    /** Name of the extension that provided the info type */
    source: string;
}

export type NamespacesObject = { [name: string]: Namespace }
export interface Namespace {
    name: string;

    action_restrictions: { [action_name: string]: string };
    info: PageInfoItemsObject;

    // TODO this will be moved into namespace_info
    show_in_title: boolean;

    handler?: (address: PageAddress, client: User.User) => Promise<ResponsePage>;
}

// TODO This is not the right way to do it
export async function systemNamespaceHandler(address: PageAddress, client: User.User): Promise<ResponsePage> {
    return new Promise(async (resolve: any) => {
        const systempage_badge_sysmsg = await SystemMessage.get("page-badge-systempage") as SystemMessage.SystemMessage;

        // Sets the content to notfound system message and appends a notfound badge
        const notFound = (notfound_page: ResponsePage) => {
            return new Promise(async (notfound_resolve: any) => {
                const sysmsgs = await SystemMessage.get([
                    "systempage-error-notfound",
                    "page-badge-pagenotfound"
                ]) as SystemMessage.SystemMessagesObject;

                notfound_page.parsed_content = sysmsgs["systempage-error-notfound"].value;
                notfound_page.badges.push(sysmsgs["page-badge-pagenotfound"].value);

                notfound_resolve(notfound_page);
            });
        }

        let page: ResponsePage = {
            address,

            display_title: address.name,

            badges: [systempage_badge_sysmsg.value],

            additional_css: [],
            additional_js: [],

            info: {},

            status: []
        };

        // Get system page from the registry
        const registry_systempages_snapshot = registry_systempages.get();
        const lowercase_name = address.name.toLowerCase();

        if(registry_systempages_snapshot[lowercase_name] && !registry_systempages_snapshot[lowercase_name].static_fs_content) {
            const systempage: SystemPageDescriptor = registry_systempages_snapshot[lowercase_name];

            page.display_title = systempage.display_title;

            if(systempage.systempage_config) {
                page = systempageBuilder(await systempage.systempage_config(page, client));
            } else if(systempage.dynamic_content) {
                page = await systempage.dynamic_content(page, client);
            } else {
                page.parsed_content = systempage.static_content;
            }
        } else {
            page = await defaultSystempageHandler(page);

            if(page.status.includes("page_not_found")) {
                page = await notFound(page) as ResponsePage;
            }
        }

        resolve(page);
    });
}

/**
 * Get all namespaces from the database
 *
 * @category Registry updater
 */
export async function getNamespacesFromDB(): Promise<NamespacesObject> {
    return new Promise((resolve: any, reject: any) => {
        sql.query("SELECT * FROM `namespaces`", (error: Error, results: any) => {
            if(error) {
                Util.log(`Failed to get namespaces from the database`, 3, error);

                reject(error);
                return;
            }

            const namespaces: NamespacesObject = {};

            // We should have a namespace_info JSON object instead (like pages do)
            for(const namespace of results) {
                namespaces[namespace.name] = {
                    ...namespace,

                    show_in_title: namespace.show_in_title.readInt8(0) === 1
                };
            }

            resolve(namespaces);
        });
    });
}

/**
 * Get info about a page from the database
 *
 * @returns resolves [[PageInfoItemsObject]] on success, rejects [[ErrorCode]] on error
 */
export async function getDBInfo(address: PageAddress): Promise<PageInfoItemsObject> {
    return new Promise((resolve: any, reject: any) => {
        sql.query(`SELECT \`page_info\` FROM pages WHERE \`namespace\` = '${ Util.sanitize(address.namespace) }' \
AND \`name\` = '${ Util.sanitize(address.name) }'`, (_: any, results: any) => {
            // Page's page_info
            // TODO values for params should be cast just like in cofig.ts
            // TODO @draft
            if(results[0] && results[0].page_info) {
                resolve(results[0].page_info);
            } else {
                // TODO we should have descriptive error messages
                reject("page_not_found");
            }
        });
    });
}

/**
 * Get raw page contents
 *
 * @param address
 * @param skip_db_info Do not query information about this page from the database
 */
// TODO @refactor
// TODO maybe we should be able to request a page using a stirng address like `System:Login/styles.css`
// TODO do we readlly need this function to be this big? Definitely need to refactor
export async function getRaw(address: PageAddress, skip_db_info: boolean = false): Promise<ResponsePage> {
    return new Promise(async (resolve: any) => {
        const time_start = process.hrtime();

        const page: ResponsePage = {
            address,

            additional_css: [],
            additional_js: [],

            badges: [],
            info: {},

            status: []
        };

        // Get the info from the database
        if(!skip_db_info) {
            await getDBInfo(address)
            .then((page_info: PageInfoItemsObject) => {
                page.info = page_info;
            })
            .catch(() => {
                page.info = {};
            });
        }

        let path_name;
        let code_page_lang = "none";

        const last_param = address.url_params[address.url_params.length - 1];

        const name_dot_pos = address.name.indexOf(".");
        const params_dot_pos = last_param.indexOf(".");

        if(name_dot_pos > -1 || params_dot_pos > -1) {
            // Requesting a .css, .js, or .json content
            // We don't have to worry about multiple dots in a name becase styles.css, script.js,
            // content.html etc. all have only one dot, if the requested page has more than one dot, than it's
            // not an html, css, js or json page

            let format: string = "";

            if(name_dot_pos > -1) {
                format = address.name.substr(name_dot_pos);
                path_name = `${ address.name }/${ address.name.replace(/&#47;/g, "/") }`;
            } else if(params_dot_pos > -1) {
                format = last_param.substr(params_dot_pos);
                path_name = `${ address.name }/${ last_param.replace(/&#47;/g, "/") }`;
            }

            if( format !== "" &&
                (format === ".html" || format === ".css" ||
                format === ".js" || format === ".json")
            ) {
                code_page_lang = format.substring(1);
            } else {
                path_name = `${ address.name }/content.html`;
            }
        } else {
            path_name = `${ address.name }/content.html`;
        }

        const full_address = `./content/pages/${ address.namespace }/${ path_name }`;

        fs.readFile(full_address, "utf8",
        async (error: any, data?: string) => {
            // Page was not found
            if(error) {
                page.status.push("page_not_found");
            } else {
                page.page_lang = code_page_lang;

                page.raw_content = data;
            }

            page.access_time_ms = process.hrtime(time_start)[1] / 1000000;

            resolve(page);
        });
    });
}

/**
 * Get page (rendered and ready to be served to the client)
 *
 * @param address [[PageAddress]] object
 * @param skip_db_info Do not query information about this page from the database
 */
export async function get(address: PageAddress, client: User.User, skip_db_info: boolean = false): Promise<ResponsePage> {
    return new Promise((resolve: any) => {
        // Get the namespace handler
        const namespace = registry_namespaces.get()[address.namespace] as Namespace;

        // Handler for common namespaces (Main or nonexistent)
        const commonHandler = (page: ResponsePage) => {
            return new Promise(async (common_resolve: any) => {
                let error_sysmsgs: SystemMessage.SystemMessagesObject = {};

                // Page was not found
                if(page.status.includes("page_not_found")) {
                    // Get error system messages (we preload page-badge-namespacenotfound)
                    error_sysmsgs = await SystemMessage.get([
                        "page-error-notfound",
                        "page-badge-pagenotfound",
                        "page-badge-namespacenotfound"
                    ]) as SystemMessage.SystemMessagesObject;

                    page.parsed_content = error_sysmsgs["page-error-notfound"].value;
                    page.badges.push(error_sysmsgs["page-badge-pagenotfound"].value);
                }

                // Check if namespace exists
                if(namespace) {
                    page.display_title = `${ namespace.show_in_title ? (namespace.name + ":") : "" }\
${ address.name }`;
                } else {
                    page.display_title = `${ address.namespace }:${ address.name }`;
                    page.status.push("namespace_not_found");

                    page.badges.push(error_sysmsgs["page-badge-namespacenotfound"].value);
                }

                // TODO parse here
                if(!page.parsed_content) page.parsed_content = page.raw_content;

                common_resolve(page);
            });
        };

        // Namespace handler is available
        if(namespace && namespace.handler) {
            namespace.handler(address, client)
            .then(async (page: ResponsePage) => {
                resolve(page);
                return;
            });
        } else {
            // Main / nonexistent namespace
            getRaw(address, skip_db_info)
            .then(async (page: ResponsePage) => {
                resolve(await commonHandler(page));
            });
        }
    });
}

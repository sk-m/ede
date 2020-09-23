import crypto from "crypto";

import { sql } from "./server";
import * as Log from "./log";
import * as Util from "./utils";
import { registry_namespaces, registry_systempages } from "./registry";
import * as SystemMessage from "./system_message";
import { systempageBuilder } from "./systempage";
import * as User from "./user";
import { renderWikitext } from "./wikitext";
import sanitizeHtml from "sanitize-html";

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

export interface PageInfo {
    id: string;

    namespace: string;
    name: string;

    revision?: number;
    page_info: any;

    action_restrictions: any;

    is_deleted: boolean;
    deleted_by?: number;
    deleted_on?: number;
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
    content_model: string;

    // TODO this will be moved into namespace_info
    show_in_title: boolean;

    handler?: (address: PageAddress, client: User.User) => Promise<ResponsePage>;
}

// TODO This is not the right way to do it
export async function systemNamespaceHandler(address: PageAddress, client: User.User): Promise<ResponsePage> {
    return new Promise(async (resolve: any) => {
        const systempage_badge_sysmsg = (await SystemMessage.get(["page-badge-systempage"]))["page-badge-systempage"];

        // Sets the content to notfound system message and appends a notfound badge
        const notFound = (notfound_page: ResponsePage) => {
            return new Promise(async (notfound_resolve: any) => {
                const sysmsgs = await SystemMessage.get([
                    "systempage-error-notfound",
                    "page-badge-pagenotfound"
                ]);

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

        if(registry_systempages_snapshot[lowercase_name]) {
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
            page = await notFound(page) as ResponsePage;
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
        sql.execute("SELECT * FROM `namespaces`", (error: Error, results: any) => {
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
 * Sanitize raw wikitext (remove disallowed HTML tags and attributes)
 *
 * @param input raw wikitext
 */
export function sanitizeWikitext(input: string): string {
    return sanitizeHtml(input, {
        allowedTags: ["div", "code", "small"],
        allowedAttributes: {
            div: ["class", "style"]
        },

        disallowedTagsMode: "recursiveEscape"
    });
}

/**
 * Create a new revision (edit)
 *
 * @param page_address [[PageAddress]] object
 * @param new_raw_content new raw content
 * @param user user that created a revision
 * @param summary a short summary
 * @param tags tags for the revision
 * @param allow_page_creation if true, will reject, if the target page does not exist. If false, will create that page
 */
export async function createRevision(page_address: PageAddress, new_raw_content: string, user: User.User, summary?: string,
    tags?: string[], allow_page_creation: boolean = false): Promise<void> {
    return new Promise(async (resolve: any, reject: any) => {
        const clean_content = sanitizeWikitext(new_raw_content);
        const content_size = clean_content.length;

        // Create a content hash
        const shasum = crypto.createHash("sha1");
        shasum.update(clean_content);

        // Create a timestamp
        const created_on = Math.floor(new Date().getTime() / 1000);

        // Check if the page exisists
        let page_created = false;
        let target_page_id: any = await new Promise((resolve_page: any) => {
            sql.execute("SELECT id FROM `wiki_pages` WHERE `namespace` = ? AND `name` = ?",
            [page_address.namespace, page_address.name],
            (error: any, results: any) => {
                if(!error && results[0]) {
                    resolve_page(results[0].id);
                } else {
                    resolve_page(false);
                }
            });
        });

        // Page does not exist, create it
        if(target_page_id === false) {
            if(!allow_page_creation) {
                reject("page_not_found");
                return;
            }

            page_created = true;

            const page_info = {
                created_on,
                created_by: user.id
            };

            target_page_id = await new Promise((resolve_new_page: any) => {
                sql.execute("INSERT INTO `wiki_pages` (`namespace`, `name`, `revision`, `page_info`, `action_restrictions`) \
VALUES (?, ?, NULL, ?, '{}')",
                [page_address.namespace, page_address.name, JSON.stringify(page_info)],
                (error: any, results: any) => {
                    if(!error && results.insertId) {
                        resolve_new_page(results.insertId);
                    } else {
                        resolve_new_page(error);
                    }
                });
            });

            const full_address = `${ page_address.namespace }:${ page_address.name }`;

            // Log page creation
            Log.createEntry("createwikipage", user.id, target_page_id,
            `<a href="/User:${ user.username }">${ user.username }</a> created a wiki page <a href="/${ full_address }">${ full_address }</a>`, "");
        }

        // We could not create the page
        if(target_page_id instanceof Error) {
            reject(target_page_id);
            return;
        }

        const bytes_change_str = page_created ? content_size : `${ content_size } - @last_rev_size`;

        // Create a new revision and update the page
        // TODO @cleanup there is probably a better way to do this
        sql.query(`SET @last_rev_size := (SELECT \`bytes_size\` FROM \`revisions\` WHERE \`page\` = ? ORDER BY id DESC LIMIT 1); \
INSERT INTO \`revisions\` (\`page\`, \`user\`, \`content\`, \`content_hash\`, \`summary\`, \`timestamp\`, \`bytes_size\`, \`bytes_change\`)\
 VALUES (?, ?, ?, ?, ?, ?, ?, ${ bytes_change_str }); \
UPDATE \`wiki_pages\` SET \`revision\` = LAST_INSERT_ID() WHERE id = ?`,
[target_page_id, target_page_id, user.id, clean_content, shasum.digest("hex"), summary, created_on, content_size, target_page_id],
(error: any) => {
            if(!error) {
                resolve();
            } else {
                reject(error);
            }
        });
    });
}

/**
 * Delete the page
 *
 * @param page_id internal page id
 * @param completely_remove completely remove all related records (except logs) from the database?
 */
export async function deletePage(page_id: number, deleted_user_id: string, completely_remove: boolean = false): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        if(!completely_remove) {
            // First, get the page
            sql.execute("SELECT * FROM `wiki_pages` WHERE id = ?",
            [page_id],
            (get_error: any, results: any) => {
                if(get_error || results.length < 1) {
                    reject(get_error);
                    return;
                }

                const page = results[0];
                const now: number = Math.floor(new Date().getTime() / 1000);

                // Delete the page
                sql.query("INSERT INTO `deleted_wiki_pages` (`pageid`, `namespace`, `name`, `page_info`, `action_restrictions`, `deleted_by`, `deleted_on`) \
VALUES (?, ?, ?, ?, ?, ?, ?); DELETE FROM `wiki_pages` WHERE id = ?",
                [page_id, page.namespace, page.name, JSON.stringify(page.page_info), JSON.stringify(page.action_restrictions),
                deleted_user_id, now, page_id],
                (del_error: any) => {
                    if(!del_error) resolve();
                    else reject(del_error);
                });
            });
        } else {
            sql.query("DELETE FROM `revisions` WHERE `page` = ?; DELETE FROM `wiki_pages` WHERE id = ?; \
UPDATE `logs` SET `visibility_level` = b'1' WHERE `type` IN ('createwikipage','deletewikipage') AND `target` = ?",
            [page_id, page_id, page_id],
            (error: any) => {
                if(!error) resolve();
                else reject(error);
            });
        }
    });
}

/**
 * Restore the page
 *
 * @param page_id internal page id
 */
// export async function restorePage(page_id: number): Promise<void> {
//     return new Promise((resolve: any, reject: any) => {
//         sql.query("UPDATE `wiki_pages` SET `is_deleted` = b'0' WHERE id = ?; UPDATE `revisions` SET `is_deleted` = b'0' WHERE `page` = ?",
//         [page_id, page_id],
//         (error: any) => {
//             if(!error) resolve();
//             else reject(error);
//         });
//     });
// }

/**
 * Move (rename) the page
 *
 * @param page_id internal page id
 * @param new_namespace name of the namespace to move the page into
 * @param new_name new name for the page
 */
export async function movePage(page_id: number, new_namespace: string, new_name: string): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        const new_namespace_obj = registry_namespaces.get()[new_namespace];

        if(!new_namespace_obj) {
            reject(new Error(`Namespace '${ new_namespace }' does not exist.`));
            return;
        }

        if(new_namespace_obj.content_model !== "wiki") {
            reject(new Error(`You can only move pages to namespaces with 'wiki' content model.`));
            return;
        }

        sql.execute("UPDATE `wiki_pages` SET `namespace` = ?, `name` = ? WHERE id = ?",
        [new_namespace, new_name, page_id],
        (error: any) => {
            if(!error) resolve();
            else reject(error);
        });
    });
}

export async function getInfo(namespace: string, name: string, get_deleted: boolean = false): Promise<[boolean, PageInfo[]]> {
    return new Promise((resolve: any, reject: any) => {
        // Try to get the page
        sql.execute("SELECT * FROM `wiki_pages` WHERE `namespace` = ? AND `name` = ? LIMIT 1",
        [namespace, name],
        (normal_error: any, normal_results: any) => {
            if(!normal_error && normal_results.length !== 0) {
                // Normal page is ready
                resolve([false, [{
                    ...normal_results[0],

                    is_deleted: false
                }]]);
            } else if(get_deleted) {
                // The page was deleted
                sql.execute("SELECT * FROM `deleted_wiki_pages` WHERE `namespace` = ? AND `name` = ? LIMIT 1",
                [namespace, name],
                (deleted_error: any, deleted_results: any) => {
                    if(deleted_error || deleted_results.length === 0) {
                        reject(new Error("page_not_found"));
                        return;
                    }

                    const final_results: PageInfo[] = [];

                    for(const page of deleted_results) {
                        final_results.push({
                            ...page,

                            id: page.pageid,
                            is_deleted: true
                        })
                    }

                    // Deleted page is ready
                    resolve([true, final_results]);
                });
            } else {
                reject(new Error("page_not_found"));
            }
        });
    });
}

/**
 * Get raw page content
 */
export async function getRaw(namespace: string, name: string): Promise<ResponsePage> {
    return new Promise(async (resolve: any) => {
        const time_start = process.hrtime();

        const page: ResponsePage = {
            address: {
                namespace,
                name,

                raw_url: "",
                query: [],
                url_params: []
            },

            additional_css: [],
            additional_js: [],

            badges: [],
            info: {},

            status: []
        };

        // Get the page
        // TODO setting vars to NULL might be unnecessary
        sql.query("SET @revid = NULL; SELECT `revision` INTO @revid FROM `wiki_pages` \
WHERE `namespace` = ? AND `name` = ? LIMIT 1; SELECT `content` FROM `revisions` WHERE id = @revid;",
        [namespace, name],
        (error: any, results: any) => {
            // Page was not found
            if(error || !results[2][0]) {
                page.status.push("page_not_found");
            } else {
                const db_page = results[2][0];

                page.raw_content = db_page.content;
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
 */
export async function get(address: PageAddress, client: User.User): Promise<ResponsePage> {
    return new Promise((resolve: any) => {
        // Get the namespace handler
        const namespace = registry_namespaces.get()[address.namespace] as Namespace;

        // Handler for common namespaces (Main or nonexistent)
        const commonHandler = (page: ResponsePage) => {
            return new Promise(async (common_resolve: any) => {
                let error_sysmsgs: SystemMessage.SystemMessagesObject = {};

                // Page was not found
                if(page.status.includes("page_not_found")) {
                    const sysmsgs_query: any = [
                        "page-error-notfound",
                        "page-badge-pagenotfound",
                        "page-badge-namespacenotfound"
                    ];

                    if(page.status.includes("page_deleted")) {
                        sysmsgs_query.push("page-error-deleted");
                    }

                    // Get error system messages (we preload page-badge-namespacenotfound)
                    error_sysmsgs = await SystemMessage.get(sysmsgs_query);
                    page.parsed_content = "";

                    if(page.status.includes("page_deleted")) {
                        page.parsed_content += error_sysmsgs["page-error-deleted"].value + "<br>";
                    }

                    page.parsed_content += error_sysmsgs["page-error-notfound"].value;
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
                if(!page.parsed_content && page.raw_content) page.parsed_content = (await renderWikitext(page.raw_content)).content;

                common_resolve(page);
            });
        };

        // Namespace handler is available
        if(namespace && namespace.handler) {
            namespace.handler(address, client)
            .then((page: ResponsePage) => {
                resolve(page);
                return;
            });
        } else {
            // Main / nonexistent namespace
            getRaw(address.namespace, address.name)
            .then(async (page: ResponsePage) => {
                resolve(await commonHandler(page));
            });
        }
    });
}

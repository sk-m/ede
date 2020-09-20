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
export async function deletePage(page_id: number, completely_remove: boolean = false): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        if(!completely_remove) {
            sql.execute("UPDATE `wiki_pages` SET `is_deleted` = b'1' WHERE id = ?",
            [page_id],
            (error: any) => {
                if(!error) resolve();
                else reject(error);
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
        sql.query("SET @revid = NULL; SET @is_deleted = NULL; SELECT `revision`, `is_deleted` INTO @revid, @is_deleted FROM `wiki_pages` \
WHERE `namespace` = ? AND `name` = ? LIMIT 1; SELECT @is_deleted, `content` FROM `revisions` WHERE id = @revid;",
        [namespace, name],
        (error: any, results: any) => {
            // Page was not found
            if(error || !results[3][0]) {
                page.status.push("page_not_found");
            } else {
                const db_page = results[3][0];

                // Page is deleted
                if(db_page["@is_deleted"] === 1) {
                    page.status.push("page_not_found");
                } else {
                    page.raw_content = db_page.content;
                }
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

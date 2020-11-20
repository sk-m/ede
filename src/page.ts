import crypto from "crypto";
import * as JsDiff from "diff";

import { sql } from "./server";
import * as Log from "./log";
import * as Util from "./utils";
import { registry_namespaces, registry_systempages } from "./registry";
import * as SystemMessage from "./system_message";
import { systempageBuilder } from "./systempage";
import * as User from "./user";
import { renderWikitext } from "./wikitext";
import sanitizeHtml from "sanitize-html";
import bitwise from "bitwise";
import { UInt8 } from "bitwise/types";
import { pageTitleParser } from "./routes";

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
    pageid?: number;
    current_revision?: number;

    display_title?: string;

    raw_content?: string;
    parsed_content?: string;

    status: string[];

    /** Page's language (ex. json, js, css, none) */
    page_lang?: string;

    /**
     * Please, do not reassign this. If you want to add or remove an info item, just change the info item in question
     *
     * So, instead of `page.info = { hiddentitle: true }`, do `page.info.hiddentitle = true`
     */
    info: { [key: string]: any };

    badges: string[];

    additional_css: string[];
    additional_js: string[];

    access_time_ms?: number;
    parse_time_ms?: number;
}

export interface PageAddress {
    namespace: string;
    name: string;
    root_name: string;
    title: string;

    display_name: string;
    display_namespace: string;
    display_title: string;

    query: any;
    url_params: string[];

    raw_url: string;
}

export interface Revision {
    id: string;

    page?: number;
    user?: number;

    content?: string;
    content_hash?: string;

    summary?: string;

    overall_visibility: number;
    user_hidden: boolean;
    content_hidden: boolean;
    summary_hidden: boolean;

    tags: string[];

    timestamp: number;

    bytes_size?: number;
    bytes_change?: number;

    is_deleted: boolean;

    _filter_applied?: boolean;
}

// TODO merge into ^?
interface RevisionVisibility {
    overall_visibility: number;

    user_hidden: boolean,
    content_hidden: boolean,
    summary_hidden: boolean,
}

// TODO we already use term PageInfo
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

export type PageInfoTypes = { [internal_name: string]: PageInfoType };
export interface PageInfoType {
    display_name: string;
    description?: string;

    value_type: "string" | "number" | "boolean" | "json" | "array";
    default_value?: any;

    /** Name of the extension that provided the info type */
    source: string;
}

export type NamespacesObject = { [name: string]: Namespace }
export interface Namespace {
    name: string;

    action_restrictions: { [action_name: string]: string };

    /**
     * Please, do not reassign this. If you want to add or remove an info item, just change the info item in question
     *
     * So, instead of `page.info = { hiddentitle: true }`, do `page.info.hiddentitle = true`
     */
    info: { [key: string]: any };
    content_model: string;

    handler?: (address: PageAddress, client: User.User) => Promise<ResponsePage>;
}

/**
 * Handler for a System namespace. Only used internally, you probably do not want to call this.
 * @ignore
 */
export async function systemNamespaceHandler(address: PageAddress, client: User.User): Promise<ResponsePage> {
    return new Promise(async (resolve: any) => {
        // Get the "System page" badge (which is just a system message)
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

        // Create a page response
        let page: ResponsePage = {
            address,

            badges: [systempage_badge_sysmsg.value],

            additional_css: [],
            additional_js: [],

            info: {},

            status: []
        };

        // Get system page from the registry
        const registry_systempages_snapshot = registry_systempages.get();
        const lowercase_name = address.root_name.toLowerCase();

        // Check if such system page exists
        if(registry_systempages_snapshot[lowercase_name]) {
            const systempage: SystemPageDescriptor = registry_systempages_snapshot[lowercase_name];

            page.address.display_title = systempage.display_title;

            if(systempage.systempage_config) {
                // This particular systempage uses a systempage_config, use a builder to render it

                page = systempageBuilder(await systempage.systempage_config(page, client));
            } else if(systempage.dynamic_content) {
                // This particular systempage just returns some content. Call it's render function

                page = await systempage.dynamic_content(page, client);
            } else {
                // This particular systempage just returns some *static* content

                page.parsed_content = systempage.static_content;
            }
        } else {
            // Page was not found

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
export async function getAllNamespacesFromDB(): Promise<NamespacesObject> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("SELECT * FROM `namespaces`", (error: Error, results: any) => {
            if(error) {
                Util.log(`Failed to get namespaces from the database`, 3, error);

                reject(error);
                return;
            }

            const namespaces: NamespacesObject = {};

            for(const namespace of results) {
                namespaces[namespace.name] = namespace;
            }

            resolve(namespaces);
        });
    });
}

// TODO allow admins to edit this object (maybe even have different restrictions for different namespaces?)
/**
 * Sanitize raw wikitext (remove/sanitize disallowed HTML tags and attributes)
 *
 * @param input raw wikitext
 */
export function sanitizeWikitext(input: string): string {
    return sanitizeHtml(input, {
        allowedTags: ["div", "span", "br", "code", "small", "sup", "sub", "s"],
        allowedAttributes: {
            div: ["class", "style", "title"],
            span: ["class", "style", "title"],
        },

        disallowedTagsMode: "escape"
        // disallowedTagsMode: "recursiveEscape"
    });
}

/**
 * Create a new revision (edit)
 *
 * @param page_address page address object. *Must* be sanitized! Use pageTitleParser() to get one
 * @param new_raw_content new raw content
 * @param user user that created a revision
 * @param summary a short summary
 * @param tags tags for the revision (WIP)
 * @param allow_page_creation if false, will reject, if the target page does not exist. If true, will create that page
 */
export async function createRevision(page_address: PageAddress, new_raw_content: string, user: User.User, summary?: string,
    tags?: string[], allow_page_creation: boolean = false): Promise<void> {
    return new Promise(async (resolve: any, reject: any) => {
        // Sanitize the raw content (we do not render here, just sanitize)
        const clean_content = sanitizeWikitext(new_raw_content);

        // Get the size of the raw content
        const content_size = clean_content.length;

        // TODO we can check the size here

        // Create a content hash
        const shasum = crypto.createHash("sha1");
        shasum.update(clean_content);

        // Create a current timestamp
        const created_on = Math.floor(new Date().getTime() / 1000);

        // Check if the page exisists
        let target_page_id: number | false;
        let sql_error = false;

        const find_results = await sql.promise().execute("SELECT id FROM `wiki_pages` WHERE `namespace` = ? AND `name` = ?",
        [page_address.namespace, page_address.name])
        .catch((error: Error) => {
            reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Some error occured while trying to create a new page"));
            Util.log("Could not create a new page", 3, error);

            sql_error = true;
        });

        if(sql_error) return;

        if(find_results[0].length !== 0) {
            // Page exists, get the id

            target_page_id = find_results[0][0].id;
        } else {
            // Page does not exist, create it

            if(!allow_page_creation) {
                reject(new Util.Rejection(Util.RejectionType.PAGE_NOT_FOUND, "Page not found"));
                return;
            }

            // TODO @placeholder
            // Check and sanitize the title
            if(!page_address.name.match(/^[^|#<>{}\[\]]+$/) ||
                page_address.name.length < 1 ||
                page_address.name.length > 255 ||
                page_address.name[0] === ":" ||
                page_address.name[0] === " " ||
                page_address.name.endsWith(" ") ||
                page_address.name[0] === "." ||
                page_address.name[0] === "/" ||
                page_address.name.includes("  ") ||
                page_address.name.includes("./") ||
                page_address.name.includes("/.")) {
                reject("invalid_title");
                return;
            }

            const page_info = {
                created_on,
                created_by: user.id
            };

            // Create the actual page
            const create_results = await sql.promise().execute("INSERT INTO `wiki_pages` (`namespace`, `name`, `revision`, `page_info`,\
            `action_restrictions`) VALUES (?, ?, NULL, ?, '{}')",
            [page_address.namespace, page_address.name, JSON.stringify(page_info)])
            .catch((error: Error) => {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Some error occured while trying to create a new page"));
                Util.log("Could not create a new page", 3, error);

                sql_error = true;
            });

            if(sql_error) return;

            target_page_id = create_results[0].insertId;

            // Log page creation
            Log.createEntry("createwikipage", user.id, page_address.title,
            `<a href="/User:${ user.username }">${ user.username }</a> created a wiki page <a href="/${ page_address.title }">${ page_address.title }</a> \
(<code>${ target_page_id }</code>)`, "");
        }

        // We now have a page (we either created it, or found it)

        // Create a new revision and update the page
        sql.execute(`CALL wiki_create_revision(?, ?, ?, ?, ?, ?)`,
[target_page_id, user.id, clean_content, shasum.digest("hex"), summary, content_size],
(error: any) => {
            if(!error) {
                resolve();
            } else {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Some error occured while trying to create a new revision"));
                Util.log(`Could not create a new revision for a page (pageid ${ target_page_id || "?" })`, 3, error);
                return;
            }
        });
    });
}

/**
 * Delete the page
 *
 * @param page_id target page id
 */
export async function deletePage(page_id: number, deleted_user_id: string, summary?: string): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("CALL wiki_delete_page(?, ?, ?)",
        [page_id, deleted_user_id, summary],
        (error: any, results: any) => {
            if(error || results.length < 1) {
                reject(new Util.Rejection(Util.RejectionType.PAGE_NOT_FOUND, "Could not delete a wiki page. It might not exist."));
                return;
            }

            resolve();
        });
    });
}

/**
 * Restore the page
 *
 * @param page_id internal page id
 * @param new_namespace new namespace for the page (will be checked for content_model)
 * @param new_name new name for the page
 *
 * @returns [new page id, new page address, old page address]
 */
export async function restorePage(page_id: number, new_namespace?: string, new_name?: string): Promise<[number, PageAddress, PageAddress]> {
    return new Promise((resolve: any, reject: any) => {
        // Get the deleted page and the last revision
        sql.query("SELECT id FROM `revisions` WHERE `page` = ? ORDER BY id DESC LIMIT 1; \
SELECT * FROM `deleted_wiki_pages` WHERE `pageid` = ?",
        [page_id, page_id],
        async (get_error: any, results: any) => {
            if(get_error || results[0].length < 1) {
                // No such page in the archive;
                reject(new Util.Rejection(Util.RejectionType.PAGE_NOT_FOUND, "Could not find such page in the archive"));
                return;
            }

            const deleted_page = results[1][0];
            const revid = results[0][0].id;

            // New new namespace and/or a new name provided, use old ones
            if(!new_namespace) new_namespace = deleted_page.namespace;
            if(!new_name) new_name = deleted_page.name;

            // Get the new namespace
            const new_namespace_obj = registry_namespaces.get()[new_namespace as string];

            // Check if target namespace exists
            if(!new_namespace_obj) {
                reject(new Util.Rejection(Util.RejectionType.NAMESPACE_ERROR, "Target namespace does not exist"));
                return;
            }

            // Check if target namespace has a correct content model
            if(new_namespace_obj.content_model !== "wiki") {
                reject(new Util.Rejection(Util.RejectionType.NAMESPACE_ERROR, "Can not restore a page to a non-wiki namespace"));
                return;
            }

            // Get old and new address
            const old_address = pageTitleParser(`${ deleted_page.namespace }:${ deleted_page.name }`);
            const new_address = pageTitleParser(`${ new_namespace }:${ new_name }`);

            // Check if the page with target title already exists
            const current_page_query = await getPageInfo(new_address);

            if(current_page_query[1].length !== 0) {
                reject(new Util.Rejection(Util.RejectionType.PAGE_NAME_TAKEN, "A page with such title already exists"));
                return;
            }

            // Restore the page (move record from `deleted_wiki_pages` to `wiki_pages`, update pageid for all related revisions and
            // delete the record from `deleted_wiki_pages`)
            sql.execute("SELECT wiki_restore_page(?, ?, ?, ?, ?, ?) AS new_pageid",
            [page_id, new_address.namespace, new_address.name, revid,
            JSON.stringify(deleted_page.page_info), JSON.stringify(deleted_page.action_restrictions)],
            (restore_error: any, restore_results: any) => {
                if(restore_error) {
                    reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not restore a page"));
                    Util.log("Could not restore a page", 3, restore_error);

                    return;
                }

                // Page successfully restored
                resolve([
                    /* [0] => new pageid */ restore_results[0].new_pageid,
                    /* [1] => new address */ new_address,
                    /* [2] => old address */ old_address
                ]);
            });
        });
    });
}

/**
 * Move (rename) the page
 *
 * @param page_id target page id
 * @param new_namespace name of the namespace to move the page into
 * @param new_name new name for the page
 */
export async function movePage(page_id: number, new_namespace: string, new_name: string): Promise<void> {
    return new Promise(async (resolve: any, reject: any) => {
        // Get the new namespace
        const new_namespace_obj = registry_namespaces.get()[new_namespace];

        // Check if target namespace exists
        if(!new_namespace_obj) {
            reject(new Util.Rejection(Util.RejectionType.NAMESPACE_ERROR, "Target namespace does not exist"));
            return;
        }

        // Check if target namespace has a correct content model
        if(new_namespace_obj.content_model !== "wiki") {
            reject(new Util.Rejection(Util.RejectionType.NAMESPACE_ERROR, "Can not move a page to a non-wiki namespace"));
            return;
        }

        // TODO @cleanup this feels wrong
        // We have to make sure the title is encoded, but if the client sends an already encoded title, we would encode it twice, which
        // we don't want. Thats why we decode it first just to make sure
        const raw_title = `${ encodeURIComponent(decodeURIComponent(new_namespace)) }:${ encodeURIComponent(decodeURIComponent(new_name)) }`;
        const address = pageTitleParser(raw_title);

        // Check if the page with target title already exists
        const current_page_query = await getPageInfo(address);

        if(current_page_query[1].length !== 0) {
            reject(new Util.Rejection(Util.RejectionType.PAGE_NAME_TAKEN, "A page with such title already exists"));
            return;
        }

        // Move the page
        sql.execute("UPDATE `wiki_pages` SET `namespace` = ?, `name` = ? WHERE id = ?",
        [new_namespace, new_name, page_id],
        (error: any, results: any) => {
            if(error || results.affectedRows < 1) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not move a page"));
                Util.log(`Could not move a page (${ new_namespace }:${ new_name })`, 3, error);

                return;
            }

            resolve();
        });
    });
}

/**
 * Get info about a deleted page
 *
 * @param address target page's address
 */
export async function getDeletedPageInfo(address: PageAddress): Promise<PageInfo[]> {
    return new Promise((resolve: any) => {
        sql.execute("SELECT * FROM `deleted_wiki_pages` WHERE `namespace` = ? AND `name` = ?",
        [address.namespace, address.name],
        (deleted_error: any, deleted_results: any) => {
            if(deleted_error || deleted_results.length === 0) {
                // No pages with such title found

                resolve([]);
                return;
            }

            // Construct results
            const final_results: PageInfo[] = [];

            for(const page of deleted_results) {
                final_results.push({
                    ...page,

                    id: page.pageid,
                    is_deleted: true
                })
            }

            resolve(final_results);
        });
    });
}

/**
 * Get info about a page
 *
 * @param address target page's address
 * @param get_deleted get deleted pages?
 */
export async function getPageInfo(address: PageAddress, get_deleted: boolean = false): Promise<[boolean, PageInfo[]]> {
    return new Promise((resolve: any) => {
        // Try to get the page
        sql.execute("SELECT * FROM `wiki_pages` WHERE `namespace` = ? AND `name` = ? LIMIT 1",
        [address.namespace, address.name],
        async (normal_error: any, normal_results: any) => {
            if(!normal_error && normal_results.length !== 0) {
                // Normal page is ready (not deleted)
                resolve([false, [{
                    ...normal_results[0],

                    is_deleted: false
                }]]);
            } else if(get_deleted) {
                // The page was deleted and we were requested to det the deleted page
                const deleted_results = await getDeletedPageInfo(address);

                resolve([true, deleted_results]);
            } else {
                resolve([true, []]);
            }
        });
    });
}

/**
 * Parse revision visibility buffer
 *
 * @param raw_bytes raw bytes
 */
function parseRevisionVisibility(raw_bytes: UInt8): RevisionVisibility {
    /*
    Visibility format.

    Five bits, each responsible for a flag. 0 - visible, 1 - hidden
    high   low
    |      |
    00 0 0 0
    oo u c s

    o: overall (two bits, 0-3):
        00: visible to everybody
        01: everything is hidden for normal users (u, c, s). Rev still displays, but is "crossed-out"
        10: everything is hidden for normal users, as well as the rev itself - it will not be rendered at all
        11: Same as 10. You can use this level to completely hide from admins too

        if client's visibility is lower than rev's overall visibility, u, c, s, or the whole rev will be hidden

    u: user
    c: content
    s: summary
    */

    const bits = bitwise.byte.read(raw_bytes);

    return {
        overall_visibility: bitwise.byte.write([0, 0, 0, 0, 0, 0, bits[3], bits[4]]),

        user_hidden: bits[5] === 1,
        content_hidden: bits[6] === 1,
        summary_hidden: bits[7] === 1
    }
}

/**
 * Get revisions for a page
 *
 * @param page_id get revisions for this page
 * @param user_id get revisions by this user (WIP)
 * @param get_deleted also get deleted revisions
 * @param apply_filter remove hidden fields from the resulting objects. So, if user_hidden is true, then user field will be null
 * @param filter_client_visibility client's visibility level (used only with apply_filter)
 */
export async function getPageRevisions(page_id?: string, user_id?: string, get_deleted: boolean = false, apply_filter: boolean = true,
filter_client_visibility: number = 0): Promise<{ [revid: number]: Revision }> {
    return new Promise((resolve: any) => {
        // Construct a query
        let query = "\
SELECT id, `page`, `user`, `content_hash`, `summary`, `visibility`, `tags`, `timestamp`, `bytes_size`, `bytes_change`, `is_deleted` \
FROM `revisions` WHERE `page` = ?";

        if(!get_deleted) {
            query += " AND `is_deleted` = b'0'";
        }

        // Get the revisions
        sql.execute(query, [page_id], async (revs_error: any, results: any) => {
            if(revs_error) {
                // Some error occured, just return an empty object
                resolve({});
                return;
            }

            // Get users, so we can create links to user pages and display their names
            const users_query: string[] = [];
            const users: any = {};

            // Get all user ids that we encountered
            for(const result of results) {
                // Make sure we dont't include the same user more than once in our query
                if(!users_query.includes(result.user)) users_query.push(result.user);
            }

            // Get users
            // TODO @cleanup idk about that approach
            let sql_error = false;

            const users_results = await sql.promise().query(`SELECT id, \`username\` FROM \`users\` WHERE id IN (${ users_query.join(",") })`)
            .catch((error: Error) => {
                resolve({});
                Util.log("Could not query users for a getPageRevisions function", 3, error);

                sql_error = true;
            });

            if(sql_error) return;

            // Make a { id: username } object
            for(const user of users_results[0]) {
                users[user.id] = user.username;
            }

            // Construct final results
            const final_results: { [revid: number]: Revision } = {};

            for(const result of results) {
                // Parse the visibility
                const visibility = parseRevisionVisibility(result.visibility.readInt8(0));

                // Completely hidden, and filter is enabled, don't even add to the results object
                if(apply_filter && visibility.overall_visibility > 1 && filter_client_visibility < visibility.overall_visibility)
                    continue;

                const revision = {
                    ...result,

                    user: users[result.user],

                    tags: result.tags ? result.tags.split(",") : [],
                    visibility: null,

                    overall_visibility: visibility.overall_visibility,
                    user_hidden: visibility.user_hidden,
                    content_hidden: visibility.content_hidden,
                    summary_hidden: visibility.summary_hidden,

                    is_deleted: result.is_deleted.readInt8(0) === 1
                };

                // Filter is enabled, and client's visibility is lower than required -> expunge some data
                if(apply_filter && (filter_client_visibility === 0 || filter_client_visibility < visibility.overall_visibility)) {
                    if(visibility.overall_visibility > 0) {
                        // Overal visibility is higher than 0 (visible for all) -> delete all data

                        revision.user = null;
                        revision.summary = null;

                        revision.content = null;
                        revision.bytes_size = 0;
                        revision.bytes_change = 0;
                        revision.content_hash = null;
                    } else {
                        // Overal visibility is at 0 (visible for all) -> only delete some data that has to be deleted

                        if(revision.user_hidden) revision.user = null;
                        if(revision.summary_hidden) revision.summary = null;

                        if(revision.content_hidden) {
                            revision.content = null;
                            revision.content_hash = null;
                            revision.bytes_size = 0;
                            revision.bytes_change = 0;
                         }
                    }

                    revision._filter_applied = true;
                }

                final_results[revision.id] = revision;
            }

            resolve(final_results);
        });
    });
}

/**
 * Diff two revisions
 *
 * @param rev_from id of a revision to use as a `from`
 * @param rev_to id of a revision to use as the `to`
 * @param client_visibility client's visibility level
 * @param get_html get as html
 */
export async function getRevisionsDiff(rev_from: number, rev_to: number, client_visibility: number = 0, get_html: boolean = false):
    Promise<JsDiff.Change[] | string> {
    return new Promise((resolve: any, reject: any) => {
        // Trying to compare a revision to itself
        if(rev_from === rev_to) {
            reject(new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "Can not compare a revision to itself"));
            return;
        }

        // Get the revisions
        sql.execute("SELECT `content`, `visibility` FROM `revisions` WHERE `is_deleted` = b'0' AND id IN (?, ?)",
        [rev_from, rev_to],
        (error: any, results: any) => {
            if(error || results.length !== 2) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not get revisions"));
                return;
            }

            // Check visibility
            const visibility_from = parseRevisionVisibility(results[0].visibility.readInt8(0));
            const visibility_to = parseRevisionVisibility(results[1].visibility.readInt8(0));

            if(client_visibility === 0
            || client_visibility < visibility_from.overall_visibility
            || client_visibility < visibility_to.overall_visibility) {
                if(visibility_from.overall_visibility > 0 || visibility_to.overall_visibility > 0) {
                    reject(new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "One of the revisions is hidden"));
                    return;
                } else if(visibility_from.content_hidden || visibility_to.content_hidden) {
                    reject(new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "Content of one of the revisions is hidden"));
                    return;
                }
            }

            // TODO @performance @placeholder Use normal diff, not the js implementation. It consumes a lot of memory
            // and hangs when working on large revisions
            const diff = JsDiff.diffLines(results[0].content, results[1].content);

            if(get_html) {
                resolve(JsDiff.convertChangesToXML(diff).replace(/\n/g, "<br>"));
            } else {
                resolve(diff);
            }
        })
    });
}

/**
 * Get page by revid (not rendered)
 *
 * @param revid revision id
 * @param get_deleted get content even if the page is deleted?
 * @param client_visibility client's visibility level
 *
 * Returns [Rejection, ResponsePage | undefined] on rejection
 *
 * @returns response page
 */
export async function getPageByRevid(revid: number, get_deleted: boolean = false, client_visibility: number = 0): Promise<ResponsePage> {
    return new Promise(async (resolve: any, reject: any) => {
        // Get the page and the last revision from the database
        sql.execute("CALL wiki_get_page_by_revid(?)",
        [revid],
        (error: any, results: any) => {
            if(error || results[0].length !== 1) {
                // Page was not found

                reject([new Util.Rejection(Util.RejectionType.PAGE_NOT_FOUND, "Page not found"), undefined]);
                return;
            } else {
                // No errors reported, page found

                const db_results = results[0][0];

                // TODO @cleanup allow pageTitleParser to just take a namespace and a name
                const page_address = pageTitleParser(`${ db_results.namespace }:${ db_results.name }`);

                const page: ResponsePage = {
                    address: page_address,
                    pageid: db_results.pageid,
                    current_revision: db_results.current_revid,

                    additional_css: [],
                    additional_js: [],

                    badges: [],
                    info: {},

                    status: []
                };

                // Check revision visibility
                const visibility = parseRevisionVisibility(db_results.visibility.readInt8(0));

                // Check if deleted
                const is_deleted = db_results.is_deleted.readInt8(0) === 1;

                if(is_deleted && !get_deleted) {
                    // Deleted page, getting deleted pages disallowed by the argument

                    reject([new Util.Rejection(Util.RejectionType.PAGE_DELETED, "Page not found"), undefined]);
                } else if(visibility.content_hidden && (client_visibility === 0 || client_visibility < visibility.overall_visibility)) {
                    // Hidden revision, client visibility level is too low

                    // Content hidden, remove it
                    page.raw_content = "";
                    page.status = ["page_revision_hidden"];

                    reject([new Util.Rejection(Util.RejectionType.PAGE_REVISION_HIDDEN, "Revision is hidden"), page]);
                } else {
                    // Everything is ok, return the page

                    page.raw_content = db_results.content;
                    resolve(page);
                }
            }
        });
    });
}

/**
 * Get page by address (not rendered)
 *
 * @param page_address page address object
 * @param get_deleted get content even if the page is deleted?
 * @param client_visibility client's visibility level
 *
 * Returns [Rejection, ResponsePage] on rejection
 *
 * @returns response page
 */
export async function getPageByAddress(page_address: PageAddress, get_deleted: boolean = false, client_visibility: number = 0): Promise<ResponsePage> {
    return new Promise(async (resolve: any, reject: any) => {
        // TODO implement get_deleted.

        const page: ResponsePage = {
            address: page_address,

            additional_css: [],
            additional_js: [],

            badges: [],
            info: {},

            status: []
        };

        // Get the page and the last revision from the database
        sql.execute("CALL wiki_get_page(?, ?)",
        [page_address.namespace, page_address.name],
        (error: any, results: any) => {
            if(error || results[0].length !== 1) {
                // Page was not found

                page.status = ["page_not_found"];

                reject([new Util.Rejection(Util.RejectionType.PAGE_NOT_FOUND, "Page not found"), page]);
                return;
            } else {
                // No errors reported, page found

                const db_results = results[0][0];

                // Update the page
                page.pageid = db_results.pageid;
                page.current_revision = db_results.revid;

                // Check revision visibility
                const visibility = parseRevisionVisibility(db_results.visibility.readInt8(0));

                if(visibility.content_hidden && (client_visibility === 0 || client_visibility < visibility.overall_visibility)) {
                    // Hidden revision, client visibility level is too low

                    // Content hidden, remove it
                    page.raw_content = "";
                    page.status = ["page_revision_hidden"];

                    reject([new Util.Rejection(Util.RejectionType.PAGE_REVISION_HIDDEN, "Revision is hidden"), page]);
                } else {
                    // Everything is ok, return the page

                    page.raw_content = db_results.content;
                    resolve(page);
                }
            }
        });
    });
}

/**
 * Get a page
 *
 * @param address page's address
 * @param client client
 * @param template_params template params that will be passed to the wikitextRenderer
 * @param add_div_tag
 */
export async function get(address: PageAddress, client: User.User, template_params?: any, add_div_tag: boolean = true):
    Promise<ResponsePage> {
    return new Promise(async (resolve: any) => {
        // Get the namespace handler
        const namespace = registry_namespaces.get()[address.namespace] as Namespace;

        // Handler for common namespaces (or nonexistent)
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

                    // Get error system messages (we preload page-badge-namespacenotfound)
                    error_sysmsgs = await SystemMessage.get(sysmsgs_query);

                    // Set page's content to the notfound message
                    page.parsed_content = error_sysmsgs["page-error-notfound"].value;

                    // Set a notfound badge
                    page.badges.push(error_sysmsgs["page-badge-pagenotfound"].value);
                }

                // Revision was hidden
                if(page.status.includes("page_revision_hidden")) {
                    // Get page-error-revisionhidden system message
                    error_sysmsgs = await SystemMessage.get([
                        "page-error-revisionhidden"
                    ]);

                    // Set page's content to the notfound message
                    page.parsed_content = error_sysmsgs["page-error-revisionhidden"].value;
                }

                // Check if namespace exists
                if(namespace) {
                    // Namespace exists

                    // Inherit info items from the namespace
                    // tslint:disable-next-line: forin
                    for(const info_item_name in namespace.info) {
                        if(!page.info.hasOwnProperty(info_item_name)) page.info[info_item_name] = namespace.info[info_item_name];
                    }

                    // Hide the namespace, if title is set to hidden
                    if(namespace.info.hiddennamespacename) {
                        page.address.display_title = page.address.display_title.substring(page.address.display_namespace.length + 1);
                    }
                } else {
                    // Namespace does not exist

                    // Set a status
                    page.status.push("namespace_not_found");

                    // Set a badge
                    page.badges.push(error_sysmsgs["page-badge-namespacenotfound"].value);
                }

                // Render content, passing the template params
                if(!page.parsed_content && page.raw_content) {
                    page.parsed_content = (await renderWikitext(page.raw_content, template_params || {}, add_div_tag)).content;
                }

                common_resolve(page);
            });
        };

        // Namespace handler is available, do not use the common one, just call the handler
        if(namespace && namespace.handler) {
            namespace.handler(address, client)
            .then((page: ResponsePage) => {
                resolve(page);
                return;
            });

            // TODO? edge case if the handler rejects for some reason
        } else {
            // Main / nonexistent namespace, use the common namespace handler
            getPageByAddress(address)
            .then(async (page: ResponsePage) => {
                // Page was found

                resolve(await commonHandler(page));
            })
            .catch(async (rejection_and_page: [Util.Rejection, ResponsePage]) => {
                // Some error occured, the page was probably not found

                resolve(await commonHandler(rejection_and_page[1]));
            });
        }
    });
}

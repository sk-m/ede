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

    query: string[];
    url_params: string[];

    raw_url: string;
}

export interface Revision {
    id: string;

    page?: number;
    user?: number;

    content?: string;
    content_hash: string;

    summary?: string;

    overall_visibility: number;
    user_hidden: boolean;
    content_hidden: boolean;
    summary_hidden: boolean;

    tags: string[];

    timestamp: number;

    bytes_size: number;
    bytes_change: number;

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
        allowedTags: ["div", "span", "br", "code", "small", "sup", "sub", "s"],
        allowedAttributes: {
            div: ["class", "style"],
            span: ["class", "style"],
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
            Log.createEntry("createwikipage", user.id, full_address,
            `<a href="/User:${ user.username }">${ user.username }</a> created a wiki page <a href="/${ full_address }">${ full_address }</a> \
(<code>${ target_page_id }</code>)`, "");
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
export async function deletePage(page_id: number, deleted_user_id: string, summary?: string, completely_remove: boolean = false): Promise<void> {
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
                sql.query("INSERT INTO `deleted_wiki_pages` (`pageid`, `namespace`, `name`, `page_info`, `action_restrictions`, \
`deleted_by`, `deleted_on`, `delete_summary`) \
VALUES (?, ?, ?, ?, ?, ?, ?, ?); DELETE FROM `wiki_pages` WHERE id = ?; UPDATE `revisions` SET `is_deleted` = b'1' WHERE `page` = ?",
                [page_id, page.namespace, page.name, JSON.stringify(page.page_info), JSON.stringify(page.action_restrictions),
                deleted_user_id, now, summary, page_id, page_id],
                (del_error: any) => {
                    if(!del_error) resolve();
                    else reject(del_error);
                });
            });
        } else {
            // TODO!
            reject();
            return;

            sql.query("#$&(*invalid)  DELETE FROM `revisions` WHERE `page` = ?; DELETE FROM `wiki_pages` WHERE id = ?; \
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
 * @param new_namespace new namespace for the page (will be checked for content_model)
 * @param new_name new name for the page
 *
 * @returns [new page id, new page title, old page title]
 */
export async function restorePage(page_id: number, new_namespace?: string, new_name?: string): Promise<string> {
    return new Promise((resolve: any, reject: any) => {
        // Get the deleted page and the last revision
        sql.query("SELECT id FROM `revisions` WHERE `page` = ? ORDER BY id DESC LIMIT 1; \
SELECT * FROM `deleted_wiki_pages` WHERE `pageid` = ?",
        [page_id, page_id],
        async (get_error: any, results: any) => {
            if(get_error || results.length < 1) {
                reject();
                return;
            }

            const deleted_page = results[1][0];
            const revid = results[0][0].id;

            if(!new_namespace) new_namespace = deleted_page.namespace;
            if(!new_name) new_name = deleted_page.name;

            // Check if namespace is correct
            const registry_namespaces_snapshot = registry_namespaces.get();

            if(registry_namespaces_snapshot[new_namespace as string].content_model !== "wiki") {
                reject(new Error("Unable to move page to a non-wiki namespace"));
                return;
            }

            // Check if the page with target title already exists
            const current_page_query = await getInfo(new_namespace as string, new_name as string);

            if(current_page_query[1].length !== 0) {
                reject(new Error("A page with such title already exists"));
                return;
            }

            // Restore the page (move record from `deleted_wiki_pages` to `wiki_pages`, update pageid for all related revisions and
            // delete the record from `deleted_wiki_pages`)
            sql.query("INSERT INTO `wiki_pages` (`namespace`, `name`, `revision`, `page_info`, `action_restrictions`) \
            VALUES (?, ?, ?, ?, ?); SET @new_pageid = LAST_INSERT_ID(); UPDATE `revisions` SET `page` = @new_pageid, `is_deleted` = b'0' WHERE `page` = ?; \
            DELETE FROM `deleted_wiki_pages` WHERE `pageid` = ?; SELECT @new_pageid",
            [new_namespace as string, new_name as string, revid, JSON.stringify(deleted_page.page_info), JSON.stringify(deleted_page.action_restrictions),
            page_id, page_id, page_id],
            (restore_error: any, restore_results: any) => {
                const new_pageid = restore_results[4][0]["@new_pageid"];

                if(!restore_error) resolve([
                    new_pageid,
                    `${ new_namespace as string }:${ new_name as string }`,
                    `${ deleted_page.namespace }:${ deleted_page.name }`
                ]);
                else reject();
            });
        });
    });
}

/**
 * Move (rename) the page
 *
 * @param page_id internal page id
 * @param new_namespace name of the namespace to move the page into
 * @param new_name new name for the page
 */
export async function movePage(page_id: number, new_namespace: string, new_name: string): Promise<void> {
    return new Promise(async (resolve: any, reject: any) => {
        const new_namespace_obj = registry_namespaces.get()[new_namespace];

        if(!new_namespace_obj) {
            reject(new Error(`Namespace '${ new_namespace }' does not exist.`));
            return;
        }

        if(new_namespace_obj.content_model !== "wiki") {
            reject(new Error(`You can only move pages to namespaces with 'wiki' content model.`));
            return;
        }

        // Check if the page with target title already exists
        const current_page_query = await getInfo(new_namespace, new_name);

        if(current_page_query[1].length !== 0) {
            reject(new Error("A page with such title already exists"));
            return;
        }

        sql.execute("UPDATE `wiki_pages` SET `namespace` = ?, `name` = ? WHERE id = ?",
        [new_namespace, new_name, page_id],
        (error: any) => {
            if(!error) resolve();
            else reject();
        });
    });
}

export async function getDeletedPagesInfo(namespace: string, name: string): Promise<PageInfo[]> {
    return new Promise((resolve: any) => {
        sql.execute("SELECT * FROM `deleted_wiki_pages` WHERE `namespace` = ? AND `name` = ?",
        [namespace, name],
        (deleted_error: any, deleted_results: any) => {
            if(deleted_error || deleted_results.length === 0) {
                resolve([]);
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
            resolve(final_results);
        });
    });
}

export async function getInfo(namespace: string, name: string, get_deleted: boolean = false): Promise<[boolean, PageInfo[]]> {
    return new Promise((resolve: any) => {
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
                sql.execute("SELECT * FROM `deleted_wiki_pages` WHERE `namespace` = ? AND `name` = ?",
                [namespace, name],
                (deleted_error: any, deleted_results: any) => {
                    if(deleted_error || deleted_results.length === 0) {
                        resolve([true, []]);
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
                resolve([true, []]);
            }
        });
    });
}

function parseRevisionVisibility(raw_byte: UInt8): RevisionVisibility {
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

    const bits = bitwise.byte.read(raw_byte);

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
 * @param user_id get revisions by this user
 * @param get_deleted also get deleted revisions
 * @param apply_filter remove hidden fields from the resulting objects. So, if user_hidden is true, then user field will be null
 * @param filter_client_visibility client's visibility level (used only with apply_filter)
 */
export async function getPageRevisions(page_id?: string, user_id?: string, get_deleted: boolean = false, apply_filter: boolean = true,
filter_client_visibility: number = 0): Promise<{ [revid: number]: Revision }> {
    return new Promise((resolve: any) => {
        let query = "\
SELECT id, `page`, `user`, `content_hash`, `summary`, `visibility`, `tags`, `timestamp`, `bytes_size`, `bytes_change`, `is_deleted` \
FROM `revisions` WHERE `page` = ?";

        if(!get_deleted) {
            query += " AND `is_deleted` = b'0'";
        }

        sql.execute(query, [page_id], async (revs_error: any, results: any) => {
            if(revs_error) {
                resolve([]);
            } else {
                // Get users
                const users_query: string[] = [];
                const users: any = {};

                for(const result of results) {
                    if(!users_query.includes(result.user)) users_query.push(result.user);
                }

                // Query users
                await new Promise((resolve_users: any) => {
                    sql.query(`SELECT id, \`username\` FROM \`users\` WHERE id IN (${ users_query.join(",") })`,
                    (users_error: any, users_results: any) => {
                        if(!users_error) {
                            for(const user of users_results) {
                                users[user.id] = user.username;
                            }
                        }

                        resolve_users();
                    });
                });

                // Construct final results
                const final_results: { [revid: number]: Revision } = {};

                for(const result of results) {
                    const visibility = parseRevisionVisibility(result.visibility.readInt8(0));

                    // Completely hidden, don't even add to the results object
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

                    // Filter
                    // TODO @performance
                    if(apply_filter && (filter_client_visibility === 0 || filter_client_visibility < visibility.overall_visibility)) {
                        if(visibility.overall_visibility > 0) {
                            revision.user = null;
                            revision.content = null;
                            revision.summary = null;
                        } else {
                            if(revision.user_hidden) revision.user = null;
                            if(revision.content_hidden) revision.content = null;
                            if(revision.summary_hidden) revision.summary = null;
                        }

                        revision._filter_applied = true;
                    }

                    final_results[revision.id] = revision;
                }

                resolve(final_results);
            }
        });
    });
}

export async function getRevisionsDiff(rev_from: number, rev_to: number, client_visibility: number = 0, get_html: boolean = false): Promise<JsDiff.Change[] | string> {
    return new Promise((resolve: any, reject: any) => {
        if(rev_from === rev_to) {
            reject(new Error("Ids are the same"));
            return;
        }

        sql.execute("SELECT `content`, `visibility` FROM `revisions` WHERE `is_deleted` = b'0' AND id IN (?, ?)",
        [rev_from, rev_to],
        (error: any, results: any) => {
            if(error || results.length !== 2) {
                reject();
                return;
            }

            // Check visibility
            const visibility_from = parseRevisionVisibility(results[0].visibility.readInt8(0));
            const visibility_to = parseRevisionVisibility(results[1].visibility.readInt8(0));

            if(client_visibility === 0
            || client_visibility < visibility_from.overall_visibility
            || client_visibility < visibility_to.overall_visibility) {
                if(visibility_from.overall_visibility > 0 || visibility_to.overall_visibility > 0) {
                    reject(new Error("One of the revisions is hidden"));
                    return;
                } else if(visibility_from.content_hidden || visibility_to.content_hidden) {
                    reject(new Error("Content of one of the revisions is hidden"));
                    return;
                }
            }

            // TODO @performance @placeholder Use normal diff, not the js implementation. It consumes a lot of memory and hangs when working on large revision
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
 * Get raw page content
 */
export async function getRaw(revid?: number, namespace?: string, name?: string, get_deleted: boolean = false,
client_visibility: number = 0): Promise<ResponsePage> {
    return new Promise(async (resolve: any, reject: any) => {
        const time_start = process.hrtime();
        const page: ResponsePage = {
            address: {
                namespace: "",
                name: "",

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

        if(namespace && name) {
            // Get by title
            page.address.name = name;
            page.address.namespace = namespace;

            sql.query("SET @pageid = NULL; SET @revid = NULL; SELECT id, `revision` INTO @pageid, @revid FROM `wiki_pages` \
WHERE `namespace` = ? AND `name` = ? LIMIT 1; SELECT id, @pageid, `content`, `visibility` FROM `revisions` WHERE id = @revid;",
            [namespace, name],
            (error: any, results: any) => {
                if(error || !results[3][0]) {
                    // Page was not found
                    page.status.push("page_not_found");
                } else {
                    const db_page = results[3][0];

                    page.pageid = db_page["@pageid"];
                    page.current_revision = db_page.id;

                    // Check revision visibility
                    const visibility = parseRevisionVisibility(db_page.visibility.readInt8(0));

                    if(visibility.content_hidden && (client_visibility === 0 || client_visibility < visibility.overall_visibility)) {
                        page.status.push("revision_hidden");
                    } else {
                        page.raw_content = db_page.content;
                    }
                }

                page.access_time_ms = process.hrtime(time_start)[1] / 1000000;

                resolve(page);
            });
        } else if(revid) {
            // Get by revid
            sql.execute("SELECT `content`, `visibility`, `is_deleted` FROM `revisions` WHERE id = ?",
            [revid],
            (error: any, results: any) => {
                if(error || results.length !== 1) {
                    // Page was not found
                    page.status.push("page_not_found");
                } else {
                    const db_page = results[0];

                    // Check revision visibility
                    const visibility = parseRevisionVisibility(db_page.visibility.readInt8(0));

                    if(visibility.content_hidden && (client_visibility === 0 || client_visibility < visibility.overall_visibility)) {
                        page.status.push("revision_hidden");
                    } else if(db_page.is_deleted && !get_deleted) {
                        page.status.push("page_not_found");
                        page.status.push("page_deleted");
                    } else {
                        page.raw_content = db_page.content;
                    }
                }

                page.access_time_ms = process.hrtime(time_start)[1] / 1000000;

                resolve(page);
            });
        } else {
            reject(new Error("either revid or a namespace and name pair required"));
            return;
        }
    });
}

/**
 * Get page (rendered and ready to be served to the client)
 *
 * @param address [[PageAddress]] object
 */
// TODO flag to only get the raw content and don't render
export async function get(address: PageAddress, client: User.User): Promise<ResponsePage> {
    return new Promise((resolve: any) => {
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
                    // Inherit info items
                    // tslint:disable-next-line: forin
                    for(const info_item_name in namespace.info) {
                        if(!page.info.hasOwnProperty(info_item_name)) page.info[info_item_name] = namespace.info[info_item_name];
                    }

                    page.display_title = `${ !namespace.info.hiddennamespacename ? (namespace.name + ":") : "" }${ address.name }`;
                } else {
                    page.display_title = `${ address.namespace }:${ address.name }`;
                    page.status.push("namespace_not_found");

                    page.badges.push(error_sysmsgs["page-badge-namespacenotfound"].value);
                }

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
            getRaw(undefined, address.namespace, address.name)
            .then(async (page: ResponsePage) => {
                resolve(await commonHandler(page));
            });
        }
    });
}

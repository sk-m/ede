import { ConfigItemsObject, ConfigTriggersObject, getConfigFromDB } from "./config";
import { SkinsObject, getSkins } from "./skin";
import * as Page from "./page";
import { HookSubscribersObject, HooksObject } from "./hook";
import { GroupsObject, Right } from "./right";
import * as User from "./user";

// System pages
import { userGroupManagement } from "./systempages/userGroupManagement";

// Api routes
import { getPageRoute, ApiRoutesObject } from "./api";
import { updateUserGroupMembershipRoute } from "./api/user_updategroups";
import { updateUserGroupRoute } from "./api/usergroup_update";
import { config } from "./systempages/config";
import { dashboard } from "./systempages/dashboard";
import { configSetItemRoute } from "./api/config_setitem";
import { configResetItemRoute } from "./api/config_resetitem";
import { systemMessages } from "./systempages/systemMessages";
import { login } from "./systempages/login";
import { createUserGroupRoute } from "./api/usergroup_create";
import { blockUserRoute } from "./api/user_block";
import { systemmessageSetRoute } from "./api/systemmessage_set";
import { systemmessageCreateRoute } from "./api/systemmessage_create";
import { systemmessageDeleteRoute } from "./api/systemmessage_delete";
import { deleteUserGroupRoute } from "./api/usergroup_delete";
import { pageSaveRoute } from "./api/page_save";
import { wikiPageManagement } from "./systempages/pageManagement";
import { pageDeleteRoute } from "./api/page_delete";
import { pageRestoreRoute } from "./api/page_restore";
import { pageMoveRoute } from "./api/page_move";
import { deletedWikiPages } from "./systempages/deletedWikiPages";
import { getRevisionRoute } from "./api/revision_get";
import { getRevisionsDiffRoute } from "./api/revision_diff";
import { logoutUserRoute } from "./api/user_logout";
import { userSettings } from "./systempages/userSettings";
import { createElevatedSessionRoute } from "./api/user_create_elevated_session";
import { updateUserPasswordRoute } from "./api/user_update_password";
import { userStart2FASetupRoute } from "./api/user_start_f2a_setup";
import { userFinish2FASetupRoute } from "./api/user_finish_f2a_setup";
import { userDisable2FARoute } from "./api/user_disable_f2a";
import { requestUserEmailChangeRoute } from "./api/user_request_email_change";
import { systemmessageGetRoute } from "./api/systemmessage_get";
import { getUserNotificationsRoute } from "./api/user_get_notifications";
import { markUserNotificationReadRoute } from "./api/user_notification_mark_read";
import { userGetNotificationsStatusRoute } from "./api/user_get_notifications_status";
import { managecachingserver, managemailer } from "./config_triggers";
import { incidentsLog } from "./systempages/incidentsLog";
import { getIncidentLogsRoute } from "./api/incidentlogs_get";
import { ActionRestrictionObjectTypes, ActionRestrictionTypesObject } from "./action_restrictions";
import { updateActionRestrictionsRoute } from "./api/update_action_restrictions";
import { fileUpload } from "./systempages/fileUpload";
import { uploadRoute } from "./api/file_upload";
import { fileGetRoute } from "./api/file_get";
import { fileCheckNamesRoute } from "./api/file_checknames";

/** @ignore */
interface RegistrySubscriber {
    callback: (new_data: any) => void;

    source: string;
    description: string;
}

/**
 * Registry container
 *
 * @type T Container data type
 */
export class RegistryContainer<T> {
    private data: T;

    private subscribers: RegistrySubscriber[] = [];
    public readonly updater_function: () => Promise<T>;

    /**
     * Extension that provided this container
     */
    public readonly source: string;

    /**
     * @param source Extension that provided this container
     * @param updater_function Function that updates the container (usually a function, that querries the database). !!! SHOULD NOT CHANGE THE RegistryContainer !!!
     */
    constructor(source: string, updater_function?: () => Promise<T>, default_value?: T) {
        this.source = source;

        if(default_value) {
            this.data = default_value;
        }

        if(updater_function) {
            this.updater_function = updater_function;
        }
    }

    /**
     * Get data (USE ONLY WITH Object.assign({}, registry_something.get()) if you are going to modify it!)
     *
     * Be really careful when copying the object!
     */
    public get(): Readonly<T> {
        return this.data;
    }

    /**
     * Completely replace data and call all subscribers
     *
     * @param data New data
     * @param call_subscribers Whether or not to call subscribers
     */
    public set(data: T, call_subscribers: boolean = true): void {
        this.data = data;

        if(call_subscribers) {
            // Call all subscribers
            for(const subscriber of this.subscribers) {
                subscriber.callback(this.data);
            }
        }
    }

    /**
     * Set a key of the data object to some value
     *
     * @param key_name Key name
     * @param key_value Value
     * @param call_subscribers true by default
     */
    public setKey(key_name: keyof T, key_value: any, call_subscribers: boolean = true): void {
        this.data[key_name] = key_value;

        if(call_subscribers) {
            // Call all subscribers
            for(const subscriber of this.subscribers) {
                subscriber.callback(this.data);
            }
        }
    }

    /**
     * Call the updater_function and update this.data
     */
    public async update(): Promise<void> {
        return new Promise(async (resolve: any, reject: any) => {
            this.updater_function()
            .then((new_data: T) => {
                this.data = new_data;
                resolve();
            })
            .catch((error: any) => {
                reject(error);
            })
        });
    }

    /**
     * Subscribe to the container. The callback will be called on every data update
     *
     * @param callback Function that will be called on updates
     * @param source Internal name of the extension that requests updates
     * @param description Why do you need updates?
     */
    public subscribe(callback: (new_data: any) => void, source: string, description: string): void {
        // TODO check if source is a registered extension

        this.subscribers.push({ callback, source, description });
    }

    /**
     * Get all subscribers
     */
    public getSubscribers(): RegistrySubscriber[] {
        return this.subscribers;
    }
}

// Core engine containers
export const registry_config = new RegistryContainer<ConfigItemsObject>("ede", getConfigFromDB);

export const registry_config_triggers = new RegistryContainer<ConfigTriggersObject>("ede", undefined, {
    managecachingserver: {
        description: "Caching client will be connecter or disconnected after saving this config item",

        handler: managecachingserver
    },
    managemailer: {
        description: "Mailer will be connecter or disconnected after saving this config item",

        handler: managemailer
    }
});


export const registry_hook_subscribers = new RegistryContainer<HookSubscribersObject>("ede", undefined, {});
export const registry_hooks = new RegistryContainer<HooksObject>("ede", undefined, {});

export const registry_usergroups = new RegistryContainer<GroupsObject>("ede", User.getAllUserGroups, {});
export const registry_usernotification_types = new RegistryContainer<User.UserNotificationTypesObject>("ede", undefined, {
    usergroupmembershipupdate: {
        type_name: "usergroupmembershipupdate",
        hidden: false,

        display_type_name: "Own user group membership update",
        display_type_description: "Sent when you have been assigned or removed from some user group(s).",
        display_type_example_text: "ExampleUser has changed your user group membership. Added to group1; removed from group2.",

        icon_class: "fas fa-users-cog",
        title: "Your user group membership was updated",

        actions: [
            { type: "main", text: "See my groups", dynamic_href_key: "user_groups_page_href" }
        ]
    },
    accountcreated: {
        type_name: "accountcreated",
        hidden: true,

        display_type_name: "",
        display_type_description: "",
        display_type_example_text: "",

        icon_class: "far fa-user-circle",
        title: "Accout created",

        actions: []
    },
    accountlogin: {
        type_name: "accountlogin",
        hidden: false,

        display_type_name: "New account login",
        display_type_description: "Sent when there has been a new login into your account",
        display_type_example_text: "Someone has logged into your account.",

        icon_class: "fas fa-sign-in-alt",
        title: "New account login",

        actions: [
            { type: "main", text: "Security settings", href: "/System:UserSettings/account" }
        ]
    },
    accountpasswordchange: {
        type_name: "accountpasswordchange",
        hidden: false,

        display_type_name: "Password changed",
        display_type_description: "Sent when user's password has been changed",
        display_type_example_text: "Your password has been changed.",

        icon_class: "fas fa-key",
        title: "Password changed",

        actions: [
            { type: "main", text: "Security settings", href: "/System:UserSettings/account" }
        ]
    },
    accountloginattempt: {
        type_name: "accountloginattempt",
        hidden: false,

        display_type_name: "New account login attempt",
        display_type_description: "Sent when there has been an attempt to login into your account, but it was not necessarily successfull.",
        display_type_example_text: "New login attempt was made. Correct password provided.",

        icon_class: "fas fa-key",
        title: "New login attempt",

        actions: [
            { type: "main", text: "Security settings", href: "/System:UserSettings/account" }
        ]
    }
});

export const registry_rights = new RegistryContainer<{ [right_name: string]: Right }>("ede", undefined, {
    wiki_edit: {
        name: "wiki_edit",
        risk_text: "",

        source: "ede",

        arguments: {
            namespaces: {
                type: ["array"],
                description: "Allow editing pages in these namespaces",

                default_value: "",
            },
        }
    },
    wiki_createpage: {
        name: "wiki_createpage",
        risk_text: "",

        source: "ede",

        arguments: {
            namespaces: {
                type: ["array"],
                description: "Allow creating new pages in these namespaces",

                default_value: "",
            },
        }
    },
    wiki_movepage: {
        name: "wiki_movepage",
        risk_text: "Semi-dangerous",

        source: "ede",

        arguments: {}
    },
    wiki_deletepage: {
        name: "wiki_deletepage",
        risk_text: "Dangerous",

        source: "ede",

        arguments: {
            disallowed_namespaces: {
                type: ["array"],
                description: "Disallow deleting pages in these namespaces",

                default_value: "",
            },
            allow_complete_erase: {
                type: ["boolean"],
                description: "Allow completely and irreversibly erasing the page and all related information from the database",

                default_value: false,
            },
        }
    },
    wiki_restorepage: {
        name: "wiki_restorepage",
        risk_text: "Semi-dangerous",

        source: "ede",

        arguments: {}
    },
    file_upload: {
        name: "file_upload",

        source: "ede",

        arguments: {
            max_filesize: {
                type: ["number"],
                description: "Maximum allowed file size, in bytes",

                default_value: 50000000,
            },
        }
    },
    modifyusergroupmembership: {
        name: "modifyusergroupmembership",
        risk_text: "Dangerous",

        source: "ede",

        arguments: {
            add: {
                type: ["array"],
                description: "Groups allowed to assign",

                default_value: "",
            },
            remove: {
                type: ["array"],
                description: "Groups allowed to remove",

                default_value: ""
            }
        }
    },
    modifyusergroups: {
        name: "modifyusergroups",
        risk_text: "Extremely dangerous",

        source: "ede",

        arguments: {}
    },
    renameuser: {
        name: "renameuser",
        risk_text: "Dangerous",

        source: "ede",

        arguments: {}
    },
    blockuser: {
        name: "blockuser",
        risk_text: "Dangerous",

        source: "ede",

        arguments: {
            restricted_user_groups: {
                type: ["array"],
                description: "Disallow blocking users, that are members of these groups",

                default_value: ["sysadmin"]
            },
            allow_lockout: {
                type: ["boolean"],
                description: "Allow locking users out",

                default_value: false
            }
        }
    },
    modifyconfig: {
        name: "modifyconfig",
        risk_text: "Very dangerous",

        source: "ede",

        arguments: {
            restricted_permits: {
                type: ["array"],
                description: "Restricted keys that can be modified",

                default_value: ""
            }
        }
    },
    manageactionrestrictions: {
        name: "manageactionrestrictions",
        risk_text: "Dangerous",

        source: "ede",

        arguments: {
            allowed_object_types: {
                type: ["array"],
                description: "Object types, action restrictions of which are allowed to be modified",

                default_value: ""
            }
        }
    },
    viewdashboardstatus: {
        name: "viewdashboardstatus",

        source: "ede",

        arguments: {}
    },
    viewincidentslog: {
        name: "viewincidentslog",
        risk_text: "Semi-dangerous",

        source: "ede",

        arguments: {}
    },
    editsystemmessages: {
        name: "editsystemmessages",
        risk_text: "Dangerous",

        source: "ede",

        arguments: {}
    }
});

export const registry_skins = new RegistryContainer<SkinsObject>("ede", getSkins);
export const registry_namespaces = new RegistryContainer<Page.NamespacesObject>("ede", Page.getAllNamespacesFromDB);

export const registry_action_restriction_object_types = new RegistryContainer<ActionRestrictionObjectTypes>("ede", undefined, {
    "page@id": {
        name: "page@id",
        description: "Restrict a page by it's id",
        pattern: /^[0-9]+$/
    }
});

export const registry_action_restriction_types = new RegistryContainer<{ [object_type: string]: ActionRestrictionTypesObject }>("ede", undefined, {
    page: {
        edit: {
            name: "edit",
            display_name: "Editing",
            display_iconclass: "fas fa-pen"
        },
        move: {
            name: "move",
            display_name: "Moving (renaming)",
            display_iconclass: "fas fa-arrow-right"
        },
        delete: {
            name: "delete",
            display_name: "Deleting",
            display_iconclass: "fas fa-trash"
        },
        viewarchives: {
            name: "viewarchives",
            display_name: "Restoring and viewing archives",
            display_iconclass: "fas fa-archive"
        }
    }
});

export const registry_page_info_types = new RegistryContainer<Page.PageInfoTypes>("ede", undefined, {
    hiddentitle: {
        display_name: "Hidden title",

        value_type: "boolean",
        default_value: false,

        source: "ede"
    },
    hiddennamespacename: {
        display_name: "Hidden namespace name",
        description: "Hides namespace from the title",

        value_type: "boolean",
        default_value: false,

        source: "ede"
    },
    nocontainer: {
        display_name: "No container",

        value_type: "boolean",
        default_value: false,

        source: "ede"
    }
});

export const registry_systempages = new RegistryContainer<Page.SystemPageDescriptorsObject>("ede", undefined, {
    wikipagemanagement: {
        name: "WikiPageManagement",

        display_title: "Page management",
        display_category: "wiki",
        display_description: "View information abot a page, delete it, protect, etc.",
        display_icon: "fas fa-file-alt",

        source: "ede",

        systempage_config: wikiPageManagement
    },
    deletedwikipages: {
        name: "DeletedWikiPages",

        display_title: "Deleted pages",
        display_category: "wiki",
        display_description: "Manage, view and restore deleted wiki pages",
        display_icon: "fas fa-archive",

        source: "ede",

        systempage_config: deletedWikiPages
    },
    usergroupmanagement: {
        name: "UserGroupManagement",

        display_title: "User group management",
        display_category: "users_and_groups",
        display_description: "Modify rights, assigned to user groups",
        display_icon: "fas fa-users-cog",

        source: "ede",

        systempage_config: userGroupManagement
    },
    config: {
        name: "Config",

        display_title: "EDE Configuration",
        display_category: "ede_config",
        display_description: "All configuration options for EDE and extesions",
        display_icon: "fas fa-cog",

        source: "ede",

        dynamic_content: config
    },
    dashboard: {
        name: "Dashboard",

        display_title: "Dashboard",
        display_category: "other",
        display_description: "EDE Status and a list of system pages",
        display_icon: "fas fa-tachometer-alt",

        source: "ede",

        dynamic_content: dashboard
    },
    login: {
        name: "Login",

        display_title: "Login",
        display_category: "user",
        display_description: "Login and registration page",
        display_icon: "fas fa-sign-in-alt",

        source: "ede",

        dynamic_content: login
    },
    usersettings: {
        name: "UserSettings",

        display_title: "User Settings",
        display_category: "user",
        display_description: "Change your settings and preferences",
        display_icon: "fas fa-cog",

        source: "ede",

        dynamic_content: userSettings
    },
    systemmessages: {
        name: "SystemMessages",

        display_title: "System Messages",
        display_category: "ede_config",
        display_description: "System Messages configuration",
        display_icon: "fas fa-list",

        source: "ede",

        systempage_config: systemMessages
    },
    incidentslog: {
        name: "IncidentsLog",

        display_title: "Incidents log",
        display_category: "other",
        display_description: "View all incident/error logs",
        display_icon: "fas fa-bug",

        source: "ede",

        systempage_config: incidentsLog
    },
    fileupload: {
        name: "FileUpload",

        display_title: "File upload",
        display_category: "files",
        display_description: "Upload files to EDE",
        display_icon: "fas fa-upload",

        source: "ede",

        systempage_config: fileUpload
    },
});

// TODO add summaries to arguments
export const registry_apiRoutes = new RegistryContainer<ApiRoutesObject>("ede", undefined, {
    "file/upload": {
        name: "file/upload",
        method: "POST",

        description: "Upload files",

        required_arguments: ["filenames", "destination"],
        required_rights: ["file_upload"],

        arguments: {
            filenames: {
                name: "filenames",
                display_name: "Array of filenames. file_0 has a name of filenames[0], file_1 is filenames[1], and so on",

                type: "string[]"
            },
            destination: {
                name: "destination",
                display_name: "Only `file_storage` is supported for now",

                type: "string"
            },
        },

        handler: uploadRoute
    },
    "file/get": {
        name: "file/get",
        method: "GET",

        description: "Download the file",

        required_arguments: [],
        required_rights: [],
        anonymous_call_allowed: true,

        arguments: {
            name: {
                name: "name",
                display_name: "File name",

                type: "string"
            },
            uid: {
                name: "uid",
                display_name: "Unique file id",

                type: "string"
            },
        },

        handler: fileGetRoute
    },
    "file/checknames": {
        name: "file/checknames",
        method: "GET",

        description: "Check if file names are available",

        required_arguments: ["filenames"],
        required_rights: [],
        anonymous_call_allowed: true,

        arguments: {
            filenames: {
                name: "filenames",
                display_name: "File names that will be checked",

                type: "string[]"
            },
        },

        handler: fileCheckNamesRoute
    },
    "page/get": {
        name: "page/get",
        method: "GET",

        description: "Get page's content",

        required_arguments: [],
        required_rights: [],
        anonymous_call_allowed: true,

        arguments: {
            title: {
                name: "title",
                display_name: "Get the last revision of a page by it's title",

                type: "string"
            },
            revid: {
                name: "revid",
                display_name: "Get page's revision by revision id",

                type: "string"
            },
            allow_deleted: {
                name: "allow_deleted",
                display_name: "Allow retrieving deleted revisions",
                description: "wiki_restorepage right required",

                type: "boolean"
            },
            get_raw: {
                name: "get_raw",
                display_name: "Get raw wikitext",

                type: "boolean"
            }
        },

        handler: getPageRoute
    },
    "revision/get": {
        name: "revision/get",
        method: "GET",

        description: "Get revisions",

        required_arguments: [],
        required_rights: [],
        anonymous_call_allowed: true,

        arguments: {
            pageid: {
                name: "pageid",
                display_name: "ID of the page to get the revisions for",

                type: "string"
            },
            userid: {
                name: "userid",
                display_name: "ID of the user whos revisions to get",

                type: "string"
            },
            include_deleted: {
                name: "include_deleted",
                display_name: "Include deleted revisions",
                description: "wiki_restorepage right required",

                type: "boolean"
            },
        },

        handler: getRevisionRoute
    },
    "revision/diff": {
        name: "revision/diff",
        method: "GET",

        description: "Diff two revisions",

        required_arguments: ["revid_from", "revid_to"],
        required_rights: [],
        anonymous_call_allowed: true,

        arguments: {
            revid_from: {
                name: "revid_from",
                display_name: "First revision id",

                type: "number"
            },
            revid_to: {
                name: "revid_to",
                display_name: "Second revision id",

                type: "number"
            },
            as_html: {
                name: "as_html",
                display_name: "Get as html",

                type: "boolean"
            },
        },

        handler: getRevisionsDiffRoute
    },
    "user/logout": {
        name: "user/logout",
        method: "POST",

        description: "Log out",

        required_arguments: [],
        required_rights: [],

        arguments: {},

        handler: logoutUserRoute
    },
    "user/create_elevated_session": {
        name: "user/create_elevated_session",
        method: "POST",

        description: "Create an elevated session",

        required_arguments: ["password"],
        required_rights: [],

        arguments: {
            password: {
                name: "password",
                display_name: "Current user's password in clear text",

                type: "string"
            }
        },

        handler: createElevatedSessionRoute
    },
    "user/update_password": {
        name: "user/update_password",
        method: "POST",

        description: "Update own password",

        required_arguments: ["new_password"],
        required_rights: [],
        required_elevated_session: true,

        arguments: {
            password: {
                name: "new_password",
                display_name: "New password in clear text",

                type: "string"
            }
        },

        handler: updateUserPasswordRoute
    },
    "user/request_email_address_change": {
        name: "user/request_email_address_change",
        method: "POST",

        description: "Start the email change proccess",

        required_arguments: ["new_address"],
        required_rights: [],
        required_elevated_session: true,

        arguments: {
            password: {
                name: "new_address",
                display_name: "New email address",

                type: "string"
            }
        },

        handler: requestUserEmailChangeRoute
    },
    "user/start_f2a_setup": {
        name: "user/start_f2a_setup",
        method: "POST",

        description: "Start two-factor authentication setup",

        required_arguments: [],
        required_rights: [],
        required_elevated_session: true,

        arguments: {},

        handler: userStart2FASetupRoute
    },
    "user/finish_f2a_setup": {
        name: "user/finish_f2a_setup",
        method: "POST",

        description: "Finish the two-factor authentication setup",

        required_arguments: ["otp"],
        required_rights: [],
        required_elevated_session: true,

        arguments: {
            otp: {
                name: "otp",
                display_name: "One-time password",

                type: "string"
            }
        },

        handler: userFinish2FASetupRoute
    },
    "user/disable_f2a": {
        name: "user/disable_f2a",
        method: "POST",

        description: "Disable two-factor authentication",

        required_arguments: [],
        required_rights: [],
        required_elevated_session: true,

        arguments: {},

        handler: userDisable2FARoute
    },
    "user/get_notifications": {
        name: "user/get_notifications",
        method: "GET",

        description: "Get current user's notifications",

        required_arguments: [],
        required_rights: [],

        arguments: {
            from: {
                name: "from",
                display_name: "Start id",
                description: "Start id of the notification",

                type: "number"
            },
            records_number: {
                name: "records_number",
                display_name: "Number of records",
                description: "Number of notifications to recieve. Max 100",

                type: "number"
            }
        },

        handler: getUserNotificationsRoute
    },
    "user/get_notifications_status": {
        name: "user/get_notifications_status",
        method: "GET",

        description: "Get current user's notifications status",

        required_arguments: [],
        required_rights: [],

        arguments: {},

        handler: userGetNotificationsStatusRoute
    },
    "user/notification_mark_read": {
        name: "user/notification_mark_read",
        method: "POST",

        description: "Mark user's notification as read",

        required_arguments: [],
        required_rights: [],

        arguments: {
            notification_id: {
                name: "notification_id",
                display_name: "Notification id",

                type: "number"
            }
        },

        handler: markUserNotificationReadRoute
    },
    "page/save": {
        name: "page/save",
        method: "POST",

        description: "Save thae page, creating a new revision",

        required_arguments: ["page_title", "page_content", "csrf_token"],
        required_rights: ["wiki_edit", "?wiki_createpage"],

        arguments: {
            page_title: {
                name: "page_title",
                display_name: "Page title",
                description: "Full page title",

                type: "string"
            },
            page_content: {
                name: "page_content",
                display_name: "New content",
                description: "Raw wikitext content",

                type: "string"
            },
            summary: {
                name: "summary",
                display_name: "Summary",

                type: "string"
            }
        },

        handler: pageSaveRoute
    },
    "page/delete": {
        name: "page/delete",
        method: "POST",

        description: "Delete the page",

        required_arguments: ["title", "csrf_token"],
        required_rights: ["wiki_deletepage"],

        arguments: {
            title: {
                name: "title",
                display_name: "Page title",

                type: "string"
            },
            db_removal: {
                name: "db_removal",
                display_name: "Completely remove the page from the database",

                type: "boolean"
            }
        },

        handler: pageDeleteRoute
    },
    "page/restore": {
        name: "page/restore",
        method: "POST",

        description: "Restore deleted page",

        required_arguments: ["pageid", "csrf_token"],
        required_rights: ["wiki_restorepage"],

        arguments: {
            pageid: {
                name: "pageid",
                display_name: "ID of the page to be restored",

                type: "number"
            },
            new_namespace: {
                name: "new_namespace",
                display_name: "New namespace",
                description: "If you want to restore the page to some other title",

                type: "string"
            },
            new_name: {
                name: "new_name",
                display_name: "New name (without the namespace)",
                description: "If you want to restore the page to some other title",

                type: "string"
            }
        },

        handler: pageRestoreRoute
    },
    "page/move": {
        name: "page/move",
        method: "POST",

        description: "Move (rename) the page",

        required_arguments: ["title", "new_namespace", "new_name", "csrf_token"],
        required_rights: ["wiki_movepage"],

        arguments: {
            title: {
                name: "title",
                display_name: "Current title",

                type: "string"
            },
            new_namespace: {
                name: "new_namespace",
                display_name: "New namespace",

                type: "string"
            },
            new_name: {
                name: "new_name",
                display_name: "New name (without the namespace)",

                type: "string"
            }
        },

        handler: pageMoveRoute
    },
    "usergroup/update": {
        name: "usergroup/update",
        method: "POST",

        description: "Update a usergroup",

        required_arguments: ["group_name", "rights", "right_arguments", "csrf_token"],
        required_rights: ["modifyusergroups"],

        arguments: {
            group_name: {
                name: "group_name",
                display_name: "Group name",
                description: "Internal name of the target group",

                type: "string"
            },
            rights: {
                name: "rights",
                display_name: "Assigned rights",
                description: "Object, where the key is the name of the right and the value is a boolean, indicating, whether or not the \
right is assigned to the group",

                type: "object"
            },
            right_arguments: {
                name: "right_arguments",
                display_name: "Right arguments",
                description: "Object, where the key is the name of the right argument and the value is it's value",

                type: "object"
            },
            summary: {
                name: "summary",
                display_name: "Summary",

                type: "string"
            }
        },

        handler: updateUserGroupRoute
    },
    "usergroup/create": {
        name: "usergroup/create",
        method: "POST",

        description: "Create a new usergroup",

        required_arguments: ["new_group_name", "csrf_token"],
        required_rights: ["modifyusergroups"],

        arguments: {
            new_group_name: {
                name: "new_group_name",
                display_name: "Group name",
                description: "Name of the new group",

                type: "string"
            }
        },

        handler: createUserGroupRoute
    },
    "usergroup/delete": {
        name: "usergroup/delete",
        method: "POST",

        description: "Delete a usergroup",

        required_arguments: ["group_name", "csrf_token"],
        required_rights: ["modifyusergroups"],

        arguments: {
            group_name: {
                name: "group_name",
                display_name: "Group name",
                description: "Name of the group to be deleted",

                type: "string"
            }
        },

        handler: deleteUserGroupRoute
    },
    "user/updategroups": {
        name: "user/updategroups",
        method: "POST",

        description: "Update user's assigned groups",

        required_arguments: ["username", "groups", "csrf_token"],
        required_rights: ["modifyusergroupmembership"],

        arguments: {
            username: {
                name: "username",
                display_name: "Username",
                description: "Username of the target user",

                type: "string"
            },
            groups: {
                name: "groups",
                display_name: "Groups",
                description: "Object, where the key is the internal name of the group and the value is a boolean, indicating, whether or \
not it is assigned to the user",

                type: "object"
            },
            summary: {
                name: "summary",
                display_name: "Summary",

                type: "string"
            }
        },

        handler: updateUserGroupMembershipRoute
    },
    "config/setitem": {
        name: "config/setitem",
        method: "POST",

        description: "Set a config item",

        required_arguments: ["csrf_token", "key", "value"],
        required_rights: ["modifyconfig"],

        arguments: {
            key: {
                name: "key",
                display_name: "Key",
                description: "Config key to change",

                type: "string"
            },
            value: {
                name: "value",
                display_name: "Value",
                description: "New value",

                type: "string"
            },
        },

        handler: configSetItemRoute
    },
    "config/resetitem": {
        name: "config/resetitem",
        method: "POST",

        description: "Reset a config item to it's default value",

        required_arguments: ["key", "csrf_token"],
        required_rights: ["modifyconfig"],

        arguments: {
            key: {
                name: "key",
                display_name: "Config item key",
                description: "Key of the item to be reset to it's default value",

                type: "string"
            },
        },

        handler: configResetItemRoute
    },
    "action_restrictions/update": {
        name: "action_restrictions/update",
        method: "POST",

        description: "Create/update an action restriction settings for an object",

        required_arguments: ["object_type", "target_object", "restricted_actions", "restrict_to", "csrf_token"],
        required_rights: ["manageactionrestrictions"],

        arguments: {
            object_type: {
                name: "object_type",
                display_name: "Object type",
                description: "Type of object, action restrictions of which will be updated. Ex. page@id, sysmsg@name",

                type: "string"
            },
            target_object: {
                name: "target_object",
                display_name: "Target object",
                description: "Target object, action restrictions of which will be updated. This can be an id, a name, etc. depending on the object_type argument",

                type: "string"
            },
            restricted_actions: {
                name: "restricted_actions",
                display_name: "Restricted actions",
                description: "A JSON object with the restricted actions. true for restricted, false for non-restricted. Ex. { write: true, move: false }",

                type: "JSON"
            },
            restrict_to: {
                name: "restrict_to",
                display_name: "Restrict to",
                description: "A grant right name to restrict the actions to (without the prepending tilda). Will be created, if does not exist yet",

                type: "string"
            },
        },

        handler: updateActionRestrictionsRoute
    },
    "systemmessage/get": {
        name: "systemmessage/get",
        method: "GET",

        description: "Get system messages",

        required_arguments: ["name"],
        required_rights: [],
        anonymous_call_allowed: true,

        arguments: {
            name: {
                name: "name",
                display_name: "System message name",
                description: "This can be a name or a few first characters of a name, if you want to get multiple records",

                type: "string"
            },
            from: {
                name: "from",
                display_name: "Start index",
                description: "Start index for the system messages",

                type: "number"
            },
            to: {
                name: "to",
                display_name: "End index",
                description: "End index for the system messages. end index - start index = number of records that will be retrieved. Maximum number of records that can be retrieved from one API call - 100",

                type: "number"
            },
            encode_values: {
                name: "encode_values",
                display_name: "Encode values",
                description: "Make system message values html entity encoded",

                type: "boolean"
            },
        },

        handler: systemmessageGetRoute
    },
    "systemmessage/set": {
        name: "systemmessage/set",
        method: "POST",

        description: "Set a new value for a System Message",

        required_arguments: ["name", "value", "csrf_token"],
        required_rights: ["editsystemmessages"],

        arguments: {
            name: {
                name: "name",
                display_name: "System message name",

                type: "string"
            },
            value: {
                name: "value",
                display_name: "New value",

                type: "string"
            },
        },

        handler: systemmessageSetRoute
    },
    "systemmessage/create": {
        name: "systemmessage/create",
        method: "POST",

        description: "Create a new System Message with a value",

        required_arguments: ["name", "value", "csrf_token"],
        required_rights: ["editsystemmessages"],

        arguments: {
            name: {
                name: "name",
                display_name: "System message name",

                type: "string"
            },
            value: {
                name: "value",
                display_name: "Value",

                type: "string"
            },
        },

        handler: systemmessageCreateRoute
    },
    "systemmessage/delete": {
        name: "systemmessage/delete",
        method: "POST",

        description: "Delete a System Message",

        required_arguments: ["name", "csrf_token"],
        required_rights: ["editsystemmessages"],

        arguments: {
            name: {
                name: "name",
                display_name: "System message name",

                type: "string"
            },
        },

        handler: systemmessageDeleteRoute
    },
    "incidentlogs/get": {
        name: "incidentlogs/get",
        method: "GET",

        description: "Get incident logs",

        required_arguments: [],
        required_rights: ["viewincidentslog"],

        arguments: {
            from: {
                name: "from",
                display_name: "Start id",
                description: "Start id of the incident log",

                type: "number"
            },
            records_number: {
                name: "records_number",
                display_name: "Number of records",
                description: "Number of logs to retrieve. Max 100",

                type: "number"
            }
        },

        handler: getIncidentLogsRoute
    },
    "user/block": {
        name: "user/block",
        method: "POST",

        description: "Block a user",

        required_arguments: ["username", "restrictions", "csrf_token"],
        required_rights: ["editsystemmessages"],

        arguments: {
            username: {
                name: "username",
                display_name: "Username",
                description: "Target user's username",

                type: "string"
            },
            restrictions: {
                name: "restrictions",
                display_name: "Restrictions",
                description: "Object, where the key is the name of the restriction and the value is a boolean, indicating, whether or \
not it is enabled",

                type: "object"
            },
            summary: {
                name: "summary",
                display_name: "Summary",

                type: "string"
            }
        },

        handler: blockUserRoute
    }
});

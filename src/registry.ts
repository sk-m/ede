import { ConfigItemsObject, getConfigFromDB } from "./config";
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
export const registry_hook_subscribers = new RegistryContainer<HookSubscribersObject>("ede", undefined, {});
export const registry_hooks = new RegistryContainer<HooksObject>("ede", undefined, {});

export const registry_usergroups = new RegistryContainer<GroupsObject>("ede", User.getAllUserGroups, {});
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
    // TODO @placeholder
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
    editsystemmessages: {
        name: "editsystemmessages",
        risk_text: "Dangerous",

        source: "ede",

        arguments: {}
    }
});

export const registry_skins = new RegistryContainer<SkinsObject>("ede", getSkins);
export const registry_namespaces = new RegistryContainer<Page.NamespacesObject>("ede", Page.getNamespacesFromDB);

export const registry_systempages = new RegistryContainer<Page.SystemPageDescriptorsObject>("ede", undefined, {
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
        display_category: "other",
        display_description: "Login and registration page",
        display_icon: "fas fa-sign-in-alt",

        source: "ede",

        dynamic_content: login
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
});

export const registry_apiRoutes = new RegistryContainer<ApiRoutesObject>("ede", undefined, {
    // TODO rename to page/get
    "page/get": {
        name: "page/get",
        method: "GET",

        description: "Get page's parsed and ready to serve content",

        required_arguments: ["title"],
        required_rights: [],

        arguments: {
            title: {
                name: "title",
                display_name: "Page title",

                type: "string"
            }
        },

        handler: getPageRoute
    },
    "page/save": {
        name: "page/save",
        method: "POST",

        description: "Save thae page, creating a new revision",

        required_arguments: ["page_namespace", "page_name", "page_content", "csrf_token"],
        required_rights: ["wiki_edit", "?wiki_createpage"],

        arguments: {
            page_namespace: {
                name: "page_namespace",
                display_name: "Page namespace",
                description: "Namespace of the target page (use with <code>page_name</code>)",

                type: "string"
            },
            page_name: {
                name: "page_name",
                display_name: "Page name",
                description: "Name of the target page, without the namespace part (use with <code>page_namespace</code>)",

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

        required_arguments: ["csrf_token"],
        required_rights: ["modifyconfig"],


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

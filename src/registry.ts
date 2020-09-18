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
    public get(): T {
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
    "get/page": {
        name: "get/page",
        method: "GET",

        handler: getPageRoute
    },
    "page/save": {
        name: "page/save",
        method: "POST",

        handler: pageSaveRoute
    },
    "usergroup/update": {
        name: "usergroup/update",
        method: "POST",

        handler: updateUserGroupRoute
    },
    "usergroup/create": {
        name: "usergroup/create",
        method: "POST",

        handler: createUserGroupRoute
    },
    "usergroup/delete": {
        name: "usergroup/delete",
        method: "POST",

        handler: deleteUserGroupRoute
    },
    "user/updategroups": {
        name: "user/updategroups",
        method: "POST",

        handler: updateUserGroupMembershipRoute
    },
    "config/setitem": {
        name: "config/setitem",
        method: "POST",

        handler: configSetItemRoute
    },
    "config/resetitem": {
        name: "config/resetitem",
        method: "POST",

        handler: configResetItemRoute
    },
    "systemmessage/set": {
        name: "systemmessage/set",
        method: "POST",

        handler: systemmessageSetRoute
    },
    "systemmessage/create": {
        name: "systemmessage/create",
        method: "POST",

        handler: systemmessageCreateRoute
    },
    "systemmessage/delete": {
        name: "systemmessage/delete",
        method: "POST",

        handler: systemmessageDeleteRoute
    },
    "user/block": {
        name: "user/block",
        method: "POST",

        handler: blockUserRoute
    }
});

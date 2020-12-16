// Local imports
import { sql } from "./server";
import * as Util from "./utils";
import { registry_config } from "./registry";

// All allowed value types for database config item (as string names)
type ConfigItemValueTypeName = "bool" | "int" | "string" | "json" | "array" | "allowed_values";
// All allowed value types as typescript types
type ConfigItemValueType = boolean | number | string | JSON | string[] | undefined;

export type ConfigItemsObject = { [key: string]: DatabaseConfigItem };
export type ConfigTriggersObject = { [key: string]: ConfigTrigger };

export interface ConfigTrigger {
    description: string;

    handler: (...params: any) => void;
}

export enum ConfigItemAccessLevel {
    /** All (only for read). */
    All = 0,

    /** Only for users with modifyconfig right. */
    Right = 1,

    /** Only for users with a right AND a permit. */
    Permit = 2,

    /** None (cli access only, for read and write). */
    None = 3
}

export interface DatabaseConfigItem {
    readonly key: string;

    raw_value?: string;
    value?: ConfigItemValueType;
    is_default: boolean;

    value_type: ConfigItemValueTypeName;
    default_value?: ConfigItemValueType;
    allowed_values?: ConfigItemValueType[];
    value_pattern?: RegExp;

    tags: string[];
    triggers: string[];
    description?: string;
    source: string;

    read_access: ConfigItemAccessLevel;
    write_access: ConfigItemAccessLevel;
};

// Cast a value to the provided type
/**
 * Cast a string value to the appropriate type
 *
 * @param raw_value raw value
 * @param type value's type
 */
function castValue(raw_value: string, type: ConfigItemValueTypeName): ConfigItemValueType {
    if(raw_value === null) return undefined;

    switch(type) {
        case "allowed_values":
        case "string": {
            return raw_value;
        }
        case "bool": {
            return raw_value === "true";
        }
        case "int": {
            return parseInt(raw_value, 10);
        }
        case "json": {
            return JSON.parse(raw_value);
        }
        case "array": {
            return raw_value.split("|");
        }

        default:
            return undefined;
    }
}

/**
 * Get config from the database
 *
 * @returns [[ConfigItemsObject]]
 *
 * @category Registry updater
 */
export async function getConfigFromDB(): Promise<ConfigItemsObject> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("SELECT * FROM `config`", (error: Error, results: any) => {
            if(error) {
                Util.log(`Failed to get configuration from the database!`, 4, error, null, false);

                process.exit(1);
            }

            const result: ConfigItemsObject = {};
            let parsed_allowed_values: string[] | undefined;

            for(const item of results) {
                // Get the allowed values
                if(item.allowed_values) {
                    parsed_allowed_values = item.allowed_values.split("|");
                } else {
                    parsed_allowed_values = undefined;
                }

                let raw_value;
                const raw_access_level = item.access_level.readInt8(0);

                if(item.value) raw_value = item.value;
                else raw_value = item.default_value;

                result[item.key] = {
                    key: item.key,

                    raw_value,
                    value: castValue(raw_value, item.value_type),

                    // Keep in mind that we compare *raw uncast* value to the default value
                    is_default: !item.value || item.default_value === item.value,

                    value_type: item.value_type,
                    default_value: item.default_value,
                    allowed_values: parsed_allowed_values,
                    value_pattern: item.value_pattern,

                    tags: item.tags
                    ? item.tags.split("|")
                    : [],

                    triggers: item.triggers
                    ? item.triggers.split("|")
                    : [],

                    description: item.description,
                    source: item.source,

                    // Read access is the two least significant bits (__XX). We mask it with 0011b
                    read_access: raw_access_level & 0x3,

                    // Write access is the two most significant bits (XX__)
                    write_access: raw_access_level >> 2
                };
            }

            resolve(result);
        });
    });
}

/**
 * Update config item's value
 *
 * @param key key
 * @param value value
 * @param sanitize sanitize the value
 */
export async function setValue(key: string, value: any, sanitize: boolean = true): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        const config_item = registry_config.get()[key];

        // Check if config item with requested key exists
        if(!config_item) {
            reject(new Util.Rejection(Util.RejectionType.CONFIG_ITEM_NOT_FOUND, "Requested config item does not exist"));

            return;
        }

        let final_value;

        // Check the value
        switch(config_item.value_type) {
            case "int": {
                if(!parseInt(value, 10)) {
                    reject(new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "Invalid value. Expected an integer"));
                    return;
                }
            } break;

            case "json": {
                if(!(value instanceof Object)) {
                    reject(new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "Invalid value. Expected an object"));
                    return;
                }

                final_value = JSON.stringify(value);
            } break;

            case "array": {
                if(!(value instanceof Array)) {
                    reject(new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "Invalid value. Expected an array"));
                    return;
                }

                if(sanitize) {
                    // tslint:disable-next-line: forin
                    for(const i in value) {
                        value[i] = Util.sanitize(value[i]);
                    }
                }

                final_value = value.join(",");
            } break;

            case "allowed_values": {
                if(config_item.allowed_values && !config_item.allowed_values.includes(value)) {
                    reject(new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "Invalid value. Value is not one of allowed values"));
                    return;
                }
            } break;

            case "bool": {
                // Also check if value is represented by a string
                if(typeof value !== "boolean" && !(value === "true" || value === "false")) {
                    reject(new Error("Invalid value. Expected a boolean"));
                    return;
                }
            } break;

            default: {
                // Check regex pattern
                if(config_item.value_pattern) {
                    if(!new RegExp(config_item.value_pattern, "gm").test(value)) {
                        reject(new Error("Invalid value. Pattern mismatch"));
                        return;
                    }
                }

                if(sanitize) final_value = Util.sanitize(value);
            }
        }

        sql.execute("UPDATE `config` SET `value` = ? WHERE `key` = ?",
        [final_value || value, key],
        (error: any) => {
            if(error) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not update config item"));
                Util.log(`Could not update a config item`, 3, error, { key, value });
            } else resolve();
        });
    });
}

/**
 * Set config item's value to default_value in the database
 *
 * @param key key
 */
export async function resetItem(key: string): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        // Get the config item
        const config_item = registry_config.get()[key];

        // Check if such key exists
        if(!config_item) {
            reject(new Util.Rejection(Util.RejectionType.CONFIG_ITEM_NOT_FOUND, "Requested config item does not exist"));

            return;
        }

        // Check if we can reset
        if(!config_item.default_value) {
            reject(new Util.Rejection(Util.RejectionType.CONFIG_ITEM_NOT_FOUND, "Can't reset config item because there is no default value to reset to"));

            return;
        }

        sql.execute("UPDATE `config` SET `value` = ? WHERE `key` = ?",
        [config_item.default_value, config_item.key],
        (error: any) => {
            if(error) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not reset a config item"));
                Util.log(`Could not reset a config item`, 3, error, { key });
            } else resolve();
        });
    });
}

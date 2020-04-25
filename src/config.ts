// Local imports
import { sql } from "./server";
import * as Util from "./utils";
import { registry_config } from "./registry";

// All allowed value types for database config item (as string names)
type ConfigItemValueTypeName = "bool" | "int" | "string" | "json" | "array" | "allowed_values";
// All allowed value types as typescript types
type ConfigItemValueType = boolean | number | string | JSON | string[] | undefined;

export type ConfigItemsObject = { [key: string]: DatabaseConfigItem };

export enum ConfigItemAccessLevel {
    /** Read — all, write — users with a right. */
    rAwR = 0,
    /** Read — all, write — CLI only. */
    rAwX = 1,
    /** Read — users with a right, write — users with a right. */
    rRwR = 2,
    /** Read — CLI only, write — CLI only. */
    rXwX = 3,
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

    tags?: string[];
    description?: string;
    source: string;

    access_level: ConfigItemAccessLevel;
};

/**
 * Parses allowed_values string to an array of strings
 *
 * @param allowed_values ';'-separated string of allowed values
 */
function parseAllowedValues(allowed_values: string): string[] {
    const split_string: string[] = allowed_values.replace(/ /g, "").split(";");
    return split_string;
}

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
            return raw_value.split(",");
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
        sql.query("SELECT * FROM `config`", (error: Error, results: any) => {
            if(error) {
                Util.log(`Failed to get configuration from the database!`, 3, error);

                reject(error);
                return;
            }

            const result: ConfigItemsObject = {};
            let parsed_allowed_values: string[] | undefined = [];

            for(const item of results) {
                if(item.allowed_values) {
                    parsed_allowed_values = parseAllowedValues(item.allowed_values);
                } else {
                    parsed_allowed_values = undefined;
                }

                let raw_value;
                if(item.value) raw_value = item.value;
                else raw_value = item.default_value;

                result[item.key] = {
                    key: item.key,

                    raw_value,
                    value: castValue(raw_value, item.value_type),
                    is_default: !item.value || item.default_value === item.value,

                    value_type: item.value_type,
                    default_value: item.default_value,
                    allowed_values: parsed_allowed_values,
                    value_pattern: item.value_pattern,

                    tags: item.tags,
                    description: item.description,
                    source: item.source,

                    access_level: item.access_level.readInt8(0)
                };
            }

            resolve(result);
        });
    });
}

/**
 * Update config's value
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
            reject(new Error("Invalid config item key"));
            return;
        }

        // Construct a query
        let sql_query = "";

        switch(config_item.value_type) {
            case "int": {
                if(!parseInt(value, 10)) {
                    reject(new Error("Invalid value. Expected an integer"));
                    return;
                }

                sql_query = `UPDATE \`config\` SET \`value\` = ${ value } WHERE \`key\` = '${ key }'`;
            } break;

            case "json": {
                if(!(value instanceof Object)) {
                    reject(new Error("Invalid value. Expected an object"));
                    return;
                }

                sql_query = `UPDATE \`config\` SET \`value\` = '${ JSON.stringify(value) }' WHERE \`key\` = '${ key }'`;
            } break;

            case "array": {
                if(!(value instanceof Array)) {
                    reject(new Error("Invalid value. Expected an array"));
                    return;
                }

                if(sanitize) {
                    // tslint:disable-next-line: forin
                    for(const i in value) {
                        value[i] = Util.sanitize(value[i]);
                    }
                }

                sql_query = `UPDATE \`config\` SET \`value\` = '${ value.join(",") }' WHERE \`key\` = '${ key }'`;
            } break;

            case "allowed_values": {
                if(config_item.allowed_values && !config_item.allowed_values.includes(value)) {
                    reject(new Error("Invalid value. Value is not one of allowed values"));
                    return;
                }

                sql_query = `UPDATE \`config\` SET \`value\` = '${ value }' WHERE \`key\` = '${ key }'`;
            } break;

            case "bool": {
                if(typeof value !== "boolean") {
                    reject(new Error("Invalid value. Expected a boolean"));
                    return;
                }

                sql_query = `UPDATE \`config\` SET \`value\` = '${ value }' WHERE \`key\` = '${ key }'`;
            } break;

            default: {
                // Check regex pattern
                if(config_item.value_pattern) {
                    if(!new RegExp(config_item.value_pattern, "gm").test(value)) {
                        reject(new Error("Invalid value. Pattern mismatch"));
                        return;
                    }
                }

                if(sanitize) value = Util.sanitize(value);

                sql_query = `UPDATE \`config\` SET \`value\` = '${ value }' WHERE \`key\` = '${ key }'`;
            }
        }

        sql.query(sql_query, (error: any) => {
            if(error) reject(error);
            else resolve();
        });
    });
}

// Local imports
import { sql } from "./server";
import * as Util from "./utils";

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

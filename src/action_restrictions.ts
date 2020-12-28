import { sql } from "./server";
import * as Util from "./utils";

export interface ActionRestriction {
    id: number;

    object_type: string;
    object: string;

    restricted_actions: any;

    restriction_type: string;
    restricted_to: string;

    restricted_on: number;
    restricted_by: number;
}

export type ActionRestrictionTypesObject = { [name: string]: ActionRestrictionType };
export interface ActionRestrictionType {
    name: string;

    display_name: string;
    display_iconclass: string;
}

export type ActionRestrictionObjectTypes = { [name: string]: ActionRestrictionObjectType } ;
export interface ActionRestrictionObjectType {
    name: string;
    description: string;

    pattern?: RegExp;
}

export type GrantRightsObject = { [name: string]: GrantRight };
export interface GrantRight {
    id: number;
    name: string;

    dependents_num: number;
}

/**
 * Create or update a grant right and it's number of dependents
 *
 * @param grant_right_name grant right name
 * @param on_update increment or decrement the dependents number, if such grant right already exists
 */
export async function updateGrantRight(grant_right_name: string, on_update: "increment" | "decrement" = "increment"): Promise<void> {
    return new Promise((resolve: any) => {
        const arithmetic_sign = on_update === "increment"
            ? "+"
            : "-";

        const sql_query = "INSERT INTO `grant_rights` (`name`, `dependents_num`) VALUES (?, 1) ON DUPLICATE KEY UPDATE \
        `dependents_num` = `dependents_num` " + arithmetic_sign + " 1";

        sql.execute(sql_query,
        [grant_right_name],
        (error: Error, results: any) => {
            if(error) {
                Util.log(`Failed to create/update a grant right`, 3, error);
            }

            resolve();
        });
    });
}

/**
 * Create or update an action restriction settings on an object (like a page, system message, etc.)
 *
 * Upon creating an action restriction, selected actions will *only* be executable by users that have the appropriate grant right
 *
 * @param restricted_object_type object type to restrict (ex. page@id, sysmsg@name, etc.)
 * @param restricted_object name of the object to restrict (ex. page id for page@id, system message name for sysmsg@name)
 * @param restricted_actions object containing the actions that will be restricted. true for restricted, false for non-restricted (ex. { edit: true, move: false })
 * @param restriction_type use "grant_right" for now
 * @param restrict_to grant right's name to restrict the actions on the object to
 * @param restricted_by user's id that updated or created the restriction
 */
export async function updateActionRestriction(
    restricted_object_type: string,
    restricted_object: string,
    restricted_actions: any,
    restriction_type: string,
    restrict_to: string,
    restricted_by: number
): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        if(typeof restricted_actions === "object")
            restricted_actions = JSON.stringify(restricted_actions);

        const sql_params: any[] = [
            restricted_object_type,
            restricted_object,
            restricted_actions,
            restriction_type,
            restrict_to,
            restricted_by
        ];

        sql.execute("CALL `new_action_restriction`(?, ?, ?, ?, ?, ?)",
        sql_params,
        (error: Error, results: any) => {
            if(error) {
                Util.log(`Failed to update/create an action restriction`, 3, error, { sql_params });
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not create or update an action restriction"));

                return;
            }

            resolve();
        });
    });
}

/**
 * Get the action restrictions info for an object
 *
 * Please, refer to the [[updateActionRestriction]] function for additional information on the parameters
 *
 * @param object_type target object's type
 * @param object target object
 */
export async function getActionRestrictions(object_type: string, object: string): Promise<ActionRestriction | null> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("SELECT * FROM `action_restrictions` WHERE `restricted_object_type` = ? AND `restricted_object` = ?",
        [object_type, object],
        (error: Error, results: any) => {
            if(error) {
                Util.log(`Failed to get action restrictions from the database`, 3, error, { object_type, object });

                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Failed to get action restrictions from the database"));
                return;
            }

            if(results.length === 0) resolve(null);
            else {
                resolve({
                    ...results[0],

                    object_type: results[0].restricted_object_type,
                    object: results[0].restricted_object,
                });
            }
        });
    });
}

/**
 * Get all available grant rights from the database
 */
export async function getAllGrantRights(): Promise<GrantRightsObject> {
    return new Promise((resolve: any) => {
        sql.execute("SELECT * FROM `grant_rights`", (error: Error, results: any) => {
            if(error) {
                Util.log(`Failed to get grant rights from the database`, 3, error);

                resolve({});
                return;
            }

            const grant_rights: GrantRightsObject = {};

            for(const right of results) {
                grant_rights[right.name] = right;
            }

            resolve(grant_rights);
        });
    });
}

import { sql } from "./server";
import * as Util from "./utils";

export type SystemMessagesObject = { [name: string]: SystemMessage };
export interface SystemMessage {
    name: string;

    /** The value is the same as default_value, if it is not set */
    value: string;
    default_value: string;
    is_default: boolean;

    rev_history: any; // TODO rev_history type

    deletable: boolean;
}

/**
 * Get system message
 *
 * @param name Name(s) of the system messsage(s)
 */
export async function get(names: string[] | string): Promise<SystemMessage | SystemMessagesObject> {
    return new Promise((resolve: any) => {
        let query: string;
        let getting_multiple: boolean = false;

        if(Array.isArray(names)) {
            // Get multiple messages
            getting_multiple = true;

            query = `SELECT * FROM \`system_messages\` WHERE \`name\` IN ('${ names.join("','") }')`;
        } else {
            query = `SELECT * FROM \`system_messages\` WHERE \`name\` = '${ names }'`;
        }

        sql.query(query, (error: Error, results: any) => {
            if(error || results.length === 0) {
                resolve({});
                Util.log(`Could not load '${ names }' system message(s)`, 2);

                return;
            }

            let final_results: SystemMessage | SystemMessagesObject = {};

            if(getting_multiple) {
                for(const sysmsg of results) {
                    final_results[sysmsg.name] = {
                        ...sysmsg,

                        value: sysmsg.value || sysmsg.default_value,
                        is_default: !sysmsg.value
                    };
                }
            } else {
                final_results = {
                    ...results[0],

                    value: results[0].value || results[0].default_value,
                    is_default: !results[0].value
                };
            }

            resolve(final_results);
        });
    });
}

import { registry_hook_subscribers } from "./registry";
import * as Util from "./utils";

export type HookSubscribersObject = { [hook_name: string]: ((...args: any[]) => any)[] };
export type HooksObject = { [hook_name: string]: Hook };

export interface Hook {
    name: string;

    description: string;
    /** Extension that provides this hook */
    source: string;

    /** Arguments that will be passed to the caller */
    call_args: {[arg_name: string]: string};
    /** Arguments that the hook expects to get from the caller */
    response_args: {[arg_name: string]: string};
}

// TODO -any maybe have a schema for hook subscriber's response
/**
 * Call all subscribers of a hook
 *
 * @param hook_name Name of the hook
 * @param hook_arguments Arguments that will be passed to the hook subscriber
 *
 * @returns resolves true on success, false if there are no subscribers for the requested hook and rejects
 * on error in the hook callee
 */
export async function call(hook_name: string, ...hook_arguments: any[]): Promise<any> {
    return new Promise(async (resolve: any, reject: any) => {
        const registry_hook_subscribers_snapshot = registry_hook_subscribers.get();

        // No hook subscribers
        if(!registry_hook_subscribers_snapshot[hook_name]) {
            Util.log(`Could not call '${ hook_name }' hook subscribers, because there are none`, 2);

            resolve(false);
            return;
        }

        try {
            for(const hook_subscriber of registry_hook_subscribers_snapshot[hook_name]) {
                if(typeof hook_subscriber === "function") {
                    await hook_subscriber(...hook_arguments);
                }
            }
        } catch(error) {
            reject(error);
            return;
        }

        resolve(true);
    });
}

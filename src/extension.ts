import fs from "fs";
import path from "path";

import { registry_hook_subscribers } from "./registry";
import * as Util from "./utils";

export interface Extension {
    manifest: ExtensionManifest;

    onLoad: () => void;
}

export interface ExtensionManifest {
    name: string;
    description: string;
    authors: string[];
}

/**
 * Load an extesion by it's name
 *
 * @param extension_name Name of the extension (the same as the name of the folder)
 *
 * @returns resolves on success, rejects on error
 */
export async function load(extension_name: string): Promise<ExtensionManifest> {
    return new Promise((resolve: any, reject: any) => {
        const file_extension = process.env.EDE_DEV === "1" ? "ts" : "js";

        const manifest_path = path.join(__dirname, `../extensions/${ extension_name }/\
${ extension_name }.extension.${ file_extension }`);

        import(manifest_path)
        .then((extension: any) => {
            // Add ede_onload hook subscriber for this extension
            if(typeof extension.onLoad === "function") {
                const onload_subscribers_snapshot = registry_hook_subscribers.get().ede_load || [];

                onload_subscribers_snapshot.push(extension.onLoad);

                registry_hook_subscribers.setKey("ede_load", onload_subscribers_snapshot);
            }

            resolve(true);
        })
        .catch((error: any) => {
            Util.log(`Could not load '${ extension_name }' extension`, 3, error);
            reject(error);
        });
    });
}

/**
 * Load all extensions in the `./extensions` folder, skiping those, which name starts with an underscore
 *
 * @returns resolves on success, rejects on error
 */
export async function loadAll(): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        fs.readdir(path.join(__dirname, "../extensions"), async (dirs_error: any, folders: string[]) => {
            if(dirs_error) {
                const error_message = "Could not load all extensions from ./extensions directory";

                Util.log(error_message, 3);

                reject(new Error(error_message));
                return;
            }

            for(const extension_name of folders) {
                // Skip `_foobar` extensions
                if(extension_name.charAt(0) !== "_") {
                    // Load the extension
                    await load(extension_name)
                    .catch((load_error: any) => {
                        // Pass the exception
                        reject(load_error);
                    });
                }
            }

            resolve();
        });
    });
}
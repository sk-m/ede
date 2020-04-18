import fs from "fs";

export type SkinsObject = { [skin_name: string]: Skin };
export interface Skin {
    readonly index_path: string;
    readonly html: string;

    name: string;
    description: string;
    authors: string[];
}

/**
 * Get all the skins inside `%IP%/skins` folder
 *
 * @category Registry updater
 */
export async function getSkins(): Promise<SkinsObject> {
    return new Promise((resolve: any) => {
        const folders = fs.readdirSync("./skins");
        const skins: SkinsObject = {};

        let manifest: Skin;
        let index_html: string;

        for(const folder of folders) {
            // TODO handle parsing error
            manifest = JSON.parse(
                fs.readFileSync(`./skins/${ folder }/manifest.json`, { encoding: "UTF8" })
            );

            index_html = fs.readFileSync(`./skins/${ folder }/${ manifest.index_path }`,
            { encoding: "UTF8" });

            // Set index_path to default if it was not provided in manifest.json

            skins[manifest.name] = {
                html: index_html,
                ...manifest
            };
        }

        resolve(skins);
    });
}

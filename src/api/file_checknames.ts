import * as Storage from "../storage";

import { apiSendSuccess } from "../api";

export async function fileCheckNamesRoute(req: any, res: any): Promise<void> {
    const filenames = req.query.filenames.split(",");

    // Decode filenames
    // TODO @cleanup
    for(const i in filenames) {
        if(filenames[i]) {
            filenames[i] = decodeURIComponent(filenames[i]);
        }
    }

    const names_check_results = await Storage.checkFilenames(filenames);

    if(names_check_results[0]) {
        apiSendSuccess(res, "file/checknames", { all_available: true });
    } else {
        apiSendSuccess(res, "file/checknames", { all_available: false, conflicting_names: names_check_results[1] });
    }
}

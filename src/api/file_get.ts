import fs from "fs";
import path from "path";

import * as Storage from "../storage";
import * as Util from "../utils";

import { apiSendError } from "../api";

export async function fileGetRoute(req: any, res: any): Promise<void> {
    // TODO @placeholder check cats (and their restricted actions) to see if the client can download the files

    if(req.query.name) {
        const requested_file_name = decodeURIComponent(req.query.name);

        // Get info about the requested file
        Storage.getFileInfo(requested_file_name)
        .then((storage_file_info: Storage.FileInfo) => {
            const fs_file_path = path.join(__dirname, `../../storage/uploads/${ storage_file_info.uid }`);
            const fs_file_info = fs.statSync(fs_file_path);

            res.res.writeHead(200, {
                "Content-Type": storage_file_info.mime_type,
                "Transfer-Encoding": "chunked",
                "Content-Disposition": `attachment; filename="${ encodeURIComponent(storage_file_info.name) }"`,
                "Content-Length": fs_file_info.size
            });

            const read_stream = fs.createReadStream(fs_file_path);
            read_stream.pipe(res.res);
        })
        .catch((rejection: Util.Rejection) => {
            apiSendError(res, rejection);
        });
    } else if(req.query.uid) {
        // Check uid
        if(!req.query.uid.match(/^[a-z0-9-]{35}$/)) {
            apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_INVALID_DATA, "Invalid uid"));
            return;
        }

        const fs_file_path = path.join(__dirname, `../../storage/uploads/${ req.query.uid }`);
        let fs_file_info;

        // Try getting the file
        try {
            fs_file_info = fs.statSync(fs_file_path);
        } catch(e) {
            apiSendError(res, new Util.Rejection(Util.RejectionType.FILE_NOT_FOUND, "File not found"));
            return;
        }

        res.res.writeHead(200, {
            "Transfer-Encoding": "chunked",
            // TODO add mimetype
            "Content-Disposition": `attachment; filename="${ req.query.uid }"`,
            "Content-Length": fs_file_info.size
        });

        const read_stream = fs.createReadStream(fs_file_path);
        read_stream.pipe(res.res);
    } else {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_PARAMETER_REQUIRED, "Either `name` or `uid` query parameter is required"));
        return;
    }
}

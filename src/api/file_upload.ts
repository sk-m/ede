import fs from "fs";
import path from "path";

import * as User from "../user";
import * as Util from "../utils";

import { apiSendError, apiSendSuccess } from "../api";
import { GroupsAndRightsObject } from "../right";
import { Rejection, RejectionType } from "../utils";
import { pipeline } from "stream";
import { v4 as uuid } from "uuid";
import { checkFilenames, registerUploadedFiles, UploadedFile } from "../storage";

// async function sha1(file: any): Promise<string> {
//     return new Promise((resolve: any, reject: any) => {
//         const hash = crypto.createHash("sha1");

//         file.on("error", reject);
//         file.on("data", (chunk: any) => hash.update(chunk));
//         file.on("end", () => resolve(hash.digest("hex")));
//     })
// };

export async function uploadRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    // Check if client has the rights to upload files
    let client_permissions_error = true;
    let client_filesize_limit = 0;

    await User.getRights(client_user.id)
    .then((client_grouprights: GroupsAndRightsObject) => {
        if(client_grouprights.rights.file_upload) {
            client_permissions_error = false;
            client_filesize_limit = parseInt(client_grouprights.rights.file_upload.max_filesize, 10) || 1;
        }
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Only users with 'file_upload' right can upload files"));
        return;
    }

    let parts;
    let error = false;

    // Get the files from the multipart form data
    try {
        parts = await req.files({ limits: { fileSize: client_filesize_limit, fieldSize: client_filesize_limit } });
    } catch(e) {
        apiSendError(res, new Rejection(RejectionType.FILE_TOO_BIG, `One of the files exceeds the filesize limitations (the limit is ${ client_filesize_limit } bytes)`));
        error = true;
    }

    if(error) return;

    // Get the file names
    const final_files_array: UploadedFile[] = [];
    let filenames: string[] = [];

    if(!req.query.filenames) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "`filenames` argument must be passed through URL parameters (/api/file/upload?filenames=1.jpg,2.mp4)"));
        return;
    }

    filenames = req.query.filenames.split(",");

    // Decode the filenames
    // TODO @cleanup
    for(const i in filenames) {
        if(filenames[i]) {
            filenames[i] = decodeURIComponent(filenames[i]);
        }
    }

    const names_check_results = await checkFilenames(filenames);

    if(!names_check_results[0]) {
        apiSendError(res, new Rejection(RejectionType.FILE_NAME_TAKEN, "File name of one or more of selected files is already taken"));
        return;
    }

    // Visit all parts that we have recieved
    for await (const part of parts) {
        // Don't continue if an error occured
        if(error) break;

        if(part.file) {
            // This part is a file

            // Generate a new random id for the file
            const id = uuid();

            // Calculate the hash for the file
            // TODO @placeholder
            // const hash = await sha1(part.file);

            // Get the index of the current file (stored in the fieldname, ex. file_1)
            const file_index_str = part.fieldname.substring(5);
            if(!file_index_str.match(/[0-9]/g)) {
                apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "Incorrect file fields format. Fieldnames should be in the `file_*n*` format (ex. file_6, file_7)"));

                error = true;
                break;
            }

            const file_index = parseInt(file_index_str, 10);

            // Add the file to the list
            final_files_array.push({
                name: filenames[file_index],
                uid: id,
                mime_type: part.mimetype,
                // hash: file.hash
            });

            // Save the file to the filesystem
            await pipeline(part.file, fs.createWriteStream(path.join(__dirname, `../../storage/uploads/${ id }`)), (fs_error: any) => {
                // Some filesystem error
                if(fs_error) {
                    apiSendError(res, new Rejection(RejectionType.GENERAL_OTHER, "Could not save the file to the filesystem"));
                    Util.log("Could not save the file to the filesystem (api/file/upload)", 3, fs_error, { final_files_array });

                    error = true;
                }

                // File is too big
                if(part.file.truncated) {
                    apiSendError(res, new Rejection(RejectionType.FILE_TOO_BIG, `One of the files exceeds the filesize limitations (the limit is ${ client_filesize_limit } bytes)`));

                    error = true;
                }
            })
        }
    }

    if(error) return;

    // TODO delete uploaded files if an error occured

    // Files are on the filesystem, register them in the database
    registerUploadedFiles(final_files_array, client_user)
    .then(() => {
        apiSendSuccess(res, "file/upload");
    })
    .catch((rejection: Rejection) => {
        apiSendError(res, rejection);
    });
}

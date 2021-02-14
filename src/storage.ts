import { sql } from "./server";
import * as User from "./user";
import * as Util from "./utils";

export interface UploadedFile {
    name: string;
    uid: string;
    // hash: string;
    mime_type: string;
}

export interface FileInfo {
    name: string;
    uid: string;
    mime_type: string;
    // hash: string;

    uploaded_by: number;
    uploaded_on: number;
}

/**
 * Get info about a file in the storage
 *
 * @param file_name file name
 */
export async function getFileInfo(file_name: string): Promise<FileInfo> {
    return new Promise((resolve: any, reject: any) => {
        sql.execute("SELECT * FROM `files` WHERE name = ?",
        [file_name || null],
        (error: Error, results: any) => {
            if(error) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not get file info"));
                Util.log(`Could not get file info`, 3, error, { file_name });
            } else if(results.length < 1) {
                reject(new Util.Rejection(Util.RejectionType.FILE_NOT_FOUND, "Requested file was not found"));
            } else {
                resolve(results[0]);
            }
        });
    });
}

/**
 * Register the info about the uploaded files to the database
 *
 * @param files an array of info items about uploaded files
 * @param client user that has uploaded the files
 */
export async function registerUploadedFiles(files: UploadedFile[], client: User.User): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
        const args = [];
        const now = Math.floor(new Date().getTime() / 1000);

        for(const file of files) {
            args.push([
                file.name,
                file.uid,
                file.mime_type,
                // file.hash,
                client.id,
                now
            ])
        }

        sql.query("INSERT INTO `files` (`name`, `uid`, `mime_type`, `uploaded_by`, `uploaded_on`) VALUES ?",
        [args],
        (error: Error) => {
            if(error) {
                reject(new Util.Rejection(Util.RejectionType.GENERAL_UNKNOWN, "Could not register uploaded files"));
                Util.log(`Could not register uploaded files`, 3, error, { files, user_id: client.id });

                return;
            }

            resolve();
        })
    });
}

/**
 * Check if filenames are free
 *
 * @param names array of file names
 *
 * @returns [no_errors, conflicting_names]
 */
export async function checkFilenames(names: string[]): Promise<[boolean, string[]]> {
    return new Promise((resolve: any) => {
        sql.query("SELECT `name` FROM `files` WHERE `name` IN (?)",
        [names],
        (error: Error, results: any) => {
            if(error) {
                resolve(false);
                Util.log(`Error occured while trying to check wether or not some file names are already in use`, 3, error, { names });

                return;
            } else {
                if(results.length === 0) resolve([true, []]);
                else {
                    const conflicting_names = [];

                    for(const row of results) {
                        conflicting_names.push(row.name);
                    }

                    resolve([false, conflicting_names]);
                }
            }
        })
    });
}
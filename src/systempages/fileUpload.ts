import * as User from "../user";
import * as Page from "../page";
import * as Util from "../utils";
import { GroupsAndRightsObject } from "../right";

export async function fileUpload(page: Page.ResponsePage, client: User.User): Promise<Page.SystempageConfig> {
    return new Promise(async (resolve: any) => {
        const page_config: Page.SystempageConfig = {
            page,

            breadcrumbs_data: [ ["File upload", "fas fa-upload", "/System:FileUpload"] ],

            body_html: ""
        }

        // Get the page files
        const page_files = await Page.getPageFiles("System:FileUpload", {
            js: "./static/FileUpload/script.js",
            css: "./static/FileUpload/styles.css",
        });

        page.additional_css = [page_files.css];
        page.additional_js = [page_files.js];

        // Get client's rights
        let client_can_upload = false;
        let client_filesize_limit: number = 0;

        if(client) {
            await User.getRights(client.id)
            .then((client_grouprights: GroupsAndRightsObject) => {
                if(client_grouprights.rights.file_upload) {
                    client_can_upload = true;
                    client_filesize_limit = parseInt(client_grouprights.rights.file_upload.max_filesize, 10) || 1;
                }
            })
            .catch(() => undefined);
        }

        if(!client || !client_can_upload) {
            // No permission to upload files

            page_config.header_config = {
                icon: "fas fa-upload",
                title: "File upload",
                description: `Access denied`
            };

            page_config.body_html = `\
<div class="ui-info-box c-red">
    <div class="icon"><i class="fas fa-times"></i></div>
    <div class="text">You don't have permission to upload files.</div>
</div>`;

            resolve(page_config);
            return;
        }

        page_config.header_config = {
            icon: "fas fa-upload",
            title: "File upload",
            description: `Upload files to EDE`
        };

        page_config.body_html = `\
<div id="systempage-fileupload-root">
    <div class="status-floater" hidden>
        <div class="left">
            <div class="spinner-container">
                <div class="spinner"></div>
            </div>
        </div>
        <div class="right">
            <div class="status-text">Idle</div>
            <div class="loading-container">
                <div class="loading-indicator"></div>
            </div>
        </div>
    </div>

    <form name="fileupload-upload">
        <div class="select-container">
            <button class="select-file-btn" name="select-btn">
                <div class="icon-container"><i class="fas fa-upload"></i></div>
                <div class="text">Select file(s)</div>
            </button>
            <div class="spacer"></div>
            <div class="info">
                <div>Accepted file types: all</div>
                <div>Maximum file size for you: ${ Util.formatFileSize(client_filesize_limit) }</div>
            </div>
        </div>
        <input hidden multiple data-handler="file" type="file" name="file-selector">

        <div class="selected-files-list">
            <div class="header">
                <div>
                    <h1>Selected files</h1>
                    <div class="selected-n">No files selected</div>
                </div>
                <div>
                    <button disabled class="upload-files-btn" name="upload-btn">Upload Files <i class="fas fa-arrow-up"></i></button>
                </div>
            </div>
            <div class="list">
            </div>
        </div>
    </form>
</div>`;

        resolve(page_config);
    });
}

import * as Page from "./page";

import { apiSendError, apiSendSuccess } from "./api";
import { Rejection, RejectionType } from "./utils";
import { pageTitleParser } from "./routes";

function create_html(page_content: string, nonexitent: boolean = false): string {
    return `\
    <div class="editor-main">
        <div class="notices">
            ${ nonexitent ? `\
            <div class="ui-info-box">
                <div class="icon"><i class="fas fa-info"></i></div>
                <div class="text ui-text">You are creating a new page.</div>
            </div>` : "" }
        </div>

        <form name="save-page">
            <textarea name="content" class="ui-input1 monospace editor-textarea">${ page_content }</textarea>

            <div class="ui-form-box no-title margin-top">
                <div class="ui-input-box">
                    <div class="popup"></div>
                    <div class="ui-input-name1">Summary</div>
                    <input type="text" name="summary" data-handler="summary" class="ui-input1">
                </div>

                <div class="ui-form-container between margin-top">
                    <div></div>
                    <div>
                        <button name="submit" class="ui-button1">Save page</button>
                    </div>
                </div>
            </div>
        </form>
    </div>
    `;
}

export async function getEditorRoute(req: any, res: any): Promise<void> {
    if(!req.query.page_title) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "No `page_title` provided"));
        return;
    }

    // Get raw page content
    const page_address = pageTitleParser(req.query.page_title);

    Page.getPageByAddress(page_address)
    .then((page: Page.ResponsePage) => {
        apiSendSuccess(res, "get_editor_html", { html: create_html(page.raw_content || "") });
    }).catch(() => {
        apiSendSuccess(res, "get_editor_html", { html: create_html("", true) });
    });
}
import * as Page from "./page";

import { apiResponse, ApiResponseStatus } from "./api";

export async function getEditorRoute(req: any, res: any): Promise<void> {
    if(!req.query.page_namespace) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "No page namespace provided"));
        return;
    }

    if(!req.query.page_name) {
        res.status(403).send(apiResponse(ApiResponseStatus.invaliddata, "No page name provided"));
        return;
    }

    // Get raw page content
    const page = await Page.getRaw(undefined, req.query.page_namespace, req.query.page_name);

    const html = `\
<div class="editor-main">
    <form name="save-page">
        <textarea name="content" class="ui-input1 monospace editor-textarea">${ page.raw_content || "" }</textarea>

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

    res.send({ status: "success", html })
}
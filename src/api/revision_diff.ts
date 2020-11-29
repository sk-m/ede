import * as User from "../user";
import * as Page from "../page";
import { apiSendError, apiSendSuccess } from "../api";
import { Rejection } from "../utils";

export async function getRevisionsDiffRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    const from_int = parseInt(req.query.revid_from, 10);
    const to_int = parseInt(req.query.revid_to, 10);
    const as_html = req.query.as_html === "true";

    // TODO if client requseted but is not permitted to do so, add a note explaining so
    // TODO client visibility is 0 for now
    Page.getRevisionsDiff(from_int, to_int, 0, as_html)
    .then((diff: any) => {
        apiSendSuccess(res, "revision/diff", { diff });
    })
    .catch((rejection: Rejection) => {
        apiSendError(res, rejection);
    });
}

import * as IncidentsLog from "../incident_log";
import * as User from "../user";
import * as Util from "../utils";
import { apiSendError, apiSendSuccess } from "../api";
import { GroupsAndRightsObject } from "../right";

export async function getIncidentLogsRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user || !client_user.current_session) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "You are not logged in"));
        return;
    }

    let client_permissions_error = true;

    // Check if client has the rights to view incidents log
    await User.getRights(client_user.id)
    .then((client_grouprights: GroupsAndRightsObject) => {
        if(client_grouprights.rights.viewincidentslog) client_permissions_error = false;
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        apiSendError(res, new Util.Rejection(Util.RejectionType.GENERAL_ACCESS_DENIED, "Only users with 'viewincidentslog' right can access the incidents log"));
        return;
    }

    const api_warnings: string[] = [];

    const from = parseInt(req.query.from, 10) || undefined;
    let records_number = parseInt(req.query.records_number, 10) || 100;

    // Check if the client wants to retrieve more then 100 records
    if(records_number > 100) {
        records_number = 100;
        api_warnings.push("The number of records exceeds 100. Resetting to 100.");
    }

    // Get the logs
    IncidentsLog.getAll(false, records_number, from)
    .then((incident_logs: IncidentsLog.IncidentLogEntry[]) => {
        apiSendSuccess(res, "incidentlogs/get", { incident_logs });
    })
    .catch((rejection: Util.Rejection) => {
        apiSendError(res, rejection);
    });
}

import * as User from "../user";
import * as Page from "../page";
import * as IncidentLogs from "../incident_log";
import * as Util from "../utils";
import { GroupsAndRightsObject } from "../right";
import he from "he";

function constructIncidentsList(incidents: IncidentLogs.IncidentLogEntry[], selected_id?: number): string {
    let html = "";

    // If there is a selected incident, we show only it, and no more.
    // Add a button to allow the user to see all the incident logs.
    if(selected_id) {
        html = "<div class=\"show-more-button\" show-all>Only requested incident is shown. Show all?</div>";
    }

    for(const incident of incidents) {
        let full_stacktrace_str = "";

        // Construct a short stacktrace string (Just a first line)
        const stacktrace_str = incident.error_stacktrace
        ? incident.error_stacktrace.split("\n", 2)[0]
        : "(stack trace not available)";

        // Construct a full stacktrace string
        if(incident.error_stacktrace) {
            let all_next_are_internal = false;

            // Split the stacktrace on new lines
            const stacktrace_split = incident.error_stacktrace.split("\n");

            // First line is an error message
            full_stacktrace_str += `<dl>${ stacktrace_split[0] }`;

            // Go through all stack frames and figure out if they should be grayed out (not important)
            for(let i = 1; i < stacktrace_split.length; i++) {
                const stackframe_split = stacktrace_split[i].split(" ");

                // If the last stack frame is not important - all deeper ones are not important too.
                // If a stack frame is from node_modules or an internal script - all deeper ones are from there too, and
                // they don't give us any helpful information.
                if(!all_next_are_internal) {
                    // Get the path of the file
                    const stackframe_path = stackframe_split[stackframe_split.length - 1];

                    // Check if this is an internal/module file
                    all_next_are_internal =
                    stackframe_path.indexOf("(internal/") > -1 ||
                    stackframe_path.indexOf("/node_modules/") > -1;
                }

                // Add a stack frame
                full_stacktrace_str += `<dd${ all_next_are_internal ? " internal" : "" }>${ stacktrace_split[i] }</dd>`;
            }

            full_stacktrace_str += `</dl>`
        }

        html += `\
<div class="incident" incident-id="${ incident.id }"${ selected_id ? " expanded" : "" }>
    <div class="preview-container">
        <div class="left">
            <div class="message">
                <div class="expand-arrow"><i class="fas fa-chevron-down"></i></div>
                <div class="name">${ incident.error_message }</div>
                ${ incident.severity === 2 ? `<div class="bubble warning"><span>W</span></div>` : "" }
                ${ incident.severity === 3 ? `<div class="bubble error"><span>E</span></div>` : "" }
                ${ !incident.was_handled ? `<div class="bubble uncaught"><span>U</span></div>` : "" }
            </div>
            <div class="stacktrace">${ stacktrace_str }</div>
            <div class="info">
                <span class="time"><i class="far fa-clock"></i>${ Util.formatTimeString(incident.timestamp) }</span>
                ${ incident.error_info ? `· <span class="additional-info-notice">Additional info available</span>` : "" }
            </div>
        </div>
        <div class="right">
            <div class="events-count">${ incident.events }</div>
        </div>
    </div>
    <div class="full-container">
        <div class="block">
            <div class="heading">Incident info</div>
            ${ !incident.was_handled ? `<div class="notice">
            <div class="icon"><i class="fas fa-exclamation-triangle"></i></div>
            <div class="text">This error was not handled properly! Please, report this.</div>
            </div>` : "" }
            <div class="info-item"><i class="fas fa-info-circle"></i>Full message: <code>${ incident.error_message }</code></div>
            <div class="info-item"><i class="fas fa-bug"></i>${ incident.events } event(s) reported</div>
            <div class="info-item"><i class="far fa-clock"></i>Last reported at: ${ new Date(incident.timestamp * 1000).toLocaleString() }</div>
        </div>
        <div class="block">
            <div class="heading">Stack trace</div>
            ${ full_stacktrace_str ? `<div class="full-stacktrace">${ full_stacktrace_str }</div>` :
            "<div class=\"na-text\">Stack trace is not available</div>" }
        </div>
        <div class="block">
            <div class="heading">Additional info</div>
            ${ incident.events !== 1 ? `<div class="notice">
            <div class="icon"><i class="fas fa-info"></i></div>
            <div class="text">Such error was reported multiple times. Only the last reported error info is shown.</div>
            </div>` : "" }
            ${ incident.error_info ? `<div class="additional-info">${ he.encode(JSON.stringify(incident.error_info)) }</div>` :
            "<div class=\"na-text\">Additional info is not available</div>" }
        </div>
    </div>
</div>`;
    }

    // We return all the incident logs we got - add the number to load more
    if(!selected_id) {
        html += "<div class=\"show-more-button\">Load more...</div>";
    }

    return html;
}

export async function incidentsLog(page: Page.ResponsePage, client: User.User): Promise<Page.SystempageConfig> {
    return new Promise(async (resolve: any) => {
        const page_config: Page.SystempageConfig = {
            page,

            breadcrumbs_data: [ ["Incidents log", "fas fa-bug", "/System:IncidentsLog"] ],

            body_html: ""
        }

        // Get the files
        const page_files = await Page.getPageFiles("System:IncidentsLog", {
            js: "./static/IncidentsLog/script.js",
            css: "./static/IncidentsLog/styles.css",
        });

        page.additional_css = [page_files.css];
        page.additional_js = [page_files.js];

        // Get client's rights
        let client_can_view = false;

        if(client) {
            await User.getRights(client.id)
            .then((client_grouprights: GroupsAndRightsObject) => {
                if(client_grouprights.rights.viewincidentslog) client_can_view = true;
            })
            .catch(() => undefined);
        }

        if(!client || !client_can_view) {
            // No permission to view the incidents log

            page_config.header_config = {
                icon: "fas fa-bug",
                title: "Incidents log",
                description: `Access denied`
            };

            page_config.body_html = `\
            <div class="ui-info-box c-red">
                <div class="icon"><i class="fas fa-times"></i></div>
                <div class="text">You don't have permission to view the incidents log.</div>
            </div>`;

            resolve(page_config);
            return;
        }

        // Check if user wants to see a particular incident, instead of a full list
        let from: number | undefined;
        let records_num = 50;

        if(page.address.query.incident_id) {
            // User wants to see only one particular incident - retrieve ONLY it

            from = parseInt(page.address.query.incident_id, 10) || undefined;

            // TODO @hack
            if(from) from += 2;

            records_num = 1;
        }

        // Get the incidents
        const incidents = await IncidentLogs.getAll(false, records_num, from);
        const incidents_html = constructIncidentsList(incidents, from);

        page_config.header_config = {
            icon: "fas fa-bug",
            title: "Incidents log",
            description: "All errors and unhandled promise rejections from the EDE backend will be reported on this page"
        };

        page_config.body_html = `\
<div id="systempage-incidentslog-root">
    <div class="incidents-list">
        ${ incidents_html }
    </div>
</div>`;

        resolve(page_config);
    });
}

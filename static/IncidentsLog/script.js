function userBlockingPageScript() {
    // Last log id we encountered
    let last_id;

    // Function to add click event listners to the logs DOM collection
    function update_elements(elements) {
        for(const el of elements) {
            const preview_container = el.getElementsByClassName("preview-container")[0];

            preview_container.addEventListener("click", () => {
                if(el.hasAttribute("expanded")) el.removeAttribute("expanded");
                else el.setAttribute("expanded", "");
            }, false);
        }

        // Save the las id we encountered
        last_id = parseInt(elements[elements.length - 1].getAttribute("incident-id"), 10);
    }

    // Get the elements we need
    const list_el = document.querySelector("#systempage-incidentslog-root > .incidents-list");
    const elements = document.querySelectorAll("#systempage-incidentslog-root > .incidents-list > .incident");
    update_elements(elements);

    // Get the "show more" button
    const show_more_button = document.querySelector("#systempage-incidentslog-root > .incidents-list > .show-more-button");

    if(show_more_button) {
        if(show_more_button.hasAttribute("show-all")) {
            // Show all incidents on click
            show_more_button.addEventListener("click", () => {
                // We just navigate to the IncidentsLog system page to get all incidents
                ede.navigate("/System:IncidentsLog");
            }, false);
        } else {
            // Get more logs on click
            show_more_button.addEventListener("click", () => {
                ede.apiCall("incidentlogs/get", {
                    from: last_id + 1,
                    records_number: 50
                }, false)
                .then(response => {
                    const incident_logs = response["incidentlogs/get"].incident_logs;

                    // Check if any logs were returned
                    if(incident_logs.length === 0) {
                        show_more_button.innerHTML = "That's it.";
                        show_more_button.style.pointerEvents = "none";
                        return;
                    }

                    // Create a DOM fragment for the log elements
                    const logs_fragment = document.createDocumentFragment();

                    for(const incident of incident_logs) {
                        // TODO @placeholder @performance move this to the backend?
                        // Create an incident element

                        let full_stacktrace_str = "";

                        // Construct a short stacktrace string (Just a first line)
                        const short_stacktrace_str = incident.error_stacktrace
                            ? incident.error_stacktrace.split("\n", 1)[0]
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
                                    stackframe_path.startsWith("(internal/") ||
                                    stackframe_path.indexOf("/node_modules/") > -1;
                                }

                                // Add a stack frame
                                full_stacktrace_str += `<dd${ all_next_are_internal ? " internal" : "" }>${ stacktrace_split[i] }</dd>`;
                            }

                            full_stacktrace_str += "</dl>";
                        }

                        // Create the log DOM element
                        const log_el = document.createElement("div");
                        log_el.className = "incident";
                        log_el.setAttribute("incident-id", incident.id);

                        log_el.innerHTML = `\
<div class="preview-container">
    <div class="left">
        <div class="message">
            <div class="expand-arrow"><i class="fas fa-chevron-down"></i></div>
            <div class="name">${ incident.error_message }</div>
            ${ incident.severity === 2 ? "<div class=\"bubble warning\"><span>W</span></div>" : "" }
            ${ incident.severity === 3 ? "<div class=\"bubble error\"><span>E</span></div>" : "" }
            ${ !incident.was_handled ? "<div class=\"bubble uncaught\"><span>U</span></div>" : "" }
        </div>
        <div class="stacktrace">${ short_stacktrace_str }</div>
        <div class="info">
            <span class="time"><i class="far fa-clock"></i>${ ede.tools.formatTimeString(incident.timestamp) }</span>
            ${ incident.error_info ? "· <span class=\"additional-info-notice\">Additional info available</span>" : "" }
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
        ${ incident.error_info ? `<div class="additional-info">${ JSON.stringify(incident.error_info) }</div>` :
        "<div class=\"na-text\">Additional info is not available</div>" }
    </div>
</div>`;

                        // Append the element to the fragment
                        logs_fragment.appendChild(log_el);
                    }

                    // Add click event listners for the new incident logs
                    update_elements(logs_fragment.childNodes);

                    // Append new log items to the document
                    list_el.appendChild(logs_fragment);

                    // Move the "Load more" button to the bottom of the page
                    list_el.appendChild(show_more_button);
                })
                .catch(response => {
                    ede.showAPIErrorNotification("getincidentlogs", response);
                });
            }, false);
        }
    }
}

ede_onready.push(userBlockingPageScript);

userBlockingPageScript;

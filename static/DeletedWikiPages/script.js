function deletedWikiPagesPageScript() {
    // Disable submit on enter key
    window.addEventListener("keydown", e => {
        if(e.keyCode === 13) {
            e.preventDefault();
            return false;
        }
    });

    const revisions_container = document.getElementById("deletedwikipages-revisions-container");
    const revisions_status_text = document.getElementById("deletedwikipages-revisions-status-text");
    const selected_version_text = document.getElementById("deletedwikipages-selectedversion-text");
    const selected_revision_content = document.getElementById("deletedwikipages-revision-content");

    let current_pageid = null;
    let current_revid = null;

    let retrieve_rendered_revisions = false;

    const restore_form = ede.form.list["deletedwikipages-restoreform"];
    const restore_prohibited = restore_form._form.dataset.restoreProhibited === "true";

    // Get rendered revisions checkbox
    const retrieve_rendered_revisions_checkbox = ede.form.list["deletedwikipages-preview"].retrieve_rendered_revisions;

    retrieve_rendered_revisions_checkbox.addEventListener("click", () => {
        if(retrieve_rendered_revisions_checkbox.dataset.checked === "true") {
            retrieve_rendered_revisions = true;
        } else {
            retrieve_rendered_revisions = false;
        }

        // Update the current revision view
        if(current_revid !== null) select_revision(current_revid);
    })

    let selected_version = -1;

    // Revision select function
    function select_revision(revid) {
        current_revid = revid;

        selected_revision_content.innerText = "...";

        ede.apiCall("page/get", {
            revid: revid,
            allow_deleted: true,
            get_raw: !retrieve_rendered_revisions
        })
        .then(revision_response => {
            if(!revision_response.parsed_content && !revision_response.raw_content) {
                // Could not get content
                selected_revision_content.classList.remove("monospace");
                selected_revision_content.innerHTML = "<i>Could not get get the contents of the selected revision. \
Is it hidden?</i>";

                return;
            }

            if(retrieve_rendered_revisions) {
                selected_revision_content.classList.remove("monospace");
                selected_revision_content.innerHTML = revision_response.parsed_content;
            } else {
                selected_revision_content.classList.add("monospace");
                selected_revision_content.innerHTML = revision_response.raw_content;
            }
        })
        .catch(error => {
            ede.showNotification("deletedwikipages-error", "Error", `Unknown error occured (${ error.error })`, "error");
        });
    }

    // Version select function
    function select_version(pageid) {
        revisions_status_text.innerText = "Fetching revisions...";
        selected_version_text.innerHTML = `<code>${ pageid }</code>`

        current_pageid = pageid;

        // Enable restore button
        if(!restore_prohibited) restore_form.submit.classList.remove("disabled");

        // Get revisions for selected page
        ede.apiCall("revision/get", { pageid, include_deleted: true })
        .then(response => {
            // TODO maybe we should have a function that returns an HTML node with revisions instead?
            const revisions_html = ede.tools.constructRevisionsHTML(response.revisions);

            revisions_container.innerHTML = revisions_html;
            revisions_status_text.innerText = "Displaying revisions for the selected version";

            // TODO @performance
            // Add event listners for revision selection
            const checkboxes = revisions_container.querySelectorAll(".ui-checkbox-1");

            for(const checkbox of checkboxes) {
                checkbox.addEventListener("click", () => {
                    const selected_checkbox = revisions_container.querySelector(".ui-checkbox-1[data-checked='true']");

                    // Deal with checkboxes
                    if(selected_checkbox) selected_checkbox.dataset.checked = "false";
                    checkbox.dataset.checked = "true";

                    // Get the revision
                    select_revision(checkbox.dataset.revid);
                });
            }
        })
        .catch(error => {
            ede.showNotification("deletedwikipages-error", "Error", `Unknown error occured (${ error.error })`, "error");
        });
    }

    // Version selector
    const version_select_checkboxes = ede.form.list["deletedwikipages-versionselect"]._form.querySelectorAll(".ui-checkbox-1");

    for(const el of version_select_checkboxes) {
        el.addEventListener("click", () => {
            if(selected_version === el.dataset.pageid) return;

            selected_version = el.dataset.pageid;

            select_version(selected_version);

            for(const uncheck_el of version_select_checkboxes) {
                if(selected_version !== uncheck_el.dataset.pageid) uncheck_el.dataset.checked = "false";
                else uncheck_el.dataset.checked = "true";
            }
        });
    }

    // Restore form save
    restore_form.submit.onclick = e => {
        // Get the final params
        const final_params = ede.form.getParams("deletedwikipages-restoreform")

        // Set the selected version (page id)
        final_params.pageid = current_pageid;

        // Check if summary was given
        if(!final_params.summary) {
            ede.form.showPopup("deletedwikipages-restoreform", "summary", "Please, provide a summary");
            return;
        }

        // Disable the button
        e.target.classList.add("disabled");

        // Restore the page
        ede.apiCall("page/restore", final_params, true)
        .then(() => {
            const target_title = ede.current_page.address.url_params[1];

            ede.navigate(`/System:WikiPageManagement/info/${ target_title }`);

            ede.showNotification("wikipagerestore-success", "Page restored", "Page successfully restored.");
        })
        .catch(response => {
            ede.showNotification("wikipagerestore-error", "Error", `Failed to restore the page (${ response.error || `<code>${ response.status }</code>` }).`, "error");

            // Enable the button
            e.target.classList.remove("disabled");
        });
    };
}

ede_onready.push(deletedWikiPagesPageScript);

deletedWikiPagesPageScript;

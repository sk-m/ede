function userGroupMembershipPageScript() {
    const save_form = ede.form.list["usergroupmembership-save"];

    // Disable submit on enter key
    window.addEventListener("keydown", e => {
        if(e.keyCode === 13) {
            e.preventDefault();
            return false;
        }
    });

    // All nonexistent groups handler
    const nonexistent_groups_checkbox = ede.form.list["usergroupmembership-groups"].all_nonexistent_groups;

    if(nonexistent_groups_checkbox) {
        const nonexistent_groups_els = ede.form.list["usergroupmembership-groups"]._form.querySelectorAll("[data-nonexistent=\"true\"]");

        nonexistent_groups_checkbox.onclick = () => {
            if(nonexistent_groups_checkbox.dataset.checked === "true") {
                for(const el of nonexistent_groups_els) {
                    el.dataset.checked = "true";
                }
            } else {
                for(const el of nonexistent_groups_els) {
                    el.dataset.checked = "false";
                }
            }
        }
    }

    // Groups submit handler
    if(save_form) {
        save_form.submit.onclick = e => {
            const final_params = {
                groups: {}
            };

            const raw_params = ede.form.getParams("usergroupmembership-groups");
            for(const param_name in raw_params) {
                if(param_name.indexOf(";") !== -1) {
                    const param_name_split = param_name.split(";");

                    final_params.groups[param_name_split[1]] = raw_params[param_name];
                } else if(param_name !== "all_nonexistent_groups") {
                    // We skip the all_nonexistent_groups checkbox
                    final_params[param_name] = raw_params[param_name];
                }
            }

            // Take the querried username from the url
            final_params.username = ede.current_page.address.url_params[0].split(":", 2)[1];

            // Get the summary
            final_params.summary = ede.form.list["usergroupmembership-save"].summary.value;

            // Check if summary was given
            if(!final_params.summary) {
                ede.form.showPopup("usergroupmembership-save", "summary", "Please, provide a summary");
                return;
            }

            // Disable the button
            e.target.classList.add("disabled");

            // Update the group
            ede.apiCall("user/updategroups", final_params, true)
            .then(() => {
                // TODO implement quickrefresh (maybe)
                ede.refresh();

                ede.showNotification("usergroupmembership-update-success", "Success", "Successfully updated user's groups.");
            })
            .catch(response => {
                ede.showNotification("usergroupmembership-update-error", "Error", `Failed to update user's groups (${ response.error || `<code>${ response.status }</code>` }).`, "error");

                // Enable the button
                e.target.classList.remove("disabled");
            });
        }
    }
}

ede_onready.push(userGroupMembershipPageScript);

userGroupMembershipPageScript;

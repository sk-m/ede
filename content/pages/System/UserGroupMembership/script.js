function userGroupMembershipPageScript() {
    const save_form = ede.form.list["usergroupmembership-save"];
    const result_status_container = document.getElementById("usergroupmembership-result-status-container");

    // Disable submit on enter key
    window.addEventListener("keydown", e => {
        if(e.keyCode === 13) {
            e.preventDefault();
            return false;
        }
    });

    const query_form = ede.form.list["usergroupmembership-query"];

    // Check if query form is available
    if(query_form) {
        // Query submit handler
        query_form.submit.onclick = () => {
            const validation_result = ede.form.validate("usergroupmembership-query");

            if(!validation_result.invalid) {
                ede.navigate("/System:UserGroupMembership/" + ede.form.list["usergroupmembership-query"].username.value);
            }
        };
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
                } else {
                    final_params[param_name] = raw_params[param_name];
                }
            }

            // Take the querried username from the url
            final_params.username = location.pathname.split("/")[2];

            // Get the summary
            final_params.summary = ede.form.list["usergroupmembership-save"].summary.value;

            // Disable the button
            e.target.classList.add("disabled");

            // Update the group
            ede.apiCall("user/updategroups", final_params, true)
            .then(() => {
                result_status_container.querySelector(".ui-text").innerHTML = `\
    <div class="ui-text b">Success</div>
    <div class="ui-text small i">User's groups updated successfully</div>`;

                result_status_container.classList.add("green");
                result_status_container.classList.remove("red");

                result_status_container.classList.remove("hidden");
            })
            .catch(response => {
                result_status_container.querySelector(".ui-text").innerHTML = `\
    <div class="ui-text b">Failed to update user's groups <code>(${ response.status })</code></div>
    <div class="ui-text small i">${ response.error }</div>`;

                result_status_container.classList.add("red");
                result_status_container.classList.remove("hidden");

                // Enable the button
                e.target.classList.remove("disabled");
            });
        }
    }
}

ede_onready.push(userGroupMembershipPageScript);

userGroupMembershipPageScript;

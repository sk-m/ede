function userGroupManagementPageScript() {
    // Handler for right elements
    const right_el_click_handler = el => {
        if(el.className.includes("open")) {
            el.classList.remove("open");
        } else {
            el.classList.add("open");
        }
    }

    // All right elements that take arguments
    const right_els = document.querySelectorAll(".user-group-management-rights-root .rights-container > .right.w-arguments");

    for(const right_el of right_els) {
        right_el.onclick = () => {
            right_el_click_handler(right_el)
        };

        right_el.querySelector(".arguments-container").addEventListener("click", e => {
            e.stopImmediatePropagation();
        }, false);
    }

    const this_form = ede.form.list.usergroupmanagement;

    // Result text container
    const result_status_container = this_form._form.querySelector(".result-status-container");

    // Check if submit button is available (client can alter groups)
    if(!this_form.submit) return;

    // On save
    this_form.submit.onclick = e => {
        // Validate the form
        const form_validation = ede.form.validate("usergroupmanagement");
        if(form_validation.invalid) return;

        // Create arguments object that will be sent to the backend
        const params_raw = ede.form.getParams("usergroupmanagement");

        const params_final = {
            rights: {},
            right_arguments: {}
        };

        // Correctly format the params object
        for(const param_name in params_raw) {
            const param_value = params_raw[param_name];

            if(param_name.indexOf(";") !== -1) {
                const param_name_split = param_name.split(";");
                const right_name = param_name_split[1];

                switch(param_name_split[0]) {
                    case "right": {
                        // Right checkbox
                        params_final.rights[right_name] = param_value;
                    } break;
                    case "right_argument": {
                        // Right argument

                        // Create the arguments object for the right if nonexistent
                        if(!params_final.right_arguments[right_name]) {
                            params_final.right_arguments[right_name] = {};
                        }

                        params_final.right_arguments[right_name][param_name_split[2]] = param_value;
                    } break;
                }
            } else {
                // Just a regular input (like group_name)
                params_final[param_name] = params_raw[param_name];
            }
        }

        // Take the current group name from the url
        params_final.group_name = location.pathname.split("/")[2];

        // Disable the button
        e.target.classList.add("disabled");

        // Update the group
        ede.apiCall("usergroup/update", params_final, true)
        .then(() => {
            result_status_container.querySelector(".ui-text").innerHTML = `\
<div class="ui-text b">Success</div>
<div class="ui-text small i">Group saved successfully</div>`;

            result_status_container.classList.add("green");
            result_status_container.classList.remove("red");

            result_status_container.classList.remove("hidden");
        })
        .catch(response => {
            result_status_container.querySelector(".ui-text").innerHTML = `\
<div class="ui-text b">Failed to save the group <code>(${ response.status })</code></div>
<div class="ui-text small i">${ response.error }</div>`;

            result_status_container.classList.add("red");
            result_status_container.classList.remove("hidden");

            // Enable the button
            e.target.classList.remove("disabled");
        });
    };
}

ede_onready.push(userGroupManagementPageScript);

userGroupManagementPageScript;

function userGroupManagementPageScript() {
    // Disable submit on enter key
    window.addEventListener("keydown", e => {
        if(e.keyCode === 13) {
            e.preventDefault();
            return false;
        }
    });

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

    const query_form = ede.form.list["usergroupmanagement-query"];

    // Check if query form is available
    if(query_form) {
        // On query
        query_form.submit.onclick = () => {
            const validation_result = ede.form.validate("usergroupmanagement-query");

            if(!validation_result.invalid) {
                ede.navigate("/System:UserGroupManagement/" + query_form.group_name.value);
            }
        }
    }

    const create_form = ede.form.list["usergroupmanagement-create"];

    // Check if create form is available
    if(create_form) {
        create_form.submit.onclick = () => {
            const form_validation = ede.form.validate("usergroupmanagement-create");

            if(!form_validation.invalid) {
                // Create a new group
                ede.apiCall("usergroup/create", {
                    new_group_name: create_form.new_group_name.value
                }, true)
                .then(() => {
                    ede.navigate("/System:UserGroupManagement/" + create_form.new_group_name.value);
                })
                .catch(error => {
                    // TODO show error
                    console.log(error);
                });
            }
        }
    }

    // Check if the main form is available
    const main_form = ede.form.list.usergroupmanagement;

    if(!main_form || !main_form.submit) return;

    // Get group's state before changes
    const before_params_raw = ede.form.getParams("usergroupmanagement");

    // Result text container
    const result_status_container = main_form._form.querySelector(".result-status-container");

    // On save
    main_form.submit.onclick = e => {
        // Validate the form
        const form_validation = ede.form.validate("usergroupmanagement");
        if(form_validation.invalid) return;

        // Create arguments object that will be sent to the backend
        const params_raw = ede.form.getParams("usergroupmanagement");

        const params_final = {
            rights: {},
            right_arguments: {},
            summary: params_raw.summary
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

        // Function that will save the group
        const save_function = function() {
            // Close the save popup
            ede.closePopup();

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

        let review_changes_html_rights = "";
        let review_changes_html_arguments = "";

        let no_changes_made = true;

        // Check the changes the user made
        for(const param_name in params_raw) {
            // Check if this param was changed
            if(params_raw[param_name] !== before_params_raw[param_name]) {
                const param_split = param_name.split(";");
                const param_type = param_split[0];

                // A right was assigned or removed
                if(param_type === "right") {
                    no_changes_made = false;

                    const changed_right_name = param_split[1];

                    if(before_params_raw[param_name] === false) {
                        // The right was assigned
                        review_changes_html_rights += `<li><div class="right assigned">Assigned <code>${ changed_right_name }</code></div></li>`;
                    } else {
                        // The right was removed
                        review_changes_html_rights += `<li><div class="right removed">Removed <code>${ changed_right_name }</code></div></li>`;
                    }
                }
                // An argument was changed
                else if(param_type === "right_argument") {
                    const before_string = before_params_raw[param_name].toString();
                    const after_string = params_raw[param_name].toString();

                    // TODO @performance
                    if(before_string !== after_string) {
                        no_changes_made = false;

                        const changed_argument_right_name = param_split[1];
                        const changed_argument_name = param_split[2];

                        review_changes_html_arguments += `\
<li>
    <div class="argument-name">${ changed_argument_right_name }.${ changed_argument_name }</div>
    <div class="argument-change">changed from <code>${ before_string || "(none)" }</code> to <code>${ after_string || "(none)" }</code></div>
</li>`;

                    }
                }
            }
        }

        const review_changes_html = `\
<div class="ui-text margin-bottom">Please, review your changes before saving.</div>
<div class="section">Group name</div>
<ul><code>${ params_final.group_name }</code></ul>
<div class="section">Rights</div>
<ul>${ review_changes_html_rights || "<i>(no changes)</i>" }</ul>
<div class="section">Right arguments</div>
<ul>${ review_changes_html_arguments || "<i>(no changes)</i>" }</ul>
<div class="section">Summary</div>
<ul>${ params_raw.summary || "<i>(no summary)</i>" }</ul>
<div class="warnings">\
${ no_changes_made ? "<div><i class=\"fas fa-info-circle\"></i> No changes were made, nothing to save.</div>" : "" }\
${ !params_raw.summary ? "<div><i class=\"fas fa-info-circle\"></i> Please, provide a summary to save the group.</div>" : "" }\
</div>`;

        const popup_buttons_html = `\
<div class="left">
    <button name="close" class="ui-button1 t-frameless w-500">BACK</button>
</div>
<div class="right">
    <button name="save" class="${ (no_changes_made || !params_raw.summary) ? "disabled " : "" }ui-button1 t-frameless c-blue w-500">CONFIRM & SAVE</button>
</div>`;

        ede.showPopup("usergroupmanagement-save", "Confirm save", review_changes_html, popup_buttons_html, {
            close: ede.closePopup,
            save: save_function
        }, 600);
    };
}

ede_onready.push(userGroupManagementPageScript);

userGroupManagementPageScript;

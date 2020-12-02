function SystemMessagesPageScript() {
    // Function for deleting system messages
    const delete_func = (e, name, el) => {
        e.target.classList.add("loading");

        // Delete the system message
        ede.apiCall("systemmessage/delete", { name: name }, true)
        .then(() => {
            el.remove();
            ede.closePopup();

            ede.showNotification("systemmessages-delete-success", "Success", "Successfully deleted a system message.");
        })
        .catch(response => {
            e.target.classList.remove("loading");

            ede.showAPIErrorNotification("systemmessages-delete", response);
        });
    };

    // Get the DOM elements for quick query
    const sysmsgs_list_el = document.getElementById("systempage-systemmessages-list");
    const header_description_el = document.getElementById("systempage-header-description");

    // Function for updating all the system message elements and assigning event listners to them
    const update_items = function() {
        const delete_popup_buttons_html = `\
        <div class="left">
            <button name="close" class="ui-button1 t-frameless w-500">BACK</button>
        </div>
        <div class="right">
            <button name="delete" class="ui-button1 t-frameless c-red w-500">DELETE</button>
        </div>`;

        // Event handlers for systemmessage items
        const systemmessage_els = sysmsgs_list_el.getElementsByClassName("systemmessage");

        // TODO @performance
        for(const item_el of systemmessage_els) {
            const current_value_container_el = item_el.querySelector(".current-value-container");

            // Don't create event listners if the user can't edit the messages
            if(!current_value_container_el.className.includes("disabled")) {
                const edit_form_el = item_el.querySelector(".edit-form");

                // Current value click
                current_value_container_el.onclick = () => {
                    current_value_container_el.classList.add("hidden");

                    edit_form_el.classList.remove("hidden");
                    edit_form_el.querySelector(".save-btn").classList.remove("disabled");
                }

                // Back click
                item_el.querySelector(".edit-form .close-btn").onclick = () => {
                    current_value_container_el.classList.remove("hidden");
                    edit_form_el.classList.add("hidden");
                }

                // Save click
                item_el.querySelector(".edit-form .save-btn").onclick = e => {
                    const systemmessage_name = item_el.dataset.systemmessageName;
                    const new_value = item_el.getElementsByTagName("textarea")[0].value;

                    // Disable the button
                    e.target.classList.add("disabled");

                    // Update the system message
                    ede.apiCall("systemmessage/set", { name: systemmessage_name, value: new_value }, true)
                    .then(() => {
                        current_value_container_el.classList.remove("hidden");
                        edit_form_el.classList.add("hidden");

                        item_el.querySelector(".current-value-container > .text").innerText = new_value;

                        ede.showNotification("systemmessages-set-success", "Success", "Successfully updated a system message.");
                    })
                    .catch(response => {
                        ede.showAPIErrorNotification("systemmessages-create", response);
                    });
                }

                // Delete click
                const delete_btn = item_el.querySelector(".top > .buttons-container > .delete-btn");

                if(delete_btn) {
                    delete_btn.onclick = () => {
                        const systemmessage_name = item_el.dataset.systemmessageName;

                        ede.showPopup("systemmessage-delete", "Are you sure?", `Are you sure you want to delete the <code>${ systemmessage_name }</code> system message?`, delete_popup_buttons_html, {
                            close: ede.closePopup,
                            delete: e => { delete_func(e, systemmessage_name, item_el) }
                        }, 460);
                    }
                }
            }
        }
    }

    // Function for quickly querying system messages without reloading the page in any way
    const get_sysmsgs = function() {
        const query_name = ede.form.list["systemmessages-query"].message_name.value;

        // Get the records
        ede.apiCall("systemmessage/get", {
            name: query_name,
            g_anonymous: true,
            encode_values: true
        })
        .then(response => {
            const sysmsgs = response["systemmessage/get"].system_messages;
            const client_can_modify = ede.current_page.additional_info.client_can_modify_sysmsgs;
            let sysmsgs_returned = false;

            // Clear the list
            sysmsgs_list_el.innerHTML = "";
            let html = "";

            // Construct the new list
            for(const name in sysmsgs) {
                const msg = sysmsgs[name];
                sysmsgs_returned = true;

                html += `\
<div class="systemmessage" data-systemmessage-name="${ msg.name }">
<div class="top">
<div class="name-container">
<div class="text">${ msg.name }</div>
</div>
<div class="buttons-container">
    ${ (client_can_modify && msg.is_deletable) ? "<button class=\"ui-button1 t-frameless c-red s-small delete-btn\"><i class=\"fas fa-trash\"></i> Delete</button>" : "" }
</div>
</div>
<div class="middle">
<div class="current-value-container${ !client_can_modify ? " disabled" : "" }" title="Click to edit">
    <div class="text">${ msg.value }</div>
</div>
<div class="edit-form hidden">
    <textarea class="ui-input1 monospace">${ msg.value }</textarea>
    <div class="ui-form-container between margin-top">
        <button class="ui-button1 t-frameless close-btn">Close</button>
        <button class="ui-button1 t-frameless c-blue save-btn"><i class="fas fa-check"></i> Save</button>
    </div>
</div>
</div>
</div>`;
            }

            if(!sysmsgs_returned) {
                html = "<div class=\"no-sysmsgs-notice\">No system messages found</div>";
            }

            // Update the DOM
            sysmsgs_list_el.innerHTML = html;
            header_description_el.innerText = `Displaying messages starting with '${ query_name }'`;

            // Update the breadcrumbs
            ede.tools.systempage.setBreadcrumb(2, query_name);

            // Update items
            update_items();

            // Update the url
            const new_url = "/System:SystemMessages/" + query_name;
            history.pushState({ new_url }, undefined, new_url);
        })
        .catch(response => {
            ede.showAPIErrorNotification("systemmessages-get", response);
        });
    }

    /* ----- Page script start ----- */

    // Disable submit on enter key
    window.addEventListener("keydown", e => {
        if(e.keyCode === 13) {
            e.preventDefault();
            return false;
        }
    });

    const query_form = ede.form.list["systemmessages-query"];
    const create_form = document.getElementById("systempage-systemmessages-create-form");

    // Check if query form is available
    if(query_form) {
        // On query
        query_form.submit.onclick = () => {
            // Make a quick query using a page action
            const validation_result = ede.form.validate("systemmessages-query");

            if(!validation_result.invalid) {
                get_sysmsgs();
            }
        }

        // On create
        query_form.create.onclick = () => {
            const validation_result = ede.form.validate("systemmessages-query");

            if(!validation_result.invalid) {
                create_form.classList.remove("hidden");
                create_form.dataset.systemmessageName = query_form.message_name.value;
                create_form.querySelector(".name-container > .text").innerText = query_form.message_name.value;
            }
        }
    }

    // Create form close
    create_form.querySelector(".edit-form .close-btn").onclick = () => {
        create_form.classList.add("hidden");
    }

    // Create form create
    create_form.querySelector(".edit-form .create-btn").onclick = e => {
        const systemmessage_name = create_form.dataset.systemmessageName;
        const new_value = create_form.getElementsByTagName("textarea")[0].value;

        // Disable the button
        e.target.classList.add("loading");

        // Create a system message
        ede.apiCall("systemmessage/create", { name: systemmessage_name, value: new_value }, true)
        .then(() => {
            ede.refresh();

            ede.showNotification("systemmessages-create-success", "Success", "Successfully created a new system message.");
        })
        .catch(response => {
            e.target.classList.remove("loading");
            ede.showAPIErrorNotification("systemmessages-create", response);
        });
    }

    update_items();
}

ede_onready.push(SystemMessagesPageScript);

SystemMessagesPageScript;

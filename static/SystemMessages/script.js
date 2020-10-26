function SystemMessagesPageScript() {
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
            const validation_result = ede.form.validate("systemmessages-query");

            if(!validation_result.invalid) {
                ede.navigate("/System:SystemMessages/" + query_form.message_name.value);
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

            ede.showNotification("systemmessages-create-error", "Error", `Failed to create a new system message (${ response.error || `<code>${ response.status }</code>` }).`, "error");
        });
    }

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

            ede.showNotification("systemmessages-delete-error", "Error", `Failed to delete a system message (${ response.error || `<code>${ response.status }</code>` }).`, "error");
        });
    };

    const delete_popup_buttons_html = `\
    <div class="left">
        <button name="close" class="ui-button1 t-frameless w-500">BACK</button>
    </div>
    <div class="right">
        <button name="delete" class="ui-button1 t-frameless c-red w-500">DELETE</button>
    </div>`;

    // Event handlers for systemmessage items
    const systemmessage_els = document.querySelectorAll("#systempage-systemmessages-list > .systemmessage");

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
                    ede.showNotification("systemmessages-set-error", "Error", `Failed to update a system message (${ response.error || `<code>${ response.status }</code>` }).`, "error");
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

ede_onready.push(SystemMessagesPageScript);

SystemMessagesPageScript;

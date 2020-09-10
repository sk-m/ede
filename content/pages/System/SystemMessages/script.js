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
        e.target.classList.add("disabled");

        // Create a system message
        ede.apiCall("systemmessage/create", { name: systemmessage_name, value: new_value }, true)
        .then(() => {
            ede.refresh();
        })
        .catch(response => {
            // TODO error
            console.log(response)
        });
    }

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
                })
                .catch(response => {
                    // TODO error
                    console.log(response)
                });
            }

            // Delete click
            const delete_btn = item_el.querySelector(".top > .buttons-container > .delete-btn");

            if(delete_btn) {
                delete_btn.onclick = e => {
                    const systemmessage_name = item_el.dataset.systemmessageName;

                    // TODO @ui make something prettier than confirm()
                    if(confirm(`Are you sure you want to delete ${ systemmessage_name }?`)) {
                        // Disable the button
                        e.target.classList.add("disabled");

                        // Delete the system message
                        ede.apiCall("systemmessage/delete", { name: systemmessage_name }, true)
                        .then(() => {
                            item_el.remove();
                        })
                        .catch(response => {
                            // TODO error
                            console.log(response)
                        });
                    }
                }
            }
        }
    }
}

ede_onready.push(SystemMessagesPageScript);

SystemMessagesPageScript;

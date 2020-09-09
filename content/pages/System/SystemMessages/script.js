function SystemMessagesPageScript() {
    // Disable submit on enter key
    // window.addEventListener("keydown", e => {
    //     if(e.keyCode === 13) {
    //         e.preventDefault();
    //         return false;
    //     }
    // });

    const query_form = ede.form.list["systemmessages-query"];

    // Check if query form is available
    if(query_form) {
        // On query
        query_form.submit.onclick = () => {
            const validation_result = ede.form.validate("systemmessages-query");

            if(!validation_result.invalid) {
                ede.navigate("/System:SystemMessages/" + query_form.message_name.value);
            }
        }
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

                    item_el.querySelector(".current-value-container > .text").innerHTML = new_value;
                })
                .catch(response => {
                    // TODO error
                    console.log(response)
                });
            }
        }
    }
}

ede_onready.push(SystemMessagesPageScript);

SystemMessagesPageScript;

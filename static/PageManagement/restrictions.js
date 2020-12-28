function wikipageRestrictionsPageScript() {
    const restrictions_form = ede.form.list["pagerestrictions-form"];

    // Check if the form is available
    if(!restrictions_form) return;

    // Get the restriction elements
    const restrictions_list = restrictions_form._form.querySelectorAll(".restrictions-container > .restriction-item");

    // Add event listeners
    for(const restriction_el of restrictions_list) {
        const checkbox_el = restriction_el.getElementsByClassName("checkbox")[0];
        const status_text_el = restriction_el.getElementsByClassName("status")[0];

        restriction_el.addEventListener("click", () => {
            if(restriction_el.hasAttribute("enabled")) {
                restriction_el.removeAttribute("enabled");
                status_text_el.innerHTML = "non-restricted";
                checkbox_el.dataset.checked = false;
            } else {
                restriction_el.setAttribute("enabled", "");
                status_text_el.innerHTML = "<i class=\"fas fa-ban\"></i> restricted";
                checkbox_el.dataset.checked = true;
            }
        });
    }

    // On submit
    restrictions_form.submit.onclick = e => {
        // Get the params
        const final_params = ede.form.getParams("pagerestrictions-form");

        // Check if the summary was given
        if(!final_params.summary) {
            ede.form.showPopup("pagerestrictions-form", "summary", "Please, provide a summary");
            return;
        }

        // Check if restrict_to is filled
        if(!final_params.restrict_to) {
            ede.form.showPopup("pagerestrictions-form", "restrict_to", "Please, enter a grant right name");
            return;
        }

        // Create the restrictions object
        const restricted_actions = {};

        for(const param_name in final_params) {
            if(param_name.startsWith("restriction;")) {
                restricted_actions[param_name.substring(12)] = final_params[param_name];
            }
        }

        // Disable the button
        e.target.classList.add("disabled");

        // Update the action restrictions
        ede.apiCall("action_restrictions/update", {
            object_type: "page@id",
            target_object: ede.current_page.additional_info.page_id,
            restricted_actions,
            restrict_to: final_params.restrict_to,

            summary: final_params.summary
        }, true)
        .then(() => {
            ede.refresh();

            ede.showNotification("updateactionrestrictions-success", "Success", "Action restrictions updated successfully.");
        })
        .catch(response => {
            ede.showAPIErrorNotification("updateactionrestrictions", response);

            // Enable the button
            e.target.classList.remove("disabled");
        });
    }
}

ede_onready.push(wikipageRestrictionsPageScript);

wikipageRestrictionsPageScript;

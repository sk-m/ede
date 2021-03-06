function userBlockingPageScript() {
    const block_form = ede.form.list["blockuser-form"];

    // Confirm checkbox
    block_form.confirm_checkbox.addEventListener("click", () => {
        if(block_form.confirm_checkbox.dataset.checked === "true") {
            block_form.submit.classList.remove("disabled");
        } else {
            block_form.submit.classList.add("disabled");
        }
    })

    // Show lockout confirm checkbox when the restriction is enabled
    const lockout_restriction_el = ede.form.list["blockuser-form"]["restriction;lockout"];
    const lockout_confirm_el = ede.form.list["blockuser-form"].confirm_lockout_checkbox;

    lockout_restriction_el.addEventListener("click", () => {
        if(lockout_restriction_el.dataset.checked === "true") {
            lockout_confirm_el.style.visibility = "visible";
        } else {
            lockout_confirm_el.style.visibility = "hidden";
            lockout_confirm_el.dataset.checked = "false";
        }
    });

    // Check if lockout is enabled, when the page is loaded
    if(lockout_restriction_el.dataset.checked === "true") {
        lockout_confirm_el.style.visibility = "visible";
    }

    block_form.submit.onclick = e => {
        const final_params = {
            restrictions: ""
        };

        // Get restrictions
        const raw_params = ede.form.getParams("blockuser-form");
        for(const param_name in raw_params) {
            if(param_name.indexOf(";") !== -1) {
                if(raw_params[param_name] === true) {
                    final_params.restrictions += param_name.split(";")[1] + ";";
                }
            } else {
                final_params[param_name] = raw_params[param_name];
            }
        }

        // Recheck the confirm checkbox
        if(!final_params.confirm_checkbox) return;

        // Check if lockout confirmation is checked
        if(final_params.restrictions.includes("lockout") && !final_params.confirm_lockout_checkbox) return;

        // Check if summary was given
        if(!final_params.summary) {
            ede.form.showPopup("blockuser-form", "summary", "Please, provide a summary");
            return;
        }

        // Take the querried username from the url
        final_params.username = ede.current_page.address.url_params[0].split(":", 2)[1];

        // Disable the button
        e.target.classList.add("loading");

        // Block the user
        ede.apiCall("user/block", final_params, true)
        .then(() => {
            // TODO implement quickrefresh (maybe)
            ede.refresh();

            ede.showNotification("userblock-success", "Success", "User blocked successfully.");
        })
        .catch(response => {
            ede.showAPIErrorNotification("userblock", response);

            // Enable the button
            e.target.classList.remove("loading");
        });
    }
}

ede_onready.push(userBlockingPageScript);

userBlockingPageScript;

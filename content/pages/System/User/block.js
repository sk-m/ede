function userBlockingPageScript() {
    const block_form = ede.form.list["blockuser-form"];
    const result_status_container = document.getElementById("blockuser-result-status-container");

    // Disable submit on enter key
    window.addEventListener("keydown", e => {
        if(e.keyCode === 13) {
            e.preventDefault();
            return false;
        }
    });

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
        e.target.classList.add("disabled");

        // Block the user
        ede.apiCall("user/block", final_params, true)
        .then(() => {
            result_status_container.querySelector(".ui-text").innerHTML = `\
<div class="ui-text b">Success</div>
<div class="ui-text small i">User blocked updated successfully</div>`;

            result_status_container.classList.add("green");
            result_status_container.classList.remove("red");

            result_status_container.classList.remove("hidden");
        })
        .catch(response => {
            result_status_container.querySelector(".ui-text").innerHTML = `\
<div class="ui-text b">Failed to block user <code>(${ response.status })</code></div>
<div class="ui-text small i">${ response.error }</div>`;

            result_status_container.classList.add("red");
            result_status_container.classList.remove("hidden");

            // Enable the button
            e.target.classList.remove("disabled");
        });
    }
}

ede_onready.push(userBlockingPageScript);

userBlockingPageScript;

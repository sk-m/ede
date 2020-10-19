// System:UserSettings page script

function userSettingsPageScript() {
    // Action functions
    const action_update_password = () => {
        // We need an elevated session to update user's password
        ede.createElevatedSession(() => {
            const update_password = () => {
                // Validate the form
                const validation_result = ede.form.validate("user-updatepassword");
                if(validation_result.invalid) return;

                // Get the new passwords
                const new_password = ede.form.list["user-updatepassword"].new_password.value;
                const new_password_repeat = ede.form.list["user-updatepassword"].new_password_repeat.value;

                if(new_password !== new_password_repeat) {
                    ede.showNotification("user-updatepassword-error", "Error", "Passwords do not match.", "error");
                    return;
                }

                // Update the password
                ede.apiCall("user/update_password", { new_password }, true)
                .then(() => {
                    ede.closePopup();
                    ede.refresh();

                    ede.showNotification("user-updatepassword-success", "Success", "Password successfully changed.");
                })
                .catch(error => {
                    ede.showNotification("user-updatepassword-error", "Error", error.error || "Could not change the password.", "error");
                })
            };

            const popup_buttons_html = `\
<div class="left">
    <button name="close" class="ui-button1 t-frameless w-500">CLOSE</button>
</div>
<div class="right">
    <button name="change" class="ui-button1 t-frameless c-blue w-500">CHANGE</button>
</div>`;

            const popup_body_html = `\
<form class="ui-form-container" name="user-updatepassword">
    <div input-container class="ui-input-box" style="margin: 8px 0">
        <div class="ui-input-box">
            <div class="popup"></div>
            <div class="ui-input-name1">New password</div>
            <input type="password" name="new_password" data-handler="password" class="ui-input1">
        </div>
        <div class="ui-input-box" style="margin-top: 15px">
            <div class="popup"></div>
            <div class="ui-input-name1">Repeat new password</div>
            <input type="password" name="new_password_repeat" data-handler="password" class="ui-input1">
        </div>
    </div>
</div>`;

            ede.showPopup("user-updatepassword", "Change password", popup_body_html, popup_buttons_html, {
                close: ede.closePopup,
                change: update_password
            }, 460);

            // TODO! @performance @hack see todo file
            ede.updateForms();
        });
    };

    const actions_map = {
        update_password: action_update_password
    };

    const category_link_els = document.querySelectorAll("#systempage-usersettings-root > .categories-container > .item");
    const category_container_els = document.querySelectorAll("#systempage-usersettings-root > .settings-root > .settings-category");

    // Click handlers for category links on the top
    for(const link_el of category_link_els) {
        link_el.onclick = () => {
            // TODO @performance this for loop can be replaced with a querySelector
            // Show the selected container
            for(const container_el of category_container_els) {
                if(container_el.dataset.category !== link_el.dataset.category) {
                    container_el.removeAttribute("shown")
                } else {
                    container_el.setAttribute("shown", "")
                }
            }

            // Wirite the name of the newly seleted category to the URL
            history.pushState({}, "", `/System:UserSettings/${ link_el.dataset.category }`);
        }
    }

    // Action buttons
    // TODO @performance
    const action_buttons = document.querySelectorAll("#systempage-usersettings-root button");
    for(const button_el of action_buttons) {
        const func = actions_map[button_el.dataset.action];

        if(typeof func === "function") {
            button_el.onclick = func;
        }
    }
}

ede_onready.push(userSettingsPageScript);

userSettingsPageScript;

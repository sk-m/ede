// System:UserSettings page script

function userSettingsPageScript() {
    // Action functions

    const action_f2a_disable = () => {
        // We need an elevated session to disable f2a
        ede.createElevatedSession(() => {
            // Function to disable 2fa
            const disable = () => {
                ede.apiCall("user/disable_f2a", {}, true)
                .then(() => {
                    ede.showNotification("user-disablef2a-success", "Success", "Successfully turned off two-factor authentication.");
                    ede.closePopup();

                    ede.refresh();
                })
                .catch(error => {
                    ede.showNotification("user-disablef2a-error", "Error", error.error || "Could not turn off two-factor authentication.", "error");
                });
            };

            // Set up the popup
            const popup_buttons_html = `\
            <div class="left">
                <button name="close" class="ui-button1 t-frameless w-500">CLOSE</button>
            </div>
            <div class="right">
                <button name="next" class="ui-button1 t-frameless c-red w-500">TURN OFF</button>
            </div>`;

            const popup_body_html = `\
<div class="popup-step" data-stepid="1" shown style="height: 200px">
    <img class="popup-header-icon" src="/public/assets/2fa-icon.svg" width="25%" style="display: block; margin: 20px auto 45px auto"></img>

    <p>You are about to turn off two-factor authentication. All your backup codes will also be invalidated and will not work for this account. Are you sure you want to do that?</p>
</div>
<div class="popup-step" data-stepid="2">
    <p>Two-factor authentication was successfully disabled.</p>
</div>`;

            ede.showPopup("user-disablef2a", "Turn off Two-factor authentication", popup_body_html, popup_buttons_html, {
                close: ede.closePopup,
                next: disable
            }, 460);
        });
    };

    const action_f2a_setup = () => {
        let current_step = 0;

        // We need an elevated session to set up (enable) 2fa
        ede.createElevatedSession(() => {
            const next_click = (e, show_next_step, refresh_popup_pos) => {
                if(current_step === 0) {
                    // Step 0 -> 1. Start the setup, get the qr code
                    e.target.classList.add("loading");

                    ede.apiCall("user/start_f2a_setup", {}, true)
                    .then(response => {
                        // Display the qr code
                        current_step = show_next_step();

                        document.getElementById("2fasetup-qrcode").src = response.qr_code;

                        e.target.classList.remove("loading");

                        refresh_popup_pos();
                        ede.updateForms(popup_el);
                    })
                    .catch(error => {
                        e.target.classList.remove("loading");

                        ede.showNotification("user-f2asetup-error", "Error", error.error || "Could not start the 2FA setup.", "error");
                    });
                } else if(current_step === 2) {
                    // Step 1 -> 2. Finish the setup, get the backup codes

                    // Validate the form
                    const validation_result = ede.form.validate("user-f2asetup");
                    if(validation_result.invalid) return;

                    e.target.classList.add("loading");

                    ede.apiCall("user/finish_f2a_setup", {
                        otp: ede.form.list["user-f2asetup"].otp.value
                    }, true)
                    .then(response => {
                        // Successfully set up 2fa, format backup codes
                        const codes_container_el = document.getElementById("f2asetup-recoverycodes");

                        e.target.classList.remove("loading");

                        for(const code in response.backup_codes) {
                            codes_container_el.innerHTML += `<div>${ code }</div>`;
                        }

                        current_step = show_next_step();
                        ede.showNotification("user-f2asetup-success", "Success", "Two-factor authentication successfully enabled.");
                    })
                    .catch(error => {
                        e.target.classList.remove("loading");

                        ede.showNotification("user-f2asetup-error", "Error", error.error || "Could not finish the 2FA setup.", "error");
                    });
                } else if(current_step === 3) {
                    // Step 2 -> 3. Everything is done, just close the popup and refresh the settings page
                    ede.closePopup();
                    ede.refresh();
                }
            };

            // Set up the f2a setup popup
            const popup_buttons_html = `\
            <div class="left">
                <button name="close" class="ui-button1 t-frameless w-500">CLOSE</button>
            </div>
            <div class="right">
                <button name="next" class="ui-button1 t-frameless c-blue w-500">NEXT</button>
            </div>`;

            const popup_body_html = `\
<div class="popup-step" data-stepid="1" shown style="height: 313px">
    <img class="popup-header-icon" src="/public/assets/2fa-icon.svg" width="25%" style="display: block; margin: 20px auto 45px auto"></img>

    <p>Two-factor authentication significantly increases your account's security. It is a good idea to turn it on even if you don't hold any dangerous rights.</p>
    <p>After enabling this functon, every time you log in, you will be required to enter a one-time use 6-digit code, generated by an app on your phone.</p>
    <p>Be careful, though. If you lose access to your code generator, it will be harder to log into your account.</p>
</div>
<div class="popup-step" data-stepid="2">
    <img id="2fasetup-qrcode" class="popup-header-icon" width="250px" height="250px" style="display: block; margin: 0 auto 25px auto"></img>

    <p>Scan the above QR Code using an authenticator app on your phone (like <i>Authy</i> or <i>Google Authenticator</i>) and follow the instructions in the app.</p>
    <p>After adding the site to the authenticator, enter the generated 6-digit code into the field below.</p>

    <form class="ui-form-container" name="user-f2asetup">
        <div class="ui-input-box">
            <div class="popup"></div>
            <div class="ui-input-name1">6-digit code</div>
            <input type="number" name="otp" data-handler="" max="999999" class="ui-input1 roboto-mono">
        </div>
    </form>
</div>
<div class="popup-step" data-stepid="3">
    <div class="ui-info-box c-green">
        <div class="icon"><i class="fas fa-check"></i></div>
        <div class="text">Two-factor authentication was successfully enabled.</div>
    </div>

    <div id="f2asetup-recoverycodes"></div>
    <p>These are your backup codes. If you lose access to your authenticator app, you can use these to recover access to your account. Please, take a picture/screenshot of them or write them down.</p>
</div>`;

            const popup_el = ede.showPopup("user-f2asetup", "Set up Two-factor authentication", popup_body_html, popup_buttons_html, {
                close: ede.closePopup,
                next: (e, show_next_step, refresh_popup_pos) => { next_click(e, show_next_step, refresh_popup_pos) }
            }, 460);
        });
    };

    const action_update_password = () => {
        // We need an elevated session to update user's password
        ede.createElevatedSession(() => {
            const update_password = e => {
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

                e.target.classList.add("loading");

                // Update the password
                ede.apiCall("user/update_password", { new_password }, true)
                .then(() => {
                    e.target.classList.remove("loading");

                    ede.closePopup();
                    ede.refresh();

                    ede.showNotification("user-updatepassword-success", "Success", "Password successfully changed.");
                })
                .catch(error => {
                    e.target.classList.remove("loading");

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
</form>`;

            const popup_el = ede.showPopup("user-updatepassword", "Change password", popup_body_html, popup_buttons_html, {
                close: ede.closePopup,
                change: e => { update_password(e) }
            }, 460);

            ede.updateForms(popup_el);
        });
    };

    const actions_map = {
        update_password: action_update_password,
        setup_f2a: action_f2a_setup,
        disable_f2a: action_f2a_disable
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

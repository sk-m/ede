// System:Login page script

function loginPageScript() {
    // Main container element
    const login_form_maincontainer = document.getElementById("form-login-maincontainer");

    let login_form_state_is_login = true;

    // 2fa code
    let login_f2a_otp;

    // 2fa popup
    function login_get_f2a_code(callback) {
        const popup_buttons_html = `\
<div class="left">
    <button name="close" class="ui-button1 t-frameless w-500">CLOSE</button>
</div>
<div class="right">
    <button name="login" class="ui-button1 t-frameless c-blue w-500">LOG IN</button>
</div>`;

        const popup_body_html = `\
<p>Please, enter a 6-digit code from your authenticator app or a one-time use backup code.</p>

<form class="ui-form-container" name="login-f2acheck">
    <div class="ui-input-box">
        <div class="popup"></div>
        <div class="ui-input-name1">6-digit code or backup code</div>
        <input type="text" name="otp" data-handler="" class="ui-input1 roboto-mono">
    </div>
</form>`;

        const popup_el = ede.showPopup("login-f2acheck", "Two-factor authentication", popup_body_html, popup_buttons_html, {
            close: ede.closePopup,
            login: () => {
                // Validate the form
                const validation_result = ede.form.validate("login-f2acheck");
                if(validation_result.invalid) return;

                // Get the code
                login_f2a_otp = ede.form.list["login-f2acheck"].otp.value;

                callback();
            }
        }, 460);

        ede.updateForms(popup_el);
    }

    // On form submit
    const login_form_submit = e => {
        document.getElementById("systempage-login-apiresponse").innerText = "";

        if(login_form_state_is_login) {
            // Login

            // Validate inputs
            const validation_result = ede.form.validate("login");

            if(!validation_result.invalid) {
                e.target.classList.add("loading");

                // join auth API call
                ede.apiCall("auth/login", {
                    username: ede.form.list.login.username.value,
                    password: ede.form.list.login.password.value,
                    f2a_otp: login_f2a_otp
                }, true)
                .then(response => {
                    if(response.success) {
                        // TODO should redirect to `?redir_to=` or just show a "login" success message
                        window.location = "/User:" + ede.form.list.login.username.value
                    }
                })
                .catch(error => {
                    e.target.classList.remove("loading");

                    // TODO @cleanup switch?
                    if(error.error === "2fa_required") {
                        // 2fa required
                        login_get_f2a_code(login_form_submit);
                    } else if(error.error === "invalid_f2a_otp") {
                        // Invalid 2fa one time password, reset it so that the user will get an 2fa popup on next "log in" button click
                        login_f2a_otp = null;

                        ede.showNotification("login-f2a-invalid", "Error", `Two-factor authentication failed (${ error.message }).`, "error");
                    } else if(error.error === "blocked") {
                        // User is blocked
                        ede.showPopup("login-blocked", "Account is blocked", error.message);
                    } else {
                        document.getElementById("systempage-login-apiresponse").innerText = `Unknown error occured: ${ error.error }`;
                    }
                });
            }
        } else {
            // Join

            // Validate inputs
            const validation_result = ede.form.validate("join");

            if(!validation_result.invalid) {
                // Check if password_repeat is correct
                const password_field = ede.form.list.join.password;
                const password_repeat_field = ede.form.list.join.password_repeat;

                if(password_field.value !== password_repeat_field.value) {
                    ede.form.showPopup("join", "password_repeat", "Passwords do not match");
                    return;
                }

                e.target.classList.add("loading");

                // join auth API call
                ede.apiCall("auth/join", {
                    username: ede.form.list.join.username.value,
                    password: password_field.value,
                    email: ede.form.list.join.email.value
                }, true)
                .then(response => {
                    if(response.success) {
                        // TODO should redirect to `?redir_to=` or just show a "login" success message
                        window.location = "/User:" + ede.form.list.join.username.value
                    }
                })
                .catch((error) => {
                    e.target.classList.remove("loading");

                    if(error.error === "username_taken") {
                        ede.form.showPopup("join", "username", "Username is already taken");
                    }
                    else if(error.error === "username_forbidden") {
                        ede.form.showPopup("join", "username", "Username is forbidden");
                    }
                    else if(error.error === "ip_blocked") {
                        ede.showPopup("join-ipblocked", "IP address Blocked", error.message);
                    }
                    else {
                        ede.showPopup("join-unknown", "Unknown error", `Unknown error occured: ${ error.error }`);
                    }
                });
            }
        }
    }

    // Switch between login and join forms
    function login_form_switch() {
        if(login_form_state_is_login) {
            // Switch to join
            ede.form.list.login._form.classList.add("hidden");
            ede.form.list.join._form.classList.remove("hidden");

            login_form_maincontainer.classList.add("right");

            const login_username = ede.form.list.login.username.value;
            const login_password = ede.form.list.login.password.value;

            // Transfer login details to the join screen
            if(login_username) {
                ede.form.list.join.username.value = login_username;
            }

            if(login_password) {
                ede.form.list.join.password.value = login_password;
            }

            login_form_state_is_login = false;
        } else {
            // Switch to login
            ede.form.list.login._form.classList.remove("hidden");
            ede.form.list.join._form.classList.add("hidden");

            login_form_maincontainer.classList.remove("right");

            login_form_state_is_login = true;
        }
    }

    // Add onclick handlers for submit and switch buttons
    ede.form.list.login.switch.onclick = login_form_switch;
    ede.form.list.join.switch.onclick = login_form_switch;

    ede.form.list.login.submit.onclick = login_form_submit;
    ede.form.list.join.submit.onclick = login_form_submit;
}

ede_onready.push(loginPageScript);

loginPageScript;

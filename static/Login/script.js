// System:Login page script

function loginPageScript() {
    // Main container element
    const login_form_maincontainer = document.getElementById("form-login-maincontainer");

    let login_form_state_is_login = true;

    // On form submit
    function login_form_submit() {
        document.getElementById("systempage-login-apiresponse").innerText = "";

        if(login_form_state_is_login) {
            // Login

            // Validate inputs
            const validation_result = ede.form.validate("login");

            if(!validation_result.invalid) {
                // join auth API call
                ede.apiCall("auth/login", {
                    username: ede.form.list.login.username.value,
                    password: ede.form.list.login.password.value
                }, true)
                .then(response => {
                    if(response.success) {
                        // TODO should redirect to `?redir_to=` or just show a "login" success message
                        window.location = "/User:" + ede.form.list.login.username.value
                    }
                })
                .catch(error => {
                    if(error.message) {
                        // User is blocked
                        if(error.error === "blocked") {
                            ede.showPopup("login-blocked", "Account is blocked", error.message);
                        } else {
                            document.getElementById("systempage-login-apiresponse").innerText = error.message;
                        }
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

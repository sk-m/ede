function wikipageRestorePageScript() {
    const restore_form = ede.form.list["restorepage-form"];

    // Check if the form is available
    if(!restore_form) return;

    // Disable submit on enter key
    window.addEventListener("keydown", e => {
        if(e.keyCode === 13) {
            e.preventDefault();
            return false;
        }
    });

    restore_form.submit.onclick = e => {
        const final_params = ede.form.getParams("restorepage-form");

        // Check if summary was given
        if(!final_params.summary) {
            ede.form.showPopup("restorepage-form", "summary", "Please, provide a summary");
            return;
        }

        // Take the querried page address from the url
        final_params.title = ede.current_page.address.url_params[2];

        // Disable the button
        e.target.classList.add("disabled");

        // Delete the page
        ede.apiCall("page/restore", final_params, true)
        .then(() => {
            // TODO implement quickrefresh (maybe)
            ede.refresh();

            ede.showNotification("restorewikipage-success", "Success", "Page restored successfully.");
        })
        .catch(response => {
            ede.showAPIErrorNotification("restorewikipage", response);

            // Enable the button
            e.target.classList.remove("disabled");
        });
    }
}

ede_onready.push(wikipageRestorePageScript);

wikipageRestorePageScript;
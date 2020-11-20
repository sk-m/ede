function wikipageDeletePageScript() {
    const delete_form = ede.form.list["deletepage-form"];

    // Check if the form is available
    if(!delete_form) return;

    // Disable submit on enter key
    window.addEventListener("keydown", e => {
        if(e.keyCode === 13) {
            e.preventDefault();
            return false;
        }
    });

    // Show complete removal confirmation checkbox when the option is selected
    const db_removal_checkbox_el = delete_form.db_removal;
    const db_removal_confirm_el = delete_form.confirm_db_removal_checkbox;

    db_removal_checkbox_el.addEventListener("click", () => {
        if(db_removal_checkbox_el.dataset.checked === "true") {
            db_removal_confirm_el.style.visibility = "visible";
        } else {
            db_removal_confirm_el.style.visibility = "hidden";
            db_removal_confirm_el.dataset.checked = "false";
        }
    });

    delete_form.submit.onclick = e => {
        const final_params = ede.form.getParams("deletepage-form");

        // Check if complete removal confirmation is checked
        if(final_params.db_removal && !final_params.confirm_db_removal_checkbox) return;

        // Check if summary was given
        if(!final_params.summary) {
            ede.form.showPopup("deletepage-form", "summary", "Please, provide a summary");
            return;
        }

        // Take the querried page address from the url
        final_params.title = ede.current_page.address.query.title;

        // Disable the button
        e.target.classList.add("loading");

        // Delete the page
        ede.apiCall("page/delete", final_params, true)
        .then(() => {
            // TODO implement quickrefresh (maybe)
            ede.navigate(`/System:DeletedWikiPages?title=${ final_params.title }`);

            ede.showNotification("deletewikipage-success", "Success", "Page deleted successfully.");
        })
        .catch(response => {
            ede.showNotification("deletewikipage-error", "Error", `Failed to delete the page (${ response.error || `<code>${ response.status }</code>` }).`, "error");

            // Enable the button
            e.target.classList.remove("loading");
        });
    }
}

ede_onready.push(wikipageDeletePageScript);

wikipageDeletePageScript;

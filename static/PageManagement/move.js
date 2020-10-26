function wikipageMovePageScript() {
    const move_form = ede.form.list["movepage-form"];

    // Check if the form is available
    if(!move_form) return;

    // Disable submit on enter key
    window.addEventListener("keydown", e => {
        if(e.keyCode === 13) {
            e.preventDefault();
            return false;
        }
    });

    move_form.submit.onclick = e => {
        const final_params = ede.form.getParams("movepage-form");

        // Check if summary was given
        if(!final_params.summary) {
            ede.form.showPopup("movepage-form", "summary", "Please, provide a summary");
            return;
        }

        // Take the querried page address from the url
        final_params.title = ede.current_page.address.url_params[2];

        // Disable the button
        e.target.classList.add("loading");

        // Move the page
        ede.apiCall("page/move", final_params, true)
        .then(() => {
            ede.navigate(`/System:WikiPageManagement/info/${ final_params.new_namespace }:${ final_params.new_name }`);

            ede.showNotification("movewikipage-success", "Success", "Page moved successfully.");
        })
        .catch(response => {
            ede.showNotification("movewikipage-error", "Error", `Failed to move the page (${ response.error || `<code>${ response.status }</code>` }).`, "error");

            // Enable the button
            e.target.classList.remove("loading");
        });
    }
}

ede_onready.push(wikipageMovePageScript);

wikipageMovePageScript;

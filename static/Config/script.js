// System:Config page script

function configPageScript() {
    const category_link_els = document.querySelectorAll("#systempage-config-root > .left-panel > .categories > .category");
    const category_container_els = document.querySelectorAll("#systempage-config-root > .right-panel > .config-options");
    const config_option_els = document.querySelectorAll("#systempage-config-root > .right-panel > .config-options > .config-option");

    // Click handlers for category links on the left side
    for(const link_el of category_link_els) {
        link_el.onclick = () => {
            // TODO @performance this for loop can be replaced with a querySelector
            // Show the selected config items container
            for(const container_el of category_container_els) {
                if(container_el.dataset.category !== link_el.dataset.name) {
                    container_el.classList.remove("shown");
                } else {
                    container_el.classList.add("shown");
                }
            }

            // Deselect all links
            for(const link of category_link_els) {
                link.classList.remove("selected");
            }

            // Mark this link as selected
            link_el.classList.add("selected");

            // Wirite the name of the newly seleted category to the URL
            history.pushState({}, "", `/System:Config/${ link_el.dataset.name }`);
        }
    }

    // Handlers for config items
    // TODO @performance audit ths mess
    for(const config_option_el of config_option_els) {
        const config_key = config_option_el.name;

        const item_form = ede.form.list[config_key];

        const input_el = config_option_el.querySelector("input, div[input]");
        const status_el = config_option_el.querySelector(".status");

        // Skip non-changeable items
        if(item_form._form.dataset.changeable === "false") continue;

        const is_checkbox = input_el.hasAttribute("checkbox");

        // On input change
        input_el.addEventListener(is_checkbox ? "click" : "input", () => {
            // TODO @hack i don't know about this
            if(input_el.dataset.cleanvalue === (is_checkbox ? input_el.dataset.checked : input_el.value)) {
                // Value is set to the non-dirty one
                config_option_el.classList.remove("dirty");
                item_form.save.classList.add("disabled");
                if(item_form.reset) item_form.reset.classList.add("disabled");

                status_el.className = "status";
            } else {
                config_option_el.classList.add("dirty");
                item_form.save.classList.remove("disabled");
                if(item_form.reset) item_form.reset.classList.remove("disabled");
            }
        }, false);

        // On save
        item_form.save.onclick = e => {
            // Validate the form
            const form_validation = ede.form.validate(config_key);
            if(form_validation.invalid) {
                status_el.innerHTML = "<i class=\"fas fa-times\"></i> Invalid input";
                status_el.className = "status red";

                return;
            }

            // Get the params
            const params = ede.form.getParams(config_key);

            // Call the API
            ede.apiCall("config/setitem", {
                key: config_key,
                value: params[config_key]
            }, true, true)
            .then(() => {
                status_el.innerHTML = "<i class=\"fas fa-check\"></i> Saved successfully!";
                status_el.className = "status green";

                config_option_el.classList.remove("dirty");
                e.target.classList.add("disabled");
            })
            .catch(response => {
                status_el.innerHTML = `<i class="fas fa-times"></i> Save error: <code>${ response.message || "unknown error" }</code>`;
                status_el.className = "status red";

                e.target.classList.add("disabled");
            });
        }

        // On reset
        if(item_form.reset) {
            item_form.reset.onclick = e => {
                ede.apiCall("config/resetitem", { key: config_key }, true)
                .then(response => {
                    status_el.innerHTML = "<i class=\"fas fa-check\"></i> Reset successfully!";
                    status_el.className = "status green";

                    if(is_checkbox) {
                        input_el.dataset.checked = response["config/resetitem"].new_value;
                    } else {
                        input_el.value = response["config/resetitem"].new_value;
                    }

                    config_option_el.classList.remove("dirty");
                    e.target.classList.add("disabled");
                })
                .catch(response => {
                    status_el.innerHTML = `<i class="fas fa-times"></i> Reset error: <code>${ response.message || "unknown error" }</code>`;
                    status_el.className = "status red";

                    e.target.classList.add("disabled");
                });
            }
        }
    }
}

ede_onready.push(configPageScript);

configPageScript;

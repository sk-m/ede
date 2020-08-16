"use strict";

const ede_xhr = new XMLHttpRequest();

/** Functions in this array will be called when EDE is ready */
var ede_onready = [];
var ede_el_left_panel;

var leftpanel_open = true;

// TODO Most of this shoud be inside the Omicron skin script
window.onload = function() {
    // Update left panel
    const main_panel = document.querySelector("#ede-main-panel > .main-content-container");
    ede_el_left_panel = document.getElementById("ede-left-panel");

    ede_update_leftpanel_pos();

    // Check if the panel should be closed
    if(localStorage.getItem("ede_leftpanel_closed") === "true") {
        ede_el_left_panel.classList.add("closed");
        main_panel.classList.add("full-width");

        leftpanel_open = false;
    }

    // Toggler
    const menu_button = document.querySelector("#ede-top-panel > .left > .menu-button");

    menu_button.onclick = () => {
        if(leftpanel_open) {
            ede_el_left_panel.classList.add("closed");
            main_panel.classList.add("full-width");

            localStorage.setItem("ede_leftpanel_closed", true);
        } else {
            ede_el_left_panel.classList.remove("closed");
            main_panel.classList.remove("full-width");

            localStorage.setItem("ede_leftpanel_closed", false);
        }

        leftpanel_open = !leftpanel_open;
    }

    // on scroll
    window.addEventListener("scroll", ede_update_leftpanel_pos);

    // on navigation
    window.onpopstate = () => {
        if(location.hash) {
            if(location.hash.charAt(0) === "/") {
                // On redirect (clicked on a link)
                ede.navigate(location.hash.substr(2));
            }
        } else {
            // On history pop (clicked browser's back/forward button)
            ede.navigate(location.pathname, true);
        }
    }

    // Anchor link
    if(location.hash) {
        document.getElementById(location.hash.substring(1, location.hash.length)).classList.add("highlighted");
    }

    // Update elements
    ede.updateElements();

    // Register forms
    ede.updateForms();

    // Call onready functions
    ede.callOnReady();

    // Update blocks
    ede.updateUIBlocks();
};

// Updates left panel position
// TODO This shoud be inside the Omicron skin script
function ede_update_leftpanel_pos() {
    // Don't update the position if the panel is not shown
    if(!leftpanel_open) return;

    if(window.pageYOffset >= 58) {
        ede_el_left_panel.style.marginTop = "-58px";
    } else {
        ede_el_left_panel.style.marginTop = `-${ window.pageYOffset }px`;
    }
}

// Gets called when Prism is ready
// eslint-disable-next-line no-unused-vars
function _ede_prism_onload() {
    if(ede.current_page && ede.current_page.page_lang !== "none") {
        const name_split = ede.current_page.address.name.split(".");

        let prism_lang;
        const lang = ede.current_page.page_lang || name_split[name_split.length - 1];

        if(lang === "html") prism_lang = Prism.languages.html;
        else if(lang === "css") prism_lang = Prism.languages.css;
        else if(lang === "js") prism_lang = Prism.languages.js;
        else if(lang === "json") prism_lang = Prism.languages.json;
        else return;

        const parsed_content = document.getElementById("ede-page-content").innerHTML;

        const code_beautified = `<pre><code class="language-${ lang }">${
            Prism.highlight(decodeURIComponent(parsed_content), prism_lang, lang)
        }</code></pre>`;

        document.querySelector(".ede-template.ede_page_content").innerHTML = code_beautified;
    }
}

// TODO Allow or (`|`) types like `string|array`
/**
 *
 * @param {Node} element DOM element of the input
 * @param {string} type type of data (username, password, number etc.)
 */
function ede_input_handler(element, type) {
    const result = {
        message: "",
        invalid: false,
        input_name: element.getAttribute("name")
    }

    switch(type) {
        case "username": {
            // Check the pattern for a username
            if(!element.value.match(/^[A-Za-z0-9_]{2,32}$/)) {
                result.invalid = true;
                result.message = "Username is not valid";
            }

            // Check if the first char is a letter or a '_'
            else if(!/[A-Za-z_]/.test(element.value.charAt(0))) {
                result.invalid = true;
                result.message = "Username must start with a letter or an underscore";
            }
        } break;

        case "email": {
            if(!element.checkValidity()) {
                result.invalid = true;
                result.message = "Email is not valid";
            } else if(element.value.indexOf(".") < 1) {
                result.invalid = true;
                result.message = "Email must contain a domain";
            }
        } break;

        case "password": {
            if(element.value.length < 8) {
                result.invalid = true;
                result.message = "Password must be at least 8 characters long";
            }
        } break;

        case "group_name": {
            if(!element.value.match(/^[a-z_-]{1,127}$/)) {
                result.invalid = true;
                result.message = "Group name is not valid";
            }
        } break;

        case "int":
        case "number": {
            const value_number = parseInt(element.value, 10);

            if(isNaN(value_number)) {
                result.invalid = true;
                result.message = "Value must be a number";
            }
        } break;

        case "array": {
            if(element.value.indexOf(",") === -1) {
                result.invalid = true;
                result.message = "Value must be an array";
            }
        } break;

        default: {
            // Generic check
            result.invalid = !element.checkValidity();
        }
    }

    element.dataset.invalid = result.invalid;
    return result;
}

/** Main ede object */
window.ede = {
    /**
     * Make an API call
     *
     * @param {string} action action name (ex. "get/page" => request to "/api/get/page?...")
     * @param {object} params request parameters
     * @param {boolean} post true to make a POST request
     *
     * @returns Backend's response
     */
    apiCall: function(action, params, post = false) {
        return new Promise((resolve, reject) => {
            let request_body = "";

            // Convert parameters to string (?a=1&b=2)
            if(params) {
                for(const i in params) {
                    if(params[i]) {
                        let value;

                        // JSON.stringify is param is an object
                        if(typeof params[i] === "object") value = JSON.stringify(params[i]);
                        else value = params[i];

                        request_body += encodeURI(`${ i }=${ value }&`);
                    }
                }

                // Send csrf token
                const csrf_token = localStorage.getItem("ede_csrf_token");
                if(csrf_token) {
                    request_body += `csrf_token=${ encodeURIComponent(csrf_token) }`;
                }
            }

            // Construct the url
            const url = `/api/${ action }`;

            ede_xhr.onreadystatechange = () => {
                if(ede_xhr.readyState === 4) {
                    if(ede_xhr.status === 200) {
                        try {
                            // Try to parse JSON
                            const response = JSON.parse(ede_xhr.responseText);

                            // Get csrf token
                            const headers = ede_xhr.getAllResponseHeaders().split("\n");
                            for(const header of headers) {
                                if(header.startsWith("x-csrf-token")) {
                                    response._CSRF_TOKEN = header.split(": ")[1];

                                    // Save the csrf token
                                    localStorage.setItem("ede_csrf_token", response._CSRF_TOKEN);

                                    break;
                                }
                            }

                            // Request was successfull
                            resolve(response);
                        } catch(error) {
                            // Error making a request
                            reject(error);
                        }
                    } else {
                        // Error returned
                        try {
                            reject(JSON.parse(ede_xhr.responseText));
                        } catch(error) {
                            reject(error || new Error("Could not parse API's error response"));
                        }
                    }
                }
            };

            // Make a request
            ede_xhr.open(post ? "POST" : "GET", url, true);
            ede_xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

            ede_xhr.send(request_body);
        });
    },


    /**
     * Set template's content
     *
     * @param {string} name name of the template
     * @param {string} value value for the template
     * @param {boolean} is_html set innerHTML instead of innerText?
     */
    setTemplate: function(name, value, is_html = false) {
        const template = ede.element.template[name];

        if(template) {
            if(is_html) {
                template.innerHTML = value;
            } else {
                template.innerText = value;
            }
        }
    },

    /**
     * Call all ede_onready functions
     */
    callOnReady: function() {
        for(const func of ede_onready) {
            if(typeof func === "function") func();
        }

        window.ede_onready = [];
    },

    /**
     * Execute SPA redirect (without page refresh)
     *
     * @param {string} new_url new url to redirect to
     * @param {boolean} replace call replaceState instead of pushState?
     */
    navigate: function(new_url, replace = false) {
        if(replace) {
            history.replaceState({ new_url }, undefined, new_url);
        } else {
            history.pushState({ new_url }, undefined, new_url);
        }

        // Get requested page (we have to remove the first slash)
        ede.apiCall(`get/page?title=${ new_url.substr(1) }`, {})
        .then(page => {
            ede.updatePage(page);
        });
        // TODO catch show error
    },

    /**
     * Collapse a block (close / hide) and save it's state to the localStorage
     *
     * @param {string} id DOM id of a block that is to be collapsed
     */
    // TODO maybe move into the skin script?
    // TODO @performance we parse and then stringify the object every single time
    collapse_block: function(id) {
        const el = document.getElementById(id).parentElement;
        const full_block_name = `${ ede.current_page.address.name }::${ id }`;

        const current_blocks_state = JSON.parse(localStorage.getItem("ede_ui_blocks_state")) || {};

        if(!current_blocks_state[full_block_name]) current_blocks_state[full_block_name] = {};

        if(el.className.includes("collapsed")) {
            // Un-collapse block
            el.classList.remove("collapsed");

            current_blocks_state[full_block_name].collapsed = false;
        } else {
            // Collapse block
            el.classList.add("collapsed");

            current_blocks_state[full_block_name].collapsed = true;
        }

        localStorage.setItem("ede_ui_blocks_state", JSON.stringify(current_blocks_state));
    },

    /**
     * Update current view/state with a new page
     *
     * @param {object} new_page Page object, obtained from backend
     */
    updatePage: function(new_page) {
        // Clear last page state
        for(const css_el of ede.page_css_elements) {
            css_el.remove();
        }

        ede.page_css_elements = [];
        ede.page_scripts = [];

        // Main templates
        ede.setTemplate("ede_page_title", new_page.display_title);
        ede.setTemplate("ede_page_content", new_page.parsed_content, true);

        // Other
        if(new_page.info.hidetitle && new_page.info.hidetitle.value) {
            ede.element.template.ede_page_title_container.classList.add("hidden");
            ede.element.template.ede_page_additional_info_container.classList.add("hidden");
        } else {
            ede.element.template.ede_page_title_container.classList.remove("hidden");
            ede.element.template.ede_page_additional_info_container.classList.remove("hidden");
        }

        // Load CSS and JS
        for(const css_text of new_page.additional_css) {
            ede.loadCss(css_text);
        }

        for(const js_text of new_page.additional_js) {
            ede.loadJs(js_text);
        }

        // Update all forms
        ede.updateForms();

        // Update all elements
        ede.updateElements();

        // Call all ede_onready functions (for pages that provide additional_js)
        ede.callOnReady();

        // Update blocks
        ede.updateUIBlocks();
    },

    /**
     * Update and register all forms in the DOM. Attach handlers, etc.
     */
    updateForms: function() {
        // All forms in the DOM
        const forms = document.getElementsByTagName("form");

        for(const form of forms) {
            // Get all inputs
            const all_inputs = form.querySelectorAll(["input[data-handler]", "button", "div[input]"]);

            // Create a form object
            ede.form.list[form.name] = {
                // This <form>'s DOM element
                _form: form
            };

            // Set necessary parameters for the form DOM element
            form.action = "javascript:void(0);";
            form.noValidate = true;

            for(const el of all_inputs) {
                // Check if input has a name attribute
                // Don't change to `el.name` because it seems to work only with <input> elements
                const el_name = el.getAttribute("name");

                if(el_name) {
                    ede.form.list[form.name][el_name] = el;
                } else {
                    console.warn("Input has no name parameter, will not be added to ede.form.list", el);
                }

                if(el.nodeName === "INPUT") {
                    // Inputs
                    const popup_el = el.parentElement.getElementsByClassName("popup")[0];

                    if(popup_el) {
                        el.onfocus = () => {
                            popup_el.classList.remove("shown");
                        };
                    }

                    el.onblur = () => {
                        return ede_input_handler(el, el.dataset.handler);
                    };
                } else if(el.className.includes("ui-checkbox")) {
                    // Checkboxes
                    el.dataset.dirty = "false";

                    el.addEventListener("click", e => {
                        e.stopPropagation();

                        // Set state to dirty
                        el.dataset.dirty = "true";

                        // Toggle the checkbox
                        el.dataset.checked = el.dataset.checked === "true" ? "false" : "true";
                    }, false);
                } else if(el.className.includes("ui-input-dropdown")) {
                    // Dropdowns
                    el.dataset.dirty = "false";

                    ede.form.list[form.name][el_name] = el.querySelector("input");

                    // Click handler for dropdown menu
                    el.addEventListener("click", e => {
                        e.stopPropagation();

                        // Toggle the checkbox
                        el.dataset.open = el.dataset.open === "true" ? "false" : "true";
                    });

                    // Click handlers for each choice
                    const choice_els = el.querySelectorAll(".choices > .choice");

                    for(const choice_el of choice_els) {
                        const dropdown_el = choice_el.parentElement.parentElement;

                        choice_el.addEventListener("click", e => {
                            e.stopPropagation();

                            const currently_selected_choice = choice_el.parentElement.querySelector(".choice[data-selected=\"true\"]");

                            // Unselect currently selected option
                            if(currently_selected_choice) {
                                currently_selected_choice.dataset.selected = "false";
                            }

                            // Close the dropdown menu
                            el.dataset.open = "false";

                            // Set dropdown state to dirty
                            el.dataset.dirty = "true";

                            // Toggle the checkbox
                            choice_el.dataset.selected = "true";

                            // Set the input
                            dropdown_el.querySelector("input").value = choice_el.dataset.value || choice_el.innerText;
                        })
                    }
                } else if(el.className.includes("ui-input-array")) {
                    // TODO WIP

                    // Array input
                    el.dataset.dirty = "false";

                    const item_els = el.querySelectorAll(".items > div");
                    const clean_items = [];

                    // Add a click listner for all items
                    for(const item_el of item_els) {
                        item_el.onclick = e => {
                            e.target.remove();
                        };

                        clean_items.push(item_el.innerText);
                    }

                    // Focus on input on click
                    el.onclick = () => {
                        el.querySelector("input").focus();
                    };

                    // Save clean value, so we can reset to it, when user wants to do so
                    el.dataset.clean_value = clean_items.join(",");

                    // Reset button handler
                    const reset_btn = el.querySelector(".reset-button");
                    reset_btn.onclick = () => {
                        const items_el = el.querySelector(".items");
                        const new_items_fragment = document.createDocumentFragment();

                        // Remove all current items
                        items_el.innerHTML = "";

                        // Add all items from a clean value
                        const clean_value_arr = el.dataset.clean_value.split(",");
                        for(const item of clean_value_arr) {
                            // Create a new item element
                            const item_el = document.createElement("div");
                            item_el.innerText = item;

                            // Add a click (remove) listner for it
                            item_el.onclick = e => {
                                e.target.remove();
                            };

                            new_items_fragment.appendChild(item_el);
                        }

                        // Append all the clean value items to the input
                        items_el.appendChild(new_items_fragment);
                    };

                    // Clean (remove all) button handler
                    el.querySelector(".clean-button").onclick = () => {
                        el.querySelector(".items").innerHTML = "";
                    };

                    // <input> element handler
                    el.querySelector("input").addEventListener("input", input_event => {
                        const input_value = input_event.target.value;

                        // Add a new item
                        if(input_value.length > 1 && (input_value.endsWith(",") || input_value.endsWith(";"))) {
                            // Mark input as dirty
                            el.dataset.dirty = "true"

                            // Clean the input
                            input_event.target.value = "";

                            // Create a new item element
                            const new_item = document.createElement("div");

                            // Remove delimiter char
                            new_item.innerText = input_value.substring(0, input_value.length - 1);

                            // Handler for removing the new item
                            new_item.onclick = item_event => {
                                item_event.target.remove();
                            };

                            el.querySelector(".items").appendChild(new_item);
                        }
                    }, false);
                }
            }
        }
    },

    /**
     * Update ui-form-box elements state (collapsed, etc.)
     */
    updateUIBlocks: function() {
        // TODO system pages only for now (idk if we need this on other systempages)
        if(ede.current_page.address.namespace === "System") {
            const ui_blocks_state = JSON.parse(localStorage.getItem("ede_ui_blocks_state")) || {};

            for(const full_block_name in ui_blocks_state) {
                const split = full_block_name.split("::", 2);

                // Only get blocks for the current page
                if(split[0] === ede.current_page.address.name) {
                    const block_state = ui_blocks_state[full_block_name];
                    const block_el = document.getElementById(split[1]);

                    // Check if this block is currently on the page
                    if(block_el && block_state.collapsed) {
                        block_el.parentElement.classList.add("collapsed");
                    }
                }
            }
        }
    },

    /**
     * Update some DOM elements to make EDE function properly
     */
    updateElements: function() {
        // Templates
        ede.element.template = {};

        const template_els = document.querySelectorAll(".ede-template");
        for(const el of template_els) {
            ede.element.template[el.classList[1]] = el;
        }

        // Handler for links. Replaces redirects with ede.navigate()
        const a_els = document.querySelectorAll("a[href]");
        for(const el of a_els) {
            const href = el.getAttribute("href");

            if(href.startsWith("/")) {
                el.onclick = (e) => {
                    e.preventDefault();

                    ede.navigate(href);
                }
            }
        }

        // Handler for log entries
        const log_containers = document.querySelectorAll(".ui-logs-container");
        for(const container_el of log_containers) {
            const entry_els = container_el.querySelectorAll(".ui-log-item");
            container_el.dataset.selected_ids = "";

            for(const entry_el of entry_els) {
                entry_el.onclick = () => {
                    if(entry_el.dataset.selected !== "true") {
                        entry_el.dataset.selected = "true";
                        entry_el.classList.add("selected");

                        container_el.dataset.selected_ids += entry_el.dataset.logid + ",";
                    } else {
                        entry_el.dataset.selected = "false";
                        entry_el.classList.remove("selected");

                        container_el.dataset.selected_ids = container_el.dataset.selected_ids.replace(entry_el.dataset.logid + ",", "");
                    }
                }
            }
        }
    },

    /**
     * Load CSS
     *
     * @param {string} css_text CSS code
     */
    loadCss: function(css_text) {
        const el = document.createElement("style");

        el.innerHTML = css_text;
        document.head.appendChild(el);

        ede.page_css_elements.push(el);
    },

    /**
     * Load JS
     *
     * @param {string} js_text JS source code
     */
    loadJs: function(js_text) {
        const script_fuction = eval(js_text);

        ede.page_scripts.push(script_fuction);
    },

    /**
     * Page's css DOM elements
     */
    page_css_elements: [],

    /**
     * Page's JS script source codes
     */
    page_scripts: [],

    /**
     * Object for EDE's DOM elements
     */
    element: {
        template: {}
    },

    form: {
        /**
         * Object for all registered forms
         */
        list: {},

        /**
         * Check form's inputs
         *
         * @param {string} form_name form's name attrubute
         */
        validate: function(form_name) {
            for(const name in ede.form.list[form_name]) {
                const el = ede.form.list[form_name][name];

                // Skip disabled inputs, buttons and other stuff
                if(el.nodeName === "INPUT" && !el.disabled) {
                    const result = el.onblur();

                    if(result.invalid) {
                        ede.form.showPopup(form_name, el.getAttribute("name"), result.message);

                        return result;
                    }
                }
            }

            // Everything is valid
            return {
                message: "",
                invalid: false,
                input_name: undefined
            };
        },

        /**
         * Show popup for an input
         *
         * @param {string} form_name name of the form
         * @param {string} input_name name of the input
         * @param {string} message message inside the popup
         * @param {boolean} invalidate invalidate the input
         */
        showPopup: function(form_name, input_name, message, invalidate = true) {
            const el = ede.form.list[form_name][input_name];
            const popup = el.parentElement.getElementsByClassName("popup")[0];

            if(popup) {
                if(invalidate) el.dataset.invalid = "true";

                popup.innerText = message;
                popup.classList.add("shown");
            }
        },

        /**
         * Construct object with input names and values (mainly used for API calls)
         *
         * @param {string} form_name name of the form
         */
        getParams: function(form_name) {
            const form = ede.form.list[form_name];
            const params = {};

            for(const input_name in form) {
                const input = form[input_name];

                // Skip form and button elements
                if(input.nodeName !== "FORM" && input.nodeName !== "BUTTON") {
                    if(input.className.includes("ui-checkbox")) {
                        params[input_name] = input.dataset.checked === "true";
                    } else if(input.className.includes("ui-input-array")) {
                        const item_els = input.querySelectorAll(".items > div");
                        const array = [];

                        for(const item_el of item_els) {
                            array.push(item_el.innerText);
                        }

                        params[input_name] = array;
                    } else {
                        params[input_name] = input.value;
                    }
                }
            }

            return params;
        }
    }
};

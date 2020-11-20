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

    // Global loading indicator
    ede.element.global_loading_idicator = document.getElementById("ede-global-loading-indicator");

    // Context menu closer
    document.body.addEventListener("click", () => {
        if(ede.element.open_context_menu_el) {
            ede.element.open_context_menu_el.removeAttribute("shown");
            ede.element.open_context_menu_el = null;
        }
    }, false);

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
    window.onpopstate = e => {
        if(location.hash) {
            if(location.hash.charAt(0) === "/") {
                // On redirect (clicked on a link)
                ede.navigate(location.hash.substr(2));
            }
        } else {
            // On history pop (clicked browser's back/forward button)
            ede.navigate(e.state.new_url, true);
        }
    }

    // Anchor link
    if(location.hash) {
        const el = document.getElementById(location.hash.substring(1, location.hash.length));
        if(el) el.classList.add("highlighted")
    }

    // Popups container
    document.getElementById("ede-popups-container").addEventListener("click", e => {
        e.stopPropagation();

        ede.closePopup();
    }, false);

    // Update elements
    ede.updateElements();

    // Register forms
    ede.updateForms();

    // Call onready functions
    ede.callOnReady();

    // Update blocks
    ede.updateUIBlocks();

    // Update view
    ede.updatePageViewMode();
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
    ede.enablePrism(ede.current_page);
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

        case "systemmessage_name": {
            if(!element.value.match(/^[a-z_-]{1,256}$/)) {
                result.invalid = true;
                result.message = "System message name is not valid";
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
     * @param {string} action action name (ex. "page/get" => request to "/api/page/get?...")
     * @param {object} params request parameters
     * @param {boolean} post true to make a POST request
     *
     * @returns Backend's response
     */
    apiCall: function(action, params, is_post = false) {
        // TODO @cleanup

        return new Promise((resolve, reject) => {
            let request_body = "";

            // Convert parameters to string (?a=1&b=2)
            if(params) {
                for(const i in params) {
                    let value;

                    // JSON.stringify is param is an object
                    if(typeof params[i] === "object") value = JSON.stringify(params[i]);
                    else value = params[i];

                    request_body += `${ i }=${ encodeURIComponent(value) }&`;
                }

                // Send csrf token
                if(is_post) {
                    const csrf_token = localStorage.getItem("ede_csrf_token");
                    if(csrf_token) {
                        request_body += `csrf_token=${ csrf_token }`;
                    }
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

            if(is_post) {
                ede_xhr.open("POST", url, true);
                ede_xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

                ede_xhr.send(request_body);
            } else {
                ede_xhr.open("GET", `${ url }${ request_body ? `?${ request_body }` : "" }`, true);
                ede_xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

                ede_xhr.send();
            }
        });
    },

    logoutUser: function(skip_popup) {
        const logout = () => {
            ede.apiCall("user/logout", {}, true)
            .then(() => {
                location.reload();
            })
            .catch(error => {
                ede.closePopup();
                ede.showNotification("user-logout-error", "Error", error.error || "Could not log out!", "error");
            })
        };

        if(!skip_popup) {
            const popup_buttons_html = `\
<div class="left">
    <button name="close" class="ui-button1 t-frameless w-500">CLOSE</button>
</div>
<div class="right">
    <button name="delete" class="ui-button1 t-frameless c-red w-500">YES, LOG OUT</button>
</div>`;

            ede.showPopup("user-logout", "Really log out?", "Are you sure you want to log out?", popup_buttons_html, {
                close: ede.closePopup,
                delete: logout
            }, 460);
        } else {
            logout();
        }
    },

    createElevatedSession: function(callback, force_popup) {
        // Check if elevated session already exists
        if(ede.tools.getCookie("esid") && !force_popup) {
            if(typeof callback === "function") callback(true);
            return;
        }

        // TODO see todo file. Optimize ede.updateForms() and use it instead
        const create_session = () => {
            // Get the password
            const password = document.querySelector("#popupid-user-createelevatedsession input.password").value;

            // Button
            const submit_button = document.querySelector("#popupid-user-createelevatedsession button.continue");

            submit_button.classList.add("loading");

            ede.apiCall("user/create_elevated_session", { password }, true)
            .then(() => {
                ede.closePopup();
                ede.showNotification("user-createelevatedsession-success", "Success", "Succesfully verified.");

                if(typeof callback === "function") callback(true);
            })
            .catch(error => {
                submit_button.classList.remove("loading");

                ede.showNotification("user-createelevatedsession-error", "Error", error.error || "Could not create an elevated session!", "error");
            })
        };

        const popup_buttons_html = `\
<div class="left">
    <button name="close" class="ui-button1 t-frameless w-500">CLOSE</button>
</div>
<div class="right">
    <button name="continue" class="ui-button1 t-frameless c-blue w-500 continue">CONTINUE</button>
</div>`;

        const popup_body_html = `\
<p>We need to make sure it's really you before continuing.</p>
<div class="ui-input-box" style="margin-top: 25px">
    <div class="popup"></div>
    <div class="ui-input-name1">Current password</div>
    <input type="password" name="password" data-handler="password" class="ui-input1 password">
</div>
        `;

        ede.showPopup("user-createelevatedsession", "User verification", popup_body_html, popup_buttons_html, {
            close: ede.closePopup,
            continue: create_session
        }, 460);
    },

    // TODO @performance I'm positive we can make it more elegant
    setURLParam: function(key, value, navigate) {
        let new_url = location.href;

        value = encodeURIComponent(value);

        // '?' is already in the url
        if(location.search !== "" && location.search.indexOf("?") !== -1) {
            // Check if this key is already set
            let value_start_pos = location.href.indexOf(`${ key }=`);

            if(value_start_pos !== -1) {
                // Such key is already set
                value_start_pos += key.length + 1; // +1 for equals sign
                let value_end_pos = location.href.indexOf("&", value_start_pos);

                if(value_end_pos === -1) value_end_pos = location.href.length;

                new_url = location.href.substring(0, value_start_pos) + value + location.href.substring(value_end_pos);
            } else {
                // Such key is not set
                new_url += `&${ key }=${ value }`;
            }
        } else {
            // No keys set at all
            new_url += `?${ key }=${ value }`;
        }

        // TODO @hack @performance
        new_url = new_url.substring(location.origin.length);

        if(navigate) {
            ede.navigate(new_url);
        } else {
            history.replaceState({ new_url }, undefined, new_url);
        }
    },

    clearURLParams: function() {
        const new_url = location.pathname;

        history.replaceState({ new_url }, undefined, new_url);
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

    enablePrism: function(page) {
        if(page && page.page_lang !== "none") {
            const name_split = page.address.name.split(".");

            let prism_lang;
            const lang = page.page_lang || name_split[name_split.length - 1];

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
    },

    toggleToEditor: function() {
        ede.setURLParam("v", "edit", false);

        // Buttons
        ede.element.page_action_buttons.edit.classList.add("hidden");
        ede.element.page_action_buttons.read.classList.remove("hidden");

        // Containers
        ede.element.template.ede_page_content.classList.add("inactive");
        ede.element.template.ede_page_editor_root.classList.add("active");

        if(!ede.current_page.editor_loaded) {
            ede.apiCall("get_editor_html", {
                page_title: ede.current_page.address.title
            }, false)
            .then(editor_response => {
                ede.current_page.editor_loaded = true;

                // Insert the HTML
                ede.element.template.ede_page_editor_root.innerHTML = editor_response.html;

                // Update the forms
                ede.updateForms();

                // Get the form
                const save_form = ede.form.list["save-page"];

                save_form.submit.onclick = () => {
                    // Get params
                    const params = ede.form.getParams("save-page");

                    // Check if summary was given
                    if(!params.summary) {
                        ede.form.showPopup("save-page", "summary", "Please, provide a summary");
                        return;
                    }

                    ede.apiCall("page/save", {
                        page_title: ede.current_page.address.title,
                        page_content: params.content,
                        summary: params.summary
                    }, true)
                    .then(save_response => {
                        ede.showNotification("savepage-success", "Page saved", "Page saved successfully.");

                        // TODO @performance
                        ede.toggleToContent();
                        ede.refresh();
                    })
                    .catch(save_error => {
                        ede.showNotification("savepage-error", "Error", save_error.error || "Could not save the page!", "error");
                    })
                }
            })
            .catch(editor_error => {
                ede.showNotification("geteditorhtml-error", "Error", "Could not load the editor.", "error");
            });
        }
    },

    toggleToRevisions: function() {
        ede.setURLParam("v", "history", false);

        // Buttons
        ede.element.page_action_buttons.history.classList.add("hidden");
        ede.element.page_action_buttons.edit.classList.add("hidden");
        ede.element.page_action_buttons.read.classList.remove("hidden");

        // Containers
        ede.element.template.ede_page_content.classList.add("inactive");
        ede.element.template.ede_page_editor_root.classList.remove("active");
        ede.element.template.ede_page_revisions_root.classList.add("active");

        // Get the revisions
        if(!ede.current_page.revisions_loaded) {
            ede.apiCall("revision/get", { pageid: ede.current_page.pageid, g_anonymous: true }, false)
            .then(response => {
                ede.current_page.revisions_loaded = true;
                ede.current_page.revisions = response.revisions;

                const show_diff = (revid_from, revid_to) => {
                    ede.apiCall("revision/diff", {
                        revid_from,
                        revid_to,
                        as_html: true,
                        g_anonymous: true
                    }, false)
                    .then(diff_response => {
                        const status_container = ede.element.template.ede_page_revisions_root.querySelector(".preview-container > .status");

                        const from_obj = ede.current_page.revisions[revid_from];
                        const to_obj = ede.current_page.revisions[revid_to];

                        ede.element.template.ede_page_revisions_diff.hidden = false;
                        ede.element.template.ede_page_revisions_diff.innerHTML = diff_response.diff;

                        status_container.innerHTML = `\
<div class="ui-text margin-bottom">Showing difference between: </div>
<div class="ui-text margin-bottom">
    <div class="ui-revision-item">
        <span class="time">${ new Date(from_obj.timestamp * 1000).toLocaleString() }</span>
        <a href="/User:${ from_obj.user }">${ from_obj.user }</a>
        <span class="summary">(${ from_obj.summary })</span>
    </div>
    <div class="ui-revision-item">
        <span class="time">${ new Date(to_obj.timestamp * 1000).toLocaleString() }</span>
        <a href="/User:${ to_obj.user }">${ to_obj.user }</a>
        <span class="summary">(${ to_obj.summary })</span>
    </div>
</div>`;
                    })
                    .catch(diff_error => {
                        ede.showNotification("getrevisiondiff-error", "Error", `Could not load the diff (${ diff_error.error || "Unknown error" }).`, "error");
                    })
                }

                const revisions_fragment = ede.tools.constructRevisionsHTML(response.revisions, true, {
                    prev: {
                        icon: "fas fa-angle-down",
                        title: "Compare with a previous revision",

                        onclick: (e, revid) => {
                            // TODO @hack
                            show_diff(revid, e.target.dataset.previd);
                        }
                    },
                    curr: {
                        icon: "fas fa-angle-double-up",
                        title: "Compare with a current revision",

                        onclick: (_, revid) => {
                            show_diff(revid, ede.current_page.current_revision);
                        }
                    }
                });

                // TODO @performance
                const revisions_container = ede.element.template.ede_page_revisions_root.getElementsByClassName("revisions-container")[0];

                revisions_container.innerHTML = "";
                revisions_container.appendChild(revisions_fragment);
            })
            .catch(error => {
                ede.showNotification("getpagerevisions-error", "Error", "Could not load the revisions for current page.", "error");
            });
        }
    },

    toggleToContent: function() {
        if(!ede.element.page_action_buttons_loaded) return;

        ede.setURLParam("v", "page", false);

        // Buttons
        ede.element.page_action_buttons.history.classList.remove("hidden");
        ede.element.page_action_buttons.edit.classList.remove("hidden");
        ede.element.page_action_buttons.read.classList.add("hidden");

        // Containers
        ede.element.template.ede_page_content.classList.remove("inactive");
        ede.element.template.ede_page_editor_root.classList.remove("active");
        ede.element.template.ede_page_revisions_root.classList.remove("active");
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
        ede.showGlobalLoadingIndicator()

        // Toggle page view to content
        ede.toggleToContent();

        if(replace) {
            history.replaceState({ new_url }, undefined, new_url);
        } else {
            history.pushState({ new_url }, undefined, new_url);
        }

        // Remoe the first slash
        new_url = new_url.substr(1);

        // TODO @placeholder instead of having a hardcoded set of namespaces that require user's session, keep the namespaces config
        // with info about whether or not it requires user's session
        // TODO also @performance
        const is_system = new_url.toLowerCase().startsWith("system:") || new_url.toLowerCase().startsWith("user:");

        // Get requested page (we have to remove the first slash)
        ede.apiCall("page/get", { title: new_url, g_anonymous: !is_system })
        .then(page => {
            ede.hideGlobalLoadingIndicator()

            ede.updatePage(page);
        });
        // TODO catch show error
    },

    /**
     * Just navigates to location.pathname (SPA refresh)
     */
    refresh: function() {
        ede.navigate(location.pathname);
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

        // TODO @performance This *might* decrease performance, check it!
        ede.form.list = {};

        // Main templates
        ede.setTemplate("ede_page_title", decodeURIComponent(new_page.address.display_title), true);
        ede.setTemplate("ede_page_content", new_page.parsed_content, true);

        // Badges
        let badges_html = "";

        for(const badge of new_page.badges) {
            badges_html += `<div class="badge">${ badge }</div>`;
        }

        ede.setTemplate("ede_page_additionalinfo_badges", badges_html, true);

        // Other
        if(new_page.info.hiddentitle === true) {
            ede.element.template.ede_page_title_container.classList.add("hidden");
            ede.element.template.ede_page_additional_info_container.classList.add("hidden");
        } else {
            ede.element.template.ede_page_title_container.classList.remove("hidden");
            ede.element.template.ede_page_additional_info_container.classList.remove("hidden");
        }

        if(new_page.info.nocontainer === true) {
            ede.element.template.ede_page_main_content_container.classList.add("nocontainer");
        } else {
            ede.element.template.ede_page_main_content_container.classList.remove("nocontainer");
        }

        // Load CSS and JS
        for(const css_text of new_page.additional_css) {
            ede.loadCss(css_text);
        }

        for(const js_text of new_page.additional_js) {
            ede.loadJs(js_text);
        }

        // Update title
        document.title = `${ new_page.address.display_title } – ${ ede.instance_display_name }`;

        // Revisions view
        ede.element.template.ede_page_revisions_diff.hidden = true;
        ede.element.template.ede_page_revisions_diff.innerHTML = "";

        ede.element.template.ede_page_revisions_root.querySelector(".preview-container > .status").innerHTML = "";

        // Enable prism, if needed
        ede.enablePrism(new_page);

        // Update all forms
        ede.updateForms();

        // Update all elements
        ede.updateElements();

        // Call all ede_onready functions (for pages that provide additional_js)
        ede.callOnReady();

        // Update blocks
        ede.updateUIBlocks();

        // Update current_page
        ede.current_page = new_page;

        // Update view
        ede.updatePageViewMode();
    },

    // TODO @name
    // Update view mode (page, revisions or edit)
    updatePageViewMode: function() {
        const url = new URL(location.href);
        const view = url.searchParams.get("v");

        if(view) {
            switch(view) {
                case "edit": {
                    ede.toggleToEditor();
                } break;
                case "history": {
                    ede.toggleToRevisions();
                } break;
            }
        }
    },

    /**
     * Update and register all forms in the DOM. Attach handlers, etc.
     *
     * @param reference_el Element from which to search for forms. If not set, searches for forms in the whole document
     */
    updateForms: function(reference_el) {
        // TODO (maybe) should we empty ede.form.list from time to time?

        if(!reference_el) reference_el = document;

        // All forms in the DOM
        const forms = reference_el.getElementsByTagName("form");

        for(const form of forms) {
            // Get all inputs
            const all_inputs = form.querySelectorAll(["input[data-handler]", "button", "div[input]", "textarea"]);

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

                    const input_el = el.getElementsByTagName("input")[0];
                    const is_editable = el.hasAttribute("editable");

                    ede.form.list[form.name][el_name] = el.querySelector("input");

                    // Click handler for dropdown menu
                    const expand_el = is_editable
                        ? el.querySelector(".arrow-icon")
                        : el;

                    // Close popup on click
                    el.addEventListener("click", () => {
                        const popup = el.parentElement.closest("div[input-container]").getElementsByClassName("popup")[0];
                        if(popup) popup.classList.remove("shown");
                    });

                    expand_el.addEventListener("click", e => {
                        e.stopPropagation();

                        // Toggle the checkbox
                        el.dataset.open = el.dataset.open === "true" ? "false" : "true";
                    });

                    // Click handlers for each choice
                    const choice_els = el.querySelectorAll(".choices > .choice");

                    for(const choice_el of choice_els) {
                        const dropdown_el = choice_el.parentElement.parentElement;

                        // Highlight, if already selected
                        if(!is_editable && input_el.value === choice_el.dataset.value) {
                            choice_el.dataset.selected = true;
                        }

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
                            if(!is_editable) choice_el.dataset.selected = "true";

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

                    if(reset_btn) {
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
                    }

                    // Clean (remove all) button handler
                    const clean_btn = el.querySelector(".clean-button");

                    if(clean_btn) {
                        clean_btn.onclick = () => {
                            el.querySelector(".items").innerHTML = "";
                        };
                    }

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
        // TODO @performance this should be pretty fast

        // Templates
        ede.element.template = {};

        const template_els = document.getElementsByClassName("ede-template");
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

        // Context menu
        const contextmenu_containers = document.getElementsByClassName("ui-contextmenu-container");
        for(const container_el of contextmenu_containers) {
            // Do not open container on click
            if(container_el.hasAttribute("ignoreclick")) continue;

            // Show/hide handler
            container_el.onclick = e => {
                ede.showContextMenu(container_el);

                e.stopPropagation();
            };
        }

        // Page action buttons
        if(!ede.element.page_action_buttons_loaded &&
        !ede.element.template.ede_page_main_content_container.className.includes("nocontainer")) {
            ede.element.page_action_buttons_loaded = true;

            ede.element.page_action_buttons.edit = ede.element.template.ede_page_actionbuttons.querySelector(".page-edit");
            ede.element.page_action_buttons.read = ede.element.template.ede_page_actionbuttons.querySelector(".page-read");
            ede.element.page_action_buttons.history = ede.element.template.ede_page_actionbuttons.querySelector(".page-history");
            ede.element.page_action_buttons.manage = ede.element.template.ede_page_actionbuttons.querySelector(".page-manage");

            // Manage button
            if(ede.element.page_action_buttons.manage) {
                // On click
                ede.element.page_action_buttons.manage.onclick = () => {
                    ede.navigate(`/System:WikiPageManagement/info?title=${ ede.current_page.address.title }`);
                };

                // Context menu
                ede.element.page_action_buttons.manage.oncontextmenu = () => {
                    ede.showContextMenu(ede.element.page_action_buttons.manage);

                    // Update links
                    const links = ede.element.page_action_buttons.manage.querySelectorAll(".ui-contextmenu > .links > .link");

                    for(const link_el of links) {
                        link_el.onclick = e => {
                            e.stopPropagation();

                            // TODO A pretty hacky solution, but it feels pretty elegant
                            ede.navigate(`/System:WikiPageManagement/${ link_el.getAttributeNames()[1] }?title=${ ede.current_page.address.title }`);
                        };
                    }

                    // Don't open browser's context menu
                    return false;
                };
            }

            // Edit and read
            if(ede.element.page_action_buttons.read && ede.element.page_action_buttons.edit) {
                ede.element.page_action_buttons.edit.onclick = ede.toggleToEditor;
                ede.element.page_action_buttons.read.onclick = ede.toggleToContent;
            }

            // History (revisions)
            if(ede.element.page_action_buttons.history) {
                ede.element.page_action_buttons.history.onclick = ede.toggleToRevisions;
            }
        }

        // Handler for log entries
        const log_containers = document.getElementsByClassName("ui-logs-container");
        for(const container_el of log_containers) {
            const entry_els = container_el.getElementsByClassName("ui-log-item");
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

    // TODO maybe move to ede.element?
    showContextMenu: function(container_el) {
        // Close currently open menu
        if(ede.element.open_context_menu_el) {
            ede.element.open_context_menu_el.removeAttribute("shown");
            ede.element.open_context_menu_el = null;
        }

        const menu_el = container_el.getElementsByClassName("ui-contextmenu")[0];

        if(menu_el.hasAttribute("shown")) {
            menu_el.removeAttribute("shown");
            ede.element.open_context_menu_el = null;
        } else {
            menu_el.setAttribute("shown", "");
            ede.element.open_context_menu_el = menu_el;
        }
    },

    tools: {
        getCookie: function(name) {
            const cookies = document.cookie.split("; ");

            for(const cookie of cookies) {
                if(cookie.startsWith(name + "=")) {
                    return cookie.split(";", 2)[0].substring(name.length + 1);
                }
            }

            return null;
        },

        constructRevisionsHTML: function(revisions, with_checkboxes, buttons) {
            const fragment = document.createDocumentFragment();
            let last_revid = null;

            // Construct entries
            for(const revid in revisions) {
                const revision = revisions[revid];

                const time_str = new Date(revision.timestamp * 1000).toLocaleString();

                const rev_el = document.createElement("div");
                rev_el.className = "ui-revision-item";
                rev_el.dataset.revid = revid;

                rev_el.innerHTML += `\
${ with_checkboxes ? `<div data-revid="${ revid }" class="ui-checkbox-1 small">
    <div class="checkbox"><svg class="check" viewBox="0 0 20 20">\
    <path fill="none" d="M7.629,14.566c0.125,0.125,0.291,0.188,0.456,0.188c0.164,0,0.329-0.062,0.456-0.188l8.219-8.221c\
    0.252-0.252,0.252-0.659,0-0.911c-0.252-0.252-0.659-0.252-0.911,0l-7.764,7.763L4.152,9.267c-0.252-0.251-0.66-0.251-0.911\
    ,0c-0.252,0.252-0.252,0.66,0,0.911L7.629,14.566z"></path></svg></div>
</div>` : "" }
<div class="buttons"></div>
<span class="time">${ time_str }</span>
<span class="user">
    ${ revision.user !== null ? `<a href="/User:${ revision.user }">${ revision.user }</a>` : "<span class=\"hidden\">user hidden</span>" }
</span>
<span class="bytes">(${ revision.bytes_size } // ${ revision.bytes_change > 0 ? "+" : "" }${ revision.bytes_change })</span>
<span class="summary">${ revision.summary !== null ? `(${ revision.summary })` : "(<span class=\"hidden\">summary hidden</span>)" }</span>
${ revision.content_hidden ? "<span class=\"content-hidden\"><span class=\"hidden\">(content hidden)</span></span>" : "" }
`;

                // Add buttons
                if(buttons) {
                    const buttons_el = rev_el.getElementsByClassName("buttons")[0];

                    for(const button_name in buttons) {
                        const button_el = document.createElement("span");

                        button_el.className = "button";
                        button_el.dataset.previd = last_revid;

                        button_el.innerHTML = `<i class="${ buttons[button_name].icon }"></i>`;
                        if(buttons[button_name].title) button_el.title = buttons[button_name].title;

                        button_el.addEventListener("click", e => {
                            buttons[button_name].onclick(e, revid);
                        });

                        buttons_el.appendChild(button_el);
                    }
                }

                last_revid = revid;
                fragment.appendChild(rev_el);
            }

            return fragment;
        }
    },

    /**
     * Show a popup
     *
     * @param {string} id internal id that will be assigned to the popup
     * @param {string} title display title
     * @param {string} body_html body html
     * @param {string} body_html buttons html
     * @param {object} button_actions button actions
     * @param {number} width custom width for the popup
     *
     * Example button actions config:
     * { save: () => { console.log("save") }, close: () => { ede.closePopup() } }
     *
     * Button's names are determined by the 'name' attribute
     * 
     * @returns Popup DOM element
     */
    showPopup: function(id, title, body_html, buttons_html, button_actions, width = 440) {
        // Default buttons
        if(!buttons_html) buttons_html = `\
<div class="left"></div>
<div class="right">
    <button name="dismiss" onclick="ede.closePopup()" class="ui-button1 t-frameless c-blue w-500">DISMISS</button>
</div>`;

        const popup_el = document.createElement("div");
        const container_el = document.getElementById("ede-popups-container");

        popup_el.id = `popupid-${ id }`;
        popup_el.classList.add("ui-popup");
        popup_el.dataset.current_step = 1;

        popup_el.style.width = `${ width }px`;
        popup_el.style.marginLeft = `-${ width / 2 }px`;

        popup_el.addEventListener("click", e => {
            e.stopImmediatePropagation();
        }, false);

        popup_el.innerHTML = `\
<div class="top">
    <div class="title-container">
        <div class="text">${ title }</div>
    </div>
    <div class="buttons-container">
        <div class="button-close" onclick="ede.closePopup()"><i class="fas fa-times"></i></div>
    </div>
</div>
<div class="middle">
    <div class="body">${ body_html }</div>
</div>
<div class="bottom">
    <div class="buttons-container">${ buttons_html }</div>
</div>
`;

        // Switch to the next step
        const next_step_func = () => {
            // Get the current step
            const current_step_id = parseInt(popup_el.dataset.current_step, 10);

            // Switch to the next step
            popup_el.querySelector(`.popup-step[data-stepid="${ current_step_id }"]`).removeAttribute("shown");
            popup_el.querySelector(`.popup-step[data-stepid="${ current_step_id + 1 }"]`).setAttribute("shown", "");

            // Increment the current step
            popup_el.dataset.current_step = current_step_id + 1;

            // Re-center the popup
            popup_el.style.marginTop = `-${ popup_el.offsetHeight / 2 }px`;

            // Return the new step
            return current_step_id + 1;
        };

        // Re-center the popup
        const refresh_popup_size = () => {
            popup_el.style.marginTop = `-${ popup_el.offsetHeight / 2 }px`;
        };

        container_el.classList.add("active");
        container_el.appendChild(popup_el);

        // Disable page scrolling
        // document.body.style.overflow = "hidden";

        // After we push the popup to the DOM
        popup_el.style.marginTop = `-${ popup_el.offsetHeight / 2 }px`;

        // Button actions
        if(button_actions) {
            for(const button_name in button_actions) {
                const button_el = popup_el.querySelector(`*[name="${ button_name }"]`);

                button_el.addEventListener("click",
                    click_event => { button_actions[button_name](click_event, next_step_func, refresh_popup_size) },
                    false);
            }
        }

        return popup_el;
    },

    /**
     * Close the popup
     */
    closePopup: function() {
        // Enable page scrolling
        // document.body.style.overflow = "auto";

        const container_el = document.getElementById("ede-popups-container");

        container_el.classList.remove("active");

        // Remove the popup from the dom
        setTimeout(() => {
            container_el.children[0].remove();
        }, 200);
    },

    /**
     * Show a small notification
     *
     * @param {string} internal id of the notification
     * @param {string} title title for the notification
     * @param {string} body_html notification's body
     * @param {string} status "error" or anything else for "success"
     */
    showNotification: function(id, title, body_html, status) {
        let status_html;

        // Number of milliseconds to hold the notificaion on screen for
        let hold_ms = 6000;

        if(status === "error") {
            hold_ms = 12000;

            status_html = `\
<div class="status red">\
    <i class="fas fa-times"></i>\
    <svg
    class="progress-ring"
    height="30"
    width="30"
    >
        <circle
        class="progress-ring-circle error"
        stroke-width="2"
        stroke="rgba(232, 32, 0, 0.75)"
        fill="transparent"
        r="10"
        cx="15"
        cy="15"
        />
    </svg>
</div>`;
        } else {
            status_html = `\
<div class="status green">
    <i class="fas fa-check"></i>
    <svg
    class="progress-ring success"
    height="30"
    width="30"
    >
        <circle
        class="progress-ring-circle"
        stroke-width="2"
        stroke="rgba(12, 207, 0, 0.75)"
        fill="transparent"
        r="10"
        cx="15"
        cy="15"
        />
    </svg>
</div>`;
        }

        const notification_el = document.createElement("div");

        notification_el.id = `notificationid-${ id }`;
        notification_el.className = "ui-notification";

        notification_el.innerHTML = `\
<div class="top">
    <div class="title-container">
        <div class="text">${ title }</div>
    </div>
    <div class="right-container">${ status_html }</div>
</div>
<div class="middle">
    <div class="body">${ body_html }</div>
</div>`;

        // Container
        const container_el = document.getElementById("ede-notifications-container");

        // Animated circle
        const circle_el = notification_el.querySelector(".progress-ring-circle");

        // Circle animation
        setTimeout(() => {
            circle_el.style.strokeDashoffset = 62.83185307179586; // radius * 2 * Math.PI
        }, 250);

        // Close notification after a certain period of time
        const self_close_timeout = setTimeout(() => {
            notification_el.style.marginLeft = "-125%";

            setTimeout(() => {
                notification_el.remove();
            }, 200);
        }, hold_ms + 1000);

        // Close handler
        notification_el.addEventListener("click", () => {
            // We no longer need a timer that will the notification after some time
            clearTimeout(self_close_timeout);

            notification_el.style.marginLeft = "-125%";

            setTimeout(() => {
                notification_el.remove();
            }, 200);
        }, false);

        // Append the notification
        container_el.appendChild(notification_el);
    },

    showGlobalLoadingIndicator: function() {
        ede.element.global_loading_idicator.classList.add("shown");
    },

    hideGlobalLoadingIndicator: function() {
        ede.element.global_loading_idicator.classList.remove("shown");
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
        page_action_buttons_loaded: false,
        open_context_menu_el: null,

        global_loading_idicator: null,

        template: {},
        page_action_buttons: {}
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
            let popup = el.parentElement.getElementsByClassName("popup")[0];

            if(!popup) {
                popup = el.parentElement.closest("div[input-container]").getElementsByClassName("popup")[0]
            }

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

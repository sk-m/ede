// System:FileUpload page script

function fileUploadPageScript() {
    const upload_form = ede.form.list["fileupload-upload"];

    // Main form is not available
    if(!upload_form) return;

    // Get the elements we need
    const selected_files_list = document.querySelector("#systempage-fileupload-root > form .selected-files-list > .list");

    const status_floater = document.querySelector("#systempage-fileupload-root > .status-floater");
    const status_floater_text = status_floater.getElementsByClassName("status-text")[0];
    const status_floater_indicator = status_floater.getElementsByClassName("loading-indicator")[0];

    const orders_of_magnitude = ["", "K", "M", "G"];

    let current_files_n = 0;

    // Prettifies file sizes (10000 bytes -> 10KB)
    const prettify_file_size = size => {
        let i = 0;

        while(size > 1024) {
            size /= 1024;

            i++;
        }

        return `${ Math.ceil(size) } ${ orders_of_magnitude[i] }B`;
    }

    // Update the files list container
    const update_files_list = files => {
        const fragment = document.createDocumentFragment();
        let total_files_size = 0;

        // Empty the current list
        selected_files_list.innerHTML = "";

        // We now have files, enable the upload button
        upload_form["upload-btn"].removeAttribute("disabled");

        let i = 0;
        for(const file of files) {
            // Create an element for every file
            const el = document.createElement("div");
            el.className = "item";
            el.setAttribute("file-id", i);
            el.setAttribute("file-name", file.name);

            // Generate previews for files that are images
            const file_reader = new FileReader();

            file_reader.onload = e => {
                const preview_el = el.getElementsByClassName("preview")[0];

                preview_el.hidden = false;
                preview_el.src = e.target.result;
            }

            // If the file is an image, generate preview (will call file_reader.onload)
            if(file.type.startsWith("image/")) {
                file_reader.readAsDataURL(file);
            }

            el.innerHTML = `\
<div class="indicator">
    <i class="fas fa-exclamation"></i>
</div>
<div class="preview-container">
    <img hidden draggable="false" class="preview" alt="file preview">
    <div class="preview-placeholder"><i class="far fa-file-alt"></i></div>
</div>
<div class="info">
    <div class="top">
        <div class="filename-container">
            <input data-handler="filename" class="file-name" value="${ file.name }">
            <div class="icon"><i class="fas fa-pen"></i></div>
        </div>
        <div class="short-info">${ file.type || "unknown" } &middot; ${ prettify_file_size(file.size) }</div>
    </div>
    <div class="bottom">
        <form categories-editor class="ui-categories-container">
            <div class="text">Categories: </div>
            <div class="list">
            </div>
            <div class="add-container">
                <div class="button expand-btn"><i class="fas fa-plus"></i></div>
                <div class="input-container">
                    <input type="text" placeholder="Start typing...">
                    <div class="selector-box" hidden>
                        <div class="list">
                            <div class="item">test cat</div>
                        </div>
                    </div>
                </div>
                <div class="button save-btn" title="Save changes"><i class="fas fa-check"></i></div>
            </div>
        </form>
    </div>
</div>`;

            fragment.appendChild(el);

            total_files_size += file.size;
            i++;
        }

        // Upadte "*num* files selected" text
        current_files_n = files.length;

        document.querySelector("#systempage-fileupload-root > form .selected-files-list .selected-n")
        .innerHTML = `${ current_files_n } selected (${ prettify_file_size(total_files_size) } total)`;

        // Append the new files and update the form
        selected_files_list.appendChild(fragment);
        ede.updateForms(selected_files_list);
    };

    // On "select file" click - open OS's file selection menu
    upload_form["select-btn"].onclick = () => {
        upload_form["file-selector"].click();
    }

    // On file selected
    upload_form["file-selector"].onchange = e => {
        if(e.target.files.length !== 0) {
            update_files_list(e.target.files);
        }
    }

    // On upload button click
    upload_form["upload-btn"].onclick = async () => {
        // Check if there is at least one file selected for upload
        if(upload_form["file-selector"].files.length === 0) return;

        // Disable the button and show the status floater
        upload_form["upload-btn"].setAttribute("disabled", "");

        status_floater.removeAttribute("hidden");
        status_floater_text.innerText = "Checking the filenames...";

        // Gather all the file names
        const filename_els = selected_files_list.querySelectorAll("input.file-name");
        const filenames = [];

        const formdata = new FormData();

        let i = 0;
        for(const file of upload_form["file-selector"].files) {
            const filename = filename_els[i].value;

            formdata.append(`file_${ i }`, file);
            filenames.push(encodeURIComponent(filename));

            i++;
        }

        // Check if filenames are available
        // TODO @cleanup
        const filenames_check_results = await ede.apiCall(`file/checknames?filenames=${ filenames }`);

        if(!filenames_check_results["file/checknames"].all_available) {
            // Not all filenames are available
            const conflicting_names = filenames_check_results["file/checknames"].conflicting_names;

            // Show error indicator on conflicting files
            for(const filename of conflicting_names) {
                const el = selected_files_list.querySelector(`.item[file-name='${ filename }']`);

                if(el) el.setAttribute("w-indicator", "");
            }

            ede.showNotification("fileupload-error", "Error", "File name of one or more of selected files is already taken", "error");

            upload_form["upload-btn"].removeAttribute("disabled");
            status_floater.setAttribute("hidden", "");

            return;
        }

        // Files are not conflicting, we can upload

        status_floater_text.innerText = `Uploading ${ current_files_n } file(s)...`;

        const request = new XMLHttpRequest();

        // Upload progress polling
        request.upload.addEventListener("progress", e => {
            status_floater_indicator.style.width = `${ e.loaded / e.total * 100 }%`;
        });

        // Files uploaded, but we have not yet recieved the response from the server
        request.upload.addEventListener("load", () => {
            // Update the status floater
            status_floater_text.innerText = "Waiting for the server...";
        });

        request.onreadystatechange = () => {
            if(request.readyState === 4) {
                // Response from server recieved, hide the status floater
                status_floater.setAttribute("hidden", "");
                status_floater_text.innerText = "Idle";

                if(request.status === 200) {
                    // Successfull upload

                    // Reset the form
                    upload_form._form.reset();
                    update_files_list([]);

                    ede.showNotification("fileupload-success", "Success", "All files were uploaded successfully.");
                    upload_form["upload-btn"].setAttribute("disabled", "");
                } else {
                    // Unsuccessfull upload

                    // TODO @cleanup this can throw an exception on invalid JSON
                    const error = JSON.parse(request.response);

                    ede.showNotification("fileupload-error", "Error", error.message, "error");
                    upload_form["upload-btn"].removeAttribute("disabled");
                }
            }
        };

        // Upload the files
        request.open("POST", `/api/file/upload?destination=storage&filenames=${ filenames }`);
        request.send(formdata);
    }
}

ede_onready.push(fileUploadPageScript);

fileUploadPageScript;

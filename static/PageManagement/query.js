function wikipageQueryPageScript() {
    const query_form = ede.form.list["wikipagemanagement-query"];

    // Ensure that the query form is available
    if(query_form) {
        // On query
        query_form.submit.onclick = () => {
            const validation_result = ede.form.validate("wikipagemanagement-query");

            if(!validation_result.invalid) {
                ede.navigate("/System:WikiPageManagement/info?title=" + query_form.page_title.value);
            }
        }
    }
}

ede_onready.push(wikipageQueryPageScript);

wikipageQueryPageScript;

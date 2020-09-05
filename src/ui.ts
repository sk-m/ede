// TODO @performance calling this function every time is a waste
/**
 * Construct title bar HTML for the form-box
 *
 * @param id DOM id that will be assigned to the form box title
 * @param title Title for the box
 * @param description Description for the box
 */
export function constructFormBoxTitleBar(id: string, title: string, description?: string): string {
    return `\
<div id="${ id }" class="form-top">
    <div class="title">
        <div class="form-label">${ title }</div>
        <div class="right-side">
        <a href="#${ id }" class="button" title="Link to this block"><i class="fas fa-hashtag"></i></a>
        <div onclick="ede.collapse_block('${ id }')" class="button collapse" title="Collapse this block"><i class="fas fa-chevron-up"></i></div>
        </div>
    </div>
    ${ description ? `<div class="description">${ description }</div>` : "" }
</div>`
}

// TODO also add a function for array input
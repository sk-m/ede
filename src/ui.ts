// TODO @performance calling this function every time is a waste
/**
 * Construct title bar HTML for the form-box
 *
 * @param title Title for the box
 */
export function constructFormBoxTitleBar(id: string, title: string): string {
    return `\
<div id="${ id }" class="form-top">
    <div class="form-label">${ title }</div>
    <div class="right-side">
    <a href="#${ id }" class="button" title="Link to this block"><i class="fas fa-hashtag"></i></a>
    <div onclick="ede.collapse_block('${ id }', this)" class="button" title="Collapse this block"><i class="fas fa-chevron-up"></i></div>
    </div>
</div>`
}

// TODO also add a function for array input
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
    <div onclick="ede.collapse_block('${ id }')" class="button collapse" title="Collapse this block"><i class="fas fa-chevron-up"></i></div>
    </div>
</div>`
}

/**
 * Construct .ui-systempage-breadcrumbs HTML
 *
 * @param items ['display text', 'fas fa-icon-name', 'https://link.to.somewhere'] (only display text is necessary)
 */
export function constructSystempageBreadcrumbs(items: string[][]): string {
    let items_html = "";
    let is_first = true;

    for(const item of items) {
        // Add a separator
        if(!is_first) items_html += `<div class="separator"><i class="fas fa-chevron-right"></i></div>`;

        items_html += `<a ${ item[2] ? `href="${ item[2] }" title="Go to ${ item[2] }"` : "" }class="item">\
${ item[1] ? `<i class="${ item[1] }"></i>` : "" }\
${ item[0] }</a>`;

        is_first = false;
    }

    return `<div class="ui-systempage-breadcrumbs">${ items_html }</div>`;
}

// TODO also add a function for array input
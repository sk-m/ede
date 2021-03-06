import * as Page from "./page";

/**
 * Function for constructing HTML for systempages
 *
 * @param config systempage configuration
 *
 * Example for config.sidebar_config: {
 *   links: [
 *       {
 *           type: "heading",
 *           text: "Actions on selected user"
 *       },
 *       {
 *           type: "link",
 *           text: "Related logs",
 *           icon: "fas fa-list",
 *           href: "/test"
 *       },
 *       {
 *           type: "spacer",
 *           invisible: true
 *       },
 *       {
 *           id: "manageuser",
 *           type: "link",
 *           text: "Manage this user",
 *           disabled: true,
 *           icon: "fas fa-cog"
 *       },
 *       {
 *           type: "link",
 *           title: "This is a title",
 *           additional_classes: "red",
 *           text: "Block this user",
 *           icon: "fas fa-minus-circle"
 *       },
 *   ],
 *   something: "this <i>pure HTML</i> will be added to the sidebar"
 * }
 */
export function systempageBuilder(config: Page.SystempageConfig): Page.ResponsePage {
    let header_html = "";
    let breadcrumbs_html = "";
    let sidebar_html = "";

    // Construct header
    if(config.header_config) {
        header_html = `\
<div class="ui-systempage-header-box">
    <div class="title-container">
        <div class="icon"><i class="${ config.header_config.icon }"></i></div>
        <div id="systempage-header-title" class="title">${ config.header_config.title }</div>
    </div>
    ${ config.header_config.description ? `<div id="systempage-header-description" class="text">${ config.header_config.description }</div>` : "" }
    ${ config.header_config.body || "" }
</div>`;
    }

    // Construct breadcrumbs
    if(config.breadcrumbs_data) {
        let items_html = "";
        let i = 1;

        for(const item of config.breadcrumbs_data) {
            // Add a separator, if this is not the first element
            if(i !== 1) items_html += `<div class="separator"><i class="fas fa-chevron-right"></i></div>`;

            items_html += `<a ${ item[2] ? `href="${ item[2] }" title="Go to ${ item[2] }"` : "" }class="item" id="systempage-breadcrumbs-${ i }">\
${ item[1] ? `<i class="${ item[1] }"></i>` : "" }\
${ item[0] }</a>`;

            i++;
        }

        breadcrumbs_html = `<div id="systempage-breadcrumbs-container" class="ui-systempage-breadcrumbs">${ items_html }</div>`;
    }

    // Construct sidebar
    if(config.sidebar_config) {
        for(const key in config.sidebar_config) {
            if(config.sidebar_config[key]) {
                if(key === "links") {
                    // Config for links
                    const links_array = config.sidebar_config[key];

                    if(Array.isArray(links_array)) {
                        let links_html = "";

                        for(const el of links_array) {
                            // Element types
                            if(el.type === "heading") links_html += `<div class="heading">${ el.text }</div>`
                            else if(el.type === "spacer") links_html += `<div class="spacer${ el.invisible ? " invisible" : "" }"></div>`
                            else if(el.type === "link") links_html += `<a ${ el.id ? `id="sidelink-${ el.id }"` : "" } title="${ el.title || el.text }" \
                            ${ (!el.disabled && el.href) ? `href="${ el.href }"` : "" } class="link${ el.disabled ? " disabled" : "" } ${ el.additional_classes || "" }"><div class="icon"><i class="${ el.icon }"></i></div><div class="text">${ el.text }</div></a>`
                        }

                        sidebar_html += `<div class="links">${ links_html }</div>`;
                    }
                } else {
                    // Something custom, just add HTML to the final string
                    if(typeof config.sidebar_config[key] === "string") {
                        sidebar_html += config.sidebar_config[key];
                    }
                }
            }
        }
    }

    config.page.parsed_content = `\
${ breadcrumbs_html }
${ header_html }

<div class="ui-systempage-content-container" id="${ config.page.address.name.toLowerCase() }-content-container">
    <div class="ui-systempage-main-content">
        ${ config.body_html }
    </div>
    ${ sidebar_html ? `\
    <div class="ui-systempage-sidebar-right">
        <div class="sidebar">
            ${ sidebar_html }
        </div>
        <div class="shrink-button" title="Toggle the side menu" onclick="ede.toggleSystempageSidemenuState()">
            <div class="icon"><i class="fas fa-chevron-right"></i></div>
        </div>
    </div>` : "" }
</div>`;

    // Set some info items
    config.page.info.hiddentitle = true;
    config.page.info.nocontainer = true;

    return config.page;
}
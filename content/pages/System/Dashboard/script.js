// System:Dashboard page script

function dashboardPageScript() {
    const systempage_links = document.querySelectorAll("#systempage-dashboard-root .section > .systempage-item .icon.clickable");

    // CSS and JS links
    for(const el of systempage_links) {
        el.addEventListener("click", e => {
            ede.navigate(`/${ el.dataset.linkto }`);

            e.stopImmediatePropagation();
            e.stopPropagation();
        }, false);
    }
}

ede_onready.push(dashboardPageScript);

dashboardPageScript;

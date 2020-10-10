import * as Page from "./page";
import { pageTitleParser } from "./routes";
import * as Util from "./utils";

export interface WikitextRendererOutput {
    content: string
}

export async function renderWikitext(input: string, add_tag: boolean = false): Promise<WikitextRendererOutput> {
    const bench_time = process.hrtime();

    let final_content: string = "";

    if(add_tag) final_content += "<div class=\"wiki-content\">";

    let i = 0;
    let c;
    const input_len = input.length;

    let buffer_str = "";

    // flags - main
    let flag_write_to_buffer = false;
    let flag_ignore_all_chars = false;

    let flag_newline_firstchar = true;

    // flags - paragraphs
    let flag_paragraphs_count = 0;
    let flag_paragraph_not_open = false;

    // flags - heading
    let flag_heading_open = false;
    let flag_heading_firstchar_found = false;

    // flags - text transformation
    let flag_italic_open = false;
    let flag_strong_open = false;
    let flag_strongitalic_open = false;

    // flags - lists
    let flag_ol_depth = 0;
    let flag_ul_depth = 0;

    let flag_li_open = false;
    let flag_li_firstchar_found = false;
    let flag_close_li_count = 0;

    // flags - identation
    let flag_dl_depth = 0;
    let flag_dd_open = false;
    let flag_dd_firstchar_found = false;
    let flag_close_dd_count = 0;

    // flags - templates
    let flag_awaiting_template_info = false;
    let flag_awaiting_template_variable_info = false;

    let flag_template_info_start_pos = 0;
    let flag_template_variable_info_start_pos = 0;

    // flags - links
    let flag_awaiting_link_info = false;

    let flag_link_info_start_pos = 0;

    const write = (char: string) => {
        if(flag_write_to_buffer) return buffer_str += char;
        else return final_content += char;
    };

    // For every char
    while(i < input_len) {
        c = input.charAt(i);

        switch(c) {
            case '\n': {
                // End of ol list
                if(flag_ol_depth !== 0 && input[i + 1] !== '#') {
                    write("</li></ol>".repeat(flag_ol_depth - 1));
                    if(flag_close_li_count) write("</li>".repeat(flag_close_li_count));
                    write("</li></ol>");

                    flag_ol_depth = 0;
                    flag_close_li_count = 0;
                    flag_li_open = false;
                    flag_li_firstchar_found = false;
                }

                // End of ul list
                if(flag_ul_depth !== 0 && input[i + 1] !== '*') {
                    write("</li></ul>".repeat(flag_ul_depth - 1));
                    if(flag_close_li_count) write("</li>".repeat(flag_close_li_count));
                    write("</li></ul>");

                    flag_ul_depth = 0;
                    flag_close_li_count = 0;
                    flag_li_open = false;
                    flag_li_firstchar_found = false;
                }

                // End of dl list
                if(flag_dl_depth !== 0 && input[i + 1] !== ':') {
                    write("</dd></dl>".repeat(flag_dl_depth - 1));
                    if(flag_close_dd_count) write("</dd>".repeat(flag_close_dd_count));
                    write("</dd></dl>");

                    flag_dl_depth = 0;
                    flag_close_dd_count = 0;
                    flag_dd_open = false;
                    flag_dd_firstchar_found = false;
                }

                // Check if this is the second newline. If so, this is a new paragraph
                if(flag_newline_firstchar) {
                    flag_paragraphs_count++;

                    if(input[i + 1] === '=') {
                        final_content += "</p>";
                        flag_paragraph_not_open = true;
                    } else {
                        if(flag_paragraph_not_open) {
                            final_content += "<p>";
                            flag_paragraph_not_open = false;
                        } else {
                            final_content += "</p><p>";
                        }
                    }
                }

                flag_newline_firstchar = true;
            } break;

            case '=': {
                if(!flag_newline_firstchar && !flag_heading_open) {
                    write(c);
                    break;
                }

                let i_ref = i + 1;
                let eqs = 1;

                while(input[i_ref] === '=') {
                    eqs += 1;
                    i_ref += 1;
                }

                if(flag_heading_open) {
                    // Reset the state
                    flag_heading_open = false;
                    flag_heading_firstchar_found = false;

                    write(`</h${ eqs }>`);
                } else {
                    flag_heading_open = true;

                    write(`<h${ eqs }>`);
                }

                // -1 because we +1 at the end of this while loop
                i = i_ref - 1;
            } break;

            case '\'': {
                let i_ref = i + 1;
                let aps = 1;

                while(input[i_ref] === "'") {
                    aps += 1;
                    i_ref += 1;
                }

                if(aps === 1) {
                    write(c);
                } else if(aps === 2) {
                    if(flag_italic_open) {
                        write("</i>");
                        flag_italic_open = false;
                    } else {
                        write("<i>");
                        flag_italic_open = true;
                    }
                } else if(aps === 3) {
                    if(flag_strong_open) {
                        write("</strong>");
                        flag_strong_open = false;
                    } else {
                        write("<strong>");
                        flag_strong_open = true;
                    }
                } else if(aps === 5) {
                    if(flag_strongitalic_open) {
                        write("</i></strong>");
                        flag_strongitalic_open = false;
                    } else {
                        write("<strong><i>");
                        flag_strongitalic_open = true;
                    }
                }

                // -1 because we +1 at the end of this while loop
                i = i_ref - 1;
            } break;

            case '*': {
                if(!flag_newline_firstchar) {
                    write(c);
                    break;
                }

                let i_ref = i + 1;
                let stars_count = 1;

                while(input[i_ref] === '*') {
                    stars_count += 1;
                    i_ref += 1;
                }

                let depth_change = 0;
                let depth_inc = false;
                let depth_dec = false;

                let first_star = false;

                if(stars_count !== flag_ul_depth) {
                    depth_change = Math.abs(stars_count - flag_ul_depth);

                    if(flag_ul_depth === 0) { write("<ul><li>"); flag_ul_depth += depth_change; first_star = true; }
                    else {
                        if(stars_count > flag_ul_depth) { depth_inc = true; flag_ul_depth += depth_change; }
                        else { depth_dec = true; flag_ul_depth -= depth_change; }
                    }
                }

                if(flag_li_open) {
                    flag_li_open = false;
                    flag_li_firstchar_found = false;

                    if(depth_inc) { write("<ul><li>".repeat(depth_change)); }
                    else if(depth_dec) { write("</li></ul>".repeat(depth_change));  write("<li>"); flag_close_li_count += 1; }
                    else {
                        write("</li><li>");
                    }

                } else {
                    flag_li_open = true;

                    if(!first_star) {
                        if(depth_inc) { write("<ul><li>".repeat(depth_change)); }
                        else if(depth_dec) { write("</li></ul>".repeat(depth_change)); write("<li>"); flag_close_li_count += 1; }
                        else {
                            write("</li><li>");
                        }
                    }
                }

                // -1 because we +1 at the end of this while loop
                i = i_ref - 1;
            } break;

            case '#': {
                if(!flag_newline_firstchar) {
                    write(c);
                    break;
                }

                let i_ref = i + 1;
                let hashes_count = 1;

                while(input[i_ref] === '#') {
                    hashes_count += 1;
                    i_ref += 1;
                }

                let depth_change = 0;
                let depth_inc = false;
                let depth_dec = false;

                let first_hash = false;

                if(hashes_count !== flag_ol_depth) {
                    depth_change = Math.abs(hashes_count - flag_ol_depth);

                    if(flag_ol_depth === 0) { write("<ol><li>"); flag_ol_depth += depth_change; first_hash = true; }
                    else {
                        if(hashes_count > flag_ol_depth) { depth_inc = true; flag_ol_depth += depth_change; }
                        else { depth_dec = true; flag_ol_depth -= depth_change; }
                    }
                }

                if(flag_li_open) {
                    flag_li_open = false;
                    flag_li_firstchar_found = false;

                    if(depth_inc) { write("<ol><li>".repeat(depth_change)); }
                    else if(depth_dec) { write("</li></ol>".repeat(depth_change)); write("<li>"); flag_close_li_count += 1; }
                    else {
                        write("</li><li>");
                    }

                } else {
                    flag_li_open = true;

                    if(!first_hash) {
                        if(depth_inc) { write("<ol><li>".repeat(depth_change)); }
                        else if(depth_dec) { write("</li></ol>".repeat(depth_change)); write("<li>"); flag_close_li_count += 1; }
                        else {
                            write("</li><li>");
                        }
                    }
                }

                // -1 because we +1 at the end of this while loop
                i = i_ref - 1;
            } break;

            case ':': {
                if(!flag_newline_firstchar) {
                    write(c);
                    break;
                }

                let i_ref = i + 1;
                let colons_count = 1;

                while(input[i_ref] === ':') {
                    colons_count += 1;
                    i_ref += 1;
                }

                let depth_change = 0;
                let depth_inc = false;
                let depth_dec = false;

                let first_colon = false;

                if(colons_count !== flag_dl_depth) {
                    depth_change = Math.abs(colons_count - flag_dl_depth);

                    if(flag_dl_depth === 0) { write("<dl><dd>"); flag_dl_depth += depth_change; first_colon = true; }
                    else {
                        if(colons_count > flag_dl_depth) { depth_inc = true; flag_dl_depth += depth_change; }
                        else { depth_dec = true; flag_dl_depth -= depth_change; }
                    }
                }

                if(flag_dd_open) {
                    flag_dd_open = false;
                    flag_dd_firstchar_found = false;

                    if(depth_inc) { write("<dl><dd>".repeat(depth_change)); }
                    else if(depth_dec) { write("</dd></dl>".repeat(depth_change)); write("<dd>"); flag_close_dd_count += 1; }
                    else {
                        write("</dd><dd>");
                    }

                } else {
                    flag_dd_open = true;

                    if(!first_colon) {
                        if(depth_inc) { write("<dl><dd>".repeat(depth_change)); }
                        else if(depth_dec) { write("</dd></dl>".repeat(depth_change)); write("<dd>"); flag_close_dd_count += 1; }
                        else {
                            write("</dd><dd>");
                        }
                    }
                }

                // -1 because we +1 at the end of this while loop
                i = i_ref - 1;
            } break;

            case '{': {
                if(input[i + 1] === '{') {
                    if(input[i + 2] === '{') {
                        // Template variable

                        flag_awaiting_template_variable_info = true;
                        flag_ignore_all_chars = true;
                        flag_template_variable_info_start_pos = i + 3;

                        i += 2;
                    } else {
                        // Template insertion

                        flag_awaiting_template_info = true;
                        flag_ignore_all_chars = true;
                        flag_template_info_start_pos = i + 2;

                        i += 1;
                    }
                } else {
                    write(c);
                }
            } break;

            case '[': {
                if(input[i + 1] === '[') {
                    // Link

                    flag_awaiting_link_info = true;
                    flag_ignore_all_chars = true;
                    flag_link_info_start_pos = i + 2;

                    i += 1;
                } else {
                    write(c);
                }
            } break;

            case '}': {
                if(input[i + 1] === '}') {
                    if(input[i + 2] === '}') {
                        // Template variable
                        // console.log(input.substring(flag_template_variable_info_start_pos, i));

                        // flag_awaiting_template_variable_info = false;
                        // flag_ignore_all_chars = false;

                        // i += 2;
                    } else {
                        // Template insertion
                        const template_params = input.substring(flag_template_info_start_pos, i).split("|");

                        const address = pageTitleParser(template_params[0], "Template");
                        const page = await Page.get(address, {}, false);

                        if(page.parsed_content && !page.status.includes("page_not_found")) {
                            write(page.parsed_content);
                        } else {
                            const title = `${ address.namespace }:${ address.name }`;

                            write(`<span style="font-family: monospace; color: var(--color-red)">! Template: page <a class="ui-text monospace" href="/${ title }">${ title }</a> not found !</span>`);
                        }

                        flag_awaiting_template_info = false;
                        flag_ignore_all_chars = false;

                        i += 1;
                    }
                } else {
                    write(c);
                }
            } break;

            case ']': {
                if(input[i + 1] === ']') {
                    // Link insertion
                    const link_params = input.substring(flag_link_info_start_pos, i).split("|");

                    const address = pageTitleParser(link_params[0]);
                    const title = `${ address.namespace }:${ address.name }`;

                    // TODO @performance like this for now. I'll have to fix it though, this is wasting time
                    const link_text = link_params[1]
                    ? (await renderWikitext(link_params[1])).content
                    : title;

                    write(`<a class="ui-text" href="/${ title }">${ link_text }</a>`);

                    flag_awaiting_link_info = false;
                    flag_ignore_all_chars = false;

                    i += 1;
                } else {
                    write(c);
                }
            } break;

            case ' ': {
                if(flag_newline_firstchar) {
                    break;
                }

                // Skip spaces at the beginning of <h1-6> tags
                if(flag_heading_open && !flag_heading_firstchar_found) {
                    break;
                }

                // Skip spaces at the beginning of list items
                if(flag_ol_depth !== 0 && !flag_li_firstchar_found) {
                    break;
                }

                // Skip spaces at the beginning of indent items
                if(flag_dl_depth !== 0 && !flag_dd_firstchar_found) {
                    break;
                }

                write(c);
            } break;

            // Any other char (this case should be as fast as possible)
            default: {
                // Reset some flags
                flag_newline_firstchar = false;

                if(flag_heading_open) {
                    flag_heading_firstchar_found = true;
                }

                if(flag_ol_depth !== 0) {
                    flag_li_firstchar_found = true;
                }

                if(flag_dl_depth !== 0) {
                    flag_dd_firstchar_found = true;
                }

                // Write this char to the final string, it's just content
                if(!flag_ignore_all_chars) write(c);
            }
        }

        i += 1;
    }

    // Add the last paragraph
    if(flag_paragraphs_count !== 0) {
        // TODO @performance
        final_content = "<p>" + final_content;

        final_content += "</p>";
    }

    if(add_tag) final_content += "</div>";

    const bench_time_diff = process.hrtime(bench_time);

    // console.log(`renderWikitext: ${ (bench_time_diff[0] * 1e9 + bench_time_diff[1]) / 1000000 }ms`);

    return {
        content: final_content
    }
}
import * as Page from "./page";
import { pageTitleParser } from "./routes";

export interface WikitextRendererOutput {
    content: string;
    render_time_ms?: number;
}

export async function renderWikitext(input: string, template_params: any, add_tag: boolean = false): Promise<WikitextRendererOutput> {
    // "Set the timer" (not really) for the benchmark
    const bench_time = process.hrtime();

    let final_content: string = "";

    if(add_tag) final_content += "<div class=\"wiki-content\">";

    // Index of the char in the input (raw) content string
    let i = 0;

    // Char we are currently working on
    let c;

    const input_len = input.length;

    let buffer_str = "";

    // flags - main
    let flag_write_to_buffer = false;

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

    // Function for writing chars (or strings, thanks javascript for not having a char type >:( ) to the buffer or the final document
    const write = (char: string) => {
        if(flag_write_to_buffer) buffer_str += char;
        else final_content += char;
    };

    // Go through all the chars
    while(i < input_len) {
        c = input.charAt(i);

        switch(c) {
            /* New line. Close some open tags */
            case '\n': {
                // End of ordered list
                if(flag_ol_depth !== 0 && input[i + 1] !== '#') {
                    write("</li></ol>".repeat(flag_ol_depth - 1));
                    if(flag_close_li_count) write("</li>".repeat(flag_close_li_count));
                    write("</li></ol>");

                    flag_ol_depth = 0;
                    flag_close_li_count = 0;
                    flag_li_open = false;
                    flag_li_firstchar_found = false;
                }

                // End of unordered list
                if(flag_ul_depth !== 0 && input[i + 1] !== '*') {
                    write("</li></ul>".repeat(flag_ul_depth - 1));
                    if(flag_close_li_count) write("</li>".repeat(flag_close_li_count));
                    write("</li></ul>");

                    flag_ul_depth = 0;
                    flag_close_li_count = 0;
                    flag_li_open = false;
                    flag_li_firstchar_found = false;
                }

                // End of definitions list
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
                        flag_paragraph_not_open = true;
                        final_content += "</p>";
                    } else if(flag_paragraph_not_open) {
                        flag_paragraph_not_open = false;
                        final_content += "<p>";
                    }  else {
                        final_content += "</p><p>";
                    }
                }

                // The next char will be the first on this new line, set the appropriate flag
                flag_newline_firstchar = true;
            } break;

            /* Heading (== Contents ==) */
            case '=': {
                // This is not a first char in this line and a heading is not currenly open
                // That means that this equals sign is just a char somewhere in the text, we can just write it and don't bother
                if(!flag_newline_firstchar && !flag_heading_open) {
                    write(c);
                    break;
                }

                // Number of consecutive equals signs we have found
                let eqs_n = 1;

                // Find how many consecutive equals signs there are in this line
                while(input[i + eqs_n] === '=') {
                    eqs_n += 1;
                }

                if(flag_heading_open) {
                    // The heading is already opened, which means that these are the closing equals signs
                    // Close the heading
                    flag_heading_open = false;
                    flag_heading_firstchar_found = false;

                    write(`</h${ eqs_n }>`);
                } else {
                    // The heading is not currently opened. These are the opening equals signs
                    flag_heading_open = true;

                    write(`<h${ eqs_n }>`);
                }

                // Move forward for the number of equals signs we have found
                // -1 because we +1 at the end of this while loop
                i += eqs_n - 1;
            } break;

            /* Bold ('''something''') and italics (''something'') text */
            case '\'': {
                // Number of consecutive apostrophes we have found
                let aps_n = 1;

                // Find how many consecutive apostrophes there are in this line
                while(input[i + aps_n] === "'") {
                    aps_n += 1;
                }

                if(aps_n === 1) {
                    // Just one consecutive apostrophe - just write it, no modifications intended

                    write(c);
                } else if(aps_n === 2) {
                    // Two apostrophes - italics

                    if(flag_italic_open) {
                        write("</i>");
                        flag_italic_open = false;
                    } else {
                        write("<i>");
                        flag_italic_open = true;
                    }
                } else if(aps_n === 3) {
                    // Three apostrophes - Bold

                    if(flag_strong_open) {
                        write("</strong>");
                        flag_strong_open = false;
                    } else {
                        write("<strong>");
                        flag_strong_open = true;
                    }
                } else if(aps_n === 5) {
                    // Five apostrophes - Bold and italics

                    if(flag_strongitalic_open) {
                        write("</i></strong>");
                        flag_strongitalic_open = false;
                    } else {
                        write("<strong><i>");
                        flag_strongitalic_open = true;
                    }
                }

                // Move forward for the number of apostrophes we have found
                // -1 because we +1 at the end of this while loop
                i += aps_n - 1;
            } break;

            /* Unordered list item */
            case '*': {
                // This is not a first char, which means that this is just some asterisk in the middle of the text
                // To make a list item, an asterisk must be a first char in the line
                if(!flag_newline_firstchar) {
                    write(c);
                    break;
                }

                // Number of consecutive asterisks we have found
                let asterisks_count = 1;

                // Find how many consecutive asterisks there are in this line
                while(input[i + asterisks_count] === '*') {
                    asterisks_count += 1;
                }

                // Item depth info (how many asterisks are preceding the text)
                let depth_change = 0;
                let depth_inc = false;
                let depth_dec = false;

                let first_star = false;

                // The depth has changed
                if(asterisks_count !== flag_ul_depth) {
                    depth_change = Math.abs(asterisks_count - flag_ul_depth);

                    if(flag_ul_depth === 0) {
                        // Depth changed from 0, which means that the list was not open at all

                        flag_ul_depth += depth_change;
                        first_star = true;

                        write("<ul><li>");
                    } else if(asterisks_count > flag_ul_depth) {
                        // Depth increased

                        depth_inc = true;
                        flag_ul_depth += depth_change;
                    } else {
                        // Depth decreased

                        depth_dec = true;
                        flag_ul_depth -= depth_change;
                    }
                }

                if(flag_li_open) {
                    // The list item is currently open, which means that we have to close it, because we are creating a new one

                    flag_li_open = false;
                    flag_li_firstchar_found = false;

                    if(depth_inc) { write("<ul><li>".repeat(depth_change)); }
                    else if(depth_dec) { write("</li></ul>".repeat(depth_change));  write("<li>"); flag_close_li_count += 1; }
                    else /* Depth unchanged */ { write("</li><li>"); }
                } else {
                    // The list item is not currently open, no need to close anything

                    flag_li_open = true;

                    if(!first_star) {
                        if(depth_inc) { write("<ul><li>".repeat(depth_change)); }
                        else if(depth_dec) { write("</li></ul>".repeat(depth_change)); write("<li>"); flag_close_li_count += 1; }
                        else /* Depth unchanged */ { write("</li><li>"); }
                    }
                }

                // Move forward for the number of asterisks we have found
                // -1 because we +1 at the end of this while loop
                i += asterisks_count - 1;
            } break;

            case '#': {
                // This is not a first char, which means that this is just some hash symbol in the middle of the text
                // To make a list item, a hash symbol must be a first char in the line
                if(!flag_newline_firstchar) {
                    write(c);
                    break;
                }

                // Number of consecutive hash signs we have found
                let hashes_count = 1;

                // Find how many consecutive hash signs there are in this line
                while(input[i + hashes_count] === '#') {
                    hashes_count += 1;
                }

                // Item depth info (how many hash signs are preceding the text)
                let depth_change = 0;
                let depth_inc = false;
                let depth_dec = false;

                let first_hash = false;

                // The depth has changed
                if(hashes_count !== flag_ol_depth) {
                    depth_change = Math.abs(hashes_count - flag_ol_depth);

                    if(flag_ol_depth === 0) {
                        // Depth changed from 0, which means that the list was not open at all

                        flag_ol_depth += depth_change;
                        first_hash = true;

                        write("<ol><li>");
                    } else if(hashes_count > flag_ol_depth) {
                        // Depth increased

                        depth_inc = true;
                        flag_ol_depth += depth_change;
                    } else {
                        // Depth decreased

                        depth_dec = true;
                        flag_ol_depth -= depth_change;
                    }
                }

                if(flag_li_open) {
                    // The list item is currently open, which means that we have to close it, because we are creating a new one

                    flag_li_open = false;
                    flag_li_firstchar_found = false;

                    if(depth_inc) { write("<ol><li>".repeat(depth_change)); }
                    else if(depth_dec) { write("</li></ol>".repeat(depth_change)); write("<li>"); flag_close_li_count += 1; }
                    else /* Depth unchanged */ { write("</li><li>"); }
                } else {
                    // The list item is not currently open, no need to close anything

                    flag_li_open = true;

                    if(!first_hash) {
                        if(depth_inc) { write("<ol><li>".repeat(depth_change)); }
                        else if(depth_dec) { write("</li></ol>".repeat(depth_change)); write("<li>"); flag_close_li_count += 1; }
                        else /* Depth unchanged */ { write("</li><li>"); }
                    }
                }

                // Move forward for the number of hash signs we have found
                // -1 because we +1 at the end of this while loop
                i += hashes_count - 1;
            } break;

            case ':': {
                // This is not a first char, which means that this is just some colon in the middle of the text
                // To make a list item, a colon must be a first char in the line
                if(!flag_newline_firstchar) {
                    write(c);
                    break;
                }

                // Number of consecutive colons we have found
                let colons_count = 1;

                // Find how many consecutive colons there are in this line
                while(input[i + colons_count] === ':') {
                    colons_count += 1;
                }

                // Item depth info (how many colons are preceding the text)
                let depth_change = 0;
                let depth_inc = false;
                let depth_dec = false;

                let first_colon = false;

                // The depth has changed
                if(colons_count !== flag_dl_depth) {
                    depth_change = Math.abs(colons_count - flag_dl_depth);

                    if(flag_dl_depth === 0) {
                        // Depth changed from 0, which means that the list was not open at all

                        flag_dl_depth += depth_change;
                        first_colon = true;

                        write("<dl><dd>");
                    } else if(colons_count > flag_dl_depth) {
                        // Depth increased

                        depth_inc = true;
                        flag_dl_depth += depth_change;
                    } else {
                        // Depth decreased

                        depth_dec = true;
                        flag_dl_depth -= depth_change;
                    }
                }

                if(flag_dd_open) {
                    // The list item is currently open, which means that we have to close it, because we are creating a new one

                    flag_dd_open = false;
                    flag_dd_firstchar_found = false;

                    if(depth_inc) { write("<dl><dd>".repeat(depth_change)); }
                    else if(depth_dec) { write("</dd></dl>".repeat(depth_change)); write("<dd>"); flag_close_dd_count += 1; }
                    else /* Depth unchanged */ { write("</dd><dd>"); }
                } else {
                    // The list item is not currently open, no need to close anything

                    flag_dd_open = true;

                    if(!first_colon) {
                        if(depth_inc) { write("<dl><dd>".repeat(depth_change)); }
                        else if(depth_dec) { write("</dd></dl>".repeat(depth_change)); write("<dd>"); flag_close_dd_count += 1; }
                        else /* Depth unchanged */ { write("</dd><dd>"); }
                    }
                }

                // Move forward for the number of colons we have found
                // -1 because we +1 at the end of this while loop
                i += colons_count - 1;
            } break;

            /* Template insertion or template variable (opening) */
            case '{': {
                if(input[i + 1] === '{') {
                    // Just write everything after the {{ or {{{ to the buffer
                    flag_write_to_buffer = true;

                    if(input[i + 2] === '{') {
                        // Template variable ({{{2}}})
                        i += 2;
                    } else {
                        // Template insertion ({{Main:time}})
                        i += 1;
                    }
                } else {
                    // Just a { symbol, write it
                    write(c);
                }
            } break;

            /* Link ([[User:admin]]) (opening) */
            case '[': {
                if(input[i + 1] === '[') {
                    // Just write everything after the [[ to the buffer
                    flag_write_to_buffer = true;

                    i += 1;
                } else {
                    // Just a [ symbol, write it
                    write(c);
                }
            } break;

            /* Template insertion or template variable (closing) */
            case '}': {
                if(input[i + 1] === '}') {
                    if(input[i + 2] === '}') {
                        // Template variable ({{{2}}})

                        // Get the name of the template variable from the buffer
                        // We wrote everything to the buffer when we came across the opening parens
                        const name = buffer_str;

                        // We got the name from the buffer and don't need it anymore. Disable writing to buffer and reset it
                        buffer_str = "";
                        flag_write_to_buffer = false;

                        // Get the param by it's name or write just it's name if such param is not provided
                        // (now we write directly to the document)
                        write(template_params[name] || `{{{${ name }}}}`)

                        i += 2;
                    } else {
                        // Template insertion ({{Main:time}})
                        // Format for the template: {{Namespace:Name of the template to link|some param with id 1|some param with
                        // id 2|namedparam=some param with id namedparam|...}}

                        // Get the name of the template (param at index 0) and all params for that template (index 1-...)
                        // We wrote everything to the buffer when we came across the opening parens
                        const raw_template_params = buffer_str.split("|");

                        // Create an object that will hold all the params in the correct format
                        // { param_name_or_index: param_value_as_string }
                        const template_params_obj: { [name: string]: string } = {};

                        // Go through all the raw params (just a string array) and figure out the format of the param
                        // Ex. {{SomeTemplate|max|john|bob}} or {{SomeTemplate|name1=max|name2=john|name3=bob}}
                        // tslint:disable-next-line: forin
                        for(let name in raw_template_params) {
                            let value = raw_template_params[name];

                            // Check if param contains it's name ({{SomeTemplate|name=value}} format)
                            const eq_pos = raw_template_params[name].indexOf("=");

                            if(eq_pos > -1) {
                                name = value.substring(0, eq_pos);
                                value = value.substring(eq_pos + 1);
                            }

                            // TODO @performance we render each and every param, even if it just contains clear text
                            value = (await renderWikitext(value, {})).content;
                            template_params_obj[name] = value;
                        }

                        // We got all the params from the buffer and don't need it anymore. Disable writing to buffer and reset it
                        flag_write_to_buffer = false;
                        buffer_str = "";

                        // Get the actual template. Parse the title and get the page
                        const address = pageTitleParser(template_params_obj[0], "Template");
                        // TODO @placeholder client is always {}
                        // TODO @cleanup it might be a good idea to .catch() here
                        // @ts-ignore
                        const page = await Page.get(address, {}, template_params_obj, false);

                        // Check if template exists
                        if(page && page.parsed_content && !page.status.includes("page_not_found")) {
                            // It does, write the parsed content of the template to the document
                            // All params are already placed in their appropriate places
                            write(page.parsed_content);
                        } else {
                            write(`<span style="font-family: monospace; color: var(--color-red)">!! <a class="ui-text monospace" href="/${ address.title }">${ address.title }</a> !!</span>`);
                        }

                        i += 1;
                    }
                } else {
                    // Just a } symbol, write it
                    write(c);
                }
            } break;

            /* Link ([[User:admin]]) (closing) */
            case ']': {
                if(input[i + 1] === ']') {
                    // Link insertion
                    // Format for the link: [[Namespace:Some page to link to|Text for that link (optional)]]

                    // Get the name of the page to link to (param at index 0) and all params for that link (index 1-...)
                    // We wrote everything to the buffer when we came across the opening parens
                    const link_params = buffer_str.split("|");

                    // Parse the title and get the address of the link
                    const address = pageTitleParser(link_params[0]);

                    // We got all the params from the buffer and don't need it anymore. Disable writing to buffer and reset it
                    flag_write_to_buffer = false;
                    buffer_str = "";

                    // Text for the link (if provided - it's the first argument, if not - just set the text to the link address)
                    const link_text = link_params[1] || address.title;

                    // Write the link to the document
                    write(`<a class="ui-text" href="/${ address.title }">${ link_text }</a>`);

                    i += 1;
                } else {
                    // Just a ] symbol, write it
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

                // We will now print this char to the buffer or the document, so any succeeding chars are not first anymore
                flag_newline_firstchar = false;

                // If heading tag is open, flag that we have found the first char for that heading
                if(flag_heading_open) {
                    flag_heading_firstchar_found = true;
                }

                // If (un)ordered list is being created, flag that we have found the first char for the list item
                if(flag_ol_depth !== 0 || flag_ul_depth !== 0) {
                    flag_li_firstchar_found = true;
                }

                // If definition list is being created, flag that we have found the first char for the list item
                if(flag_dl_depth !== 0) {
                    flag_dd_firstchar_found = true;
                }

                // Write this char to the buffer or the docyment, it's just content
                write(c);
            }
        }

        i += 1;
    }

    // Add the last paragraph to the document, if there are paragraphs in the document
    if(flag_paragraphs_count !== 0) {
        // TODO @performance
        final_content = "<p>" + final_content;

        final_content += "</p>";
    }

    // Add the closing tag
    if(add_tag) final_content += "</div>";

    const bench_time_diff = process.hrtime(bench_time);

    return {
        content: final_content,
        render_time_ms: (bench_time_diff[0] * 1e9 + bench_time_diff[1]) / 1e6
    }
}
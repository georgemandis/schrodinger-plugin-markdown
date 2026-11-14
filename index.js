// Markdown plugin for Schrodinger
// Converts between Markdown and HTML.

// --- Markdown to HTML ---

function markdownToHtml(md) {
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;

    function inline(text) {
        return text
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            .replace(/~~(.+?)~~/g, '<del>$1</del>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    while (i < lines.length) {
        const line = lines[i];

        if (line.trim() === '') { i++; continue; }

        const fenceMatch = line.match(/^(`{3,}|~{3,})(\S*)/);
        if (fenceMatch) {
            const fence = fenceMatch[1][0];
            const fenceLen = fenceMatch[1].length;
            const lang = fenceMatch[2];
            const codeLines = [];
            i++;
            while (i < lines.length) {
                if (lines[i].startsWith(fence.repeat(fenceLen)) && lines[i].trim().length === fenceLen) { i++; break; }
                codeLines.push(lines[i].replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));
                i++;
            }
            const langAttr = lang ? ` class="language-${lang}"` : '';
            out.push(`<pre><code${langAttr}>${codeLines.join('\n')}</code></pre>`);
            continue;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            out.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`);
            i++; continue;
        }

        if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
            out.push('<hr />');
            i++; continue;
        }

        if (line.startsWith('> ') || line === '>') {
            const bqLines = [];
            while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
                bqLines.push(lines[i].replace(/^>\s?/, ''));
                i++;
            }
            out.push(`<blockquote>${markdownToHtml(bqLines.join('\n'))}</blockquote>`);
            continue;
        }

        if (/^[\-\*\+]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^[\-\*\+]\s+/.test(lines[i])) {
                items.push(inline(lines[i].replace(/^[\-\*\+]\s+/, '')));
                i++;
            }
            out.push(`<ul>${items.map(li => `<li>${li}</li>`).join('')}</ul>`);
            continue;
        }

        if (/^\d+\.\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
                items.push(inline(lines[i].replace(/^\d+\.\s+/, '')));
                i++;
            }
            out.push(`<ol>${items.map(li => `<li>${li}</li>`).join('')}</ol>`);
            continue;
        }

        const pLines = [];
        while (i < lines.length && lines[i].trim() !== '' &&
               !lines[i].match(/^(#{1,6}\s|```|~~~|>\s|[-*+]\s|\d+\.\s|---+|___+|\*\*\*+)/) &&
               !lines[i].match(/^(`{3,}|~{3,})/)) {
            pLines.push(lines[i]);
            i++;
        }
        if (pLines.length) {
            out.push(`<p>${inline(pLines.join('\n'))}</p>`);
        }
    }

    return out.join('\n');
}

// --- HTML to Markdown ---
//
// Walks a parsed DOM rather than pattern-matching tags. Clipboard HTML from
// browsers and editors carries attributes on nearly every element
// (`<strong style="...">`, `<li dir="auto">`) and often expresses formatting
// purely through inline styles (Google Docs uses `<span style="font-weight:700">`),
// neither of which a tag regex can see.

const MD_SKIP = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'TITLE', 'NOSCRIPT', 'TEMPLATE']);
const MD_BLOCK = new Set([
    'P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV',
    'FIGURE', 'FIGCAPTION', 'ADDRESS', 'DL', 'DT', 'DD', 'DETAILS', 'SUMMARY', 'FORM'
]);

// Collapse runs of blank lines and strip trailing whitespace, leaving fenced
// code blocks untouched (blank lines and trailing spaces are significant there).
function tidyMarkdown(text) {
    const out = [];
    let fence = null;
    let blank = 0;
    for (const raw of text.split('\n')) {
        const fenceMatch = raw.match(/^[ >]*(`{3,}|~{3,})/);
        if (fence) {
            out.push(raw);
            if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
            continue;
        }
        if (fenceMatch) fence = fenceMatch[1];
        // Keep the two trailing spaces that mark a hard line break.
        const hardBreak = /\S {2}$/.test(raw);
        const line = raw.replace(/[ \t]+$/, '') + (hardBreak ? '  ' : '');
        if (line.trim() === '') {
            blank++;
            if (blank > 1) continue;
            out.push('');
        } else {
            blank = 0;
            out.push(line);
        }
    }
    return out.join('\n').replace(/^\n+|\s+$/g, '');
}

function htmlToMarkdown(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const styleOf = el => (el.getAttribute('style') || '').toLowerCase();

    function isBold(el) {
        const weight = (styleOf(el).match(/font-weight:\s*([a-z0-9]+)/) || [])[1];
        // Google Docs wraps the whole clip in <b style="font-weight:normal">.
        if (weight) return weight === 'bold' || weight === 'bolder' || parseInt(weight, 10) >= 600;
        return el.tagName === 'B' || el.tagName === 'STRONG';
    }
    function isItalic(el) {
        const style = (styleOf(el).match(/font-style:\s*([a-z]+)/) || [])[1];
        if (style) return style === 'italic' || style === 'oblique';
        return el.tagName === 'I' || el.tagName === 'EM';
    }
    function isStrike(el) {
        return el.tagName === 'S' || el.tagName === 'DEL' || el.tagName === 'STRIKE' ||
            /text-decoration[^;]*line-through/.test(styleOf(el));
    }

    // Put emphasis markers tight against the text; markers next to whitespace
    // (`** bold **`) are not recognized by Markdown parsers.
    function wrap(mark, text) {
        const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
        if (!m[2]) return text;
        return m[1] + mark + m[2] + mark + m[3];
    }

    function escapeText(text) {
        return text
            .replace(/([\\`*])/g, '\\$1')
            // Underscores only start emphasis at a word boundary; leave snake_case alone.
            .replace(/(^|[^A-Za-z0-9])_|_(?=[^A-Za-z0-9]|$)/g, (m, before) =>
                before !== undefined ? before + '\\_' : '\\_');
    }

    function children(el, ctx) {
        let out = '';
        for (const child of el.childNodes) {
            let piece = node(child, ctx);
            // Whitespace between block elements is layout, not content.
            if (out.endsWith('\n')) piece = piece.replace(/^[ \t]+/, '');
            out += piece;
        }
        return out;
    }

    function codeSpan(text) {
        const longest = Math.max(0, ...(text.match(/`+/g) || []).map(run => run.length));
        const fence = '`'.repeat(longest + 1);
        const pad = longest > 0 ? ' ' : '';
        return fence + pad + text + pad + fence;
    }

    function codeBlock(el) {
        const code = el.querySelector('code');
        const cls = ((code && code.getAttribute('class')) || '') + ' ' + (el.getAttribute('class') || '');
        const lang = (cls.match(/(?:language|lang|highlight-source)-([\w+#-]+)/) || [])[1] || '';
        const text = el.textContent.replace(/\n+$/, '');
        const longest = Math.max(2, ...(text.match(/`+/g) || []).map(run => run.length));
        const fence = '`'.repeat(longest + 1);
        return `\n\n${fence}${lang}\n${text}\n${fence}\n\n`;
    }

    function list(el, ctx) {
        const ordered = el.tagName === 'OL';
        let index = parseInt(el.getAttribute('start') || '1', 10) || 1;
        const lines = [];
        for (const child of el.children) {
            if (child.tagName !== 'LI') {
                // A list nested directly inside a list (no <li> wrapper).
                const nested = tidyMarkdown(node(child, ctx));
                if (nested) lines.push(nested.split('\n').map(l => '  ' + l).join('\n'));
                continue;
            }
            const marker = ordered ? `${index++}. ` : '- ';
            const indent = ' '.repeat(marker.length);
            const body = tidyMarkdown(children(child, ctx)).replace(/\n{2,}/g, '\n');
            const [first, ...rest] = body.split('\n');
            lines.push(marker + (first || '') + rest.map(l => '\n' + indent + l).join(''));
        }
        return '\n\n' + lines.join('\n') + '\n\n';
    }

    function table(el, ctx) {
        const rows = [...el.querySelectorAll('tr')].filter(tr => tr.closest('table') === el);
        if (!rows.length) return children(el, ctx);
        const cell = td => tidyMarkdown(children(td, ctx)).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|');
        const grid = rows.map(tr => [...tr.children].filter(c => c.tagName === 'TD' || c.tagName === 'TH').map(cell));
        const width = Math.max(...grid.map(r => r.length));
        const line = r => '| ' + Array.from({ length: width }, (_, i) => r[i] || '').join(' | ') + ' |';
        const [head, ...body] = grid;
        return '\n\n' + [line(head), line(Array(width).fill('---')), ...body.map(line)].join('\n') + '\n\n';
    }

    function node(n, ctx) {
        if (n.nodeType === 3) return escapeText(n.nodeValue.replace(/\s+/g, ' '));
        if (n.nodeType !== 1 || MD_SKIP.has(n.tagName)) return '';

        const tag = n.tagName;
        if (/^H[1-6]$/.test(tag)) {
            const text = children(n, { ...ctx, bold: true }).replace(/\s+/g, ' ').trim();
            return text ? `\n\n${'#'.repeat(+tag[1])} ${text}\n\n` : '';
        }
        if (tag === 'BR') return n.getAttribute('class') === 'Apple-interchange-newline' ? '' : '  \n';
        if (tag === 'HR') return '\n\n---\n\n';
        if (tag === 'PRE') return codeBlock(n);
        if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP' || tag === 'TT') return codeSpan(n.textContent);
        if (tag === 'UL' || tag === 'OL') return list(n, ctx);
        if (tag === 'TABLE') return table(n, ctx);
        if (tag === 'BLOCKQUOTE') {
            const inner = tidyMarkdown(children(n, ctx));
            return inner ? '\n\n' + inner.split('\n').map(l => (l ? '> ' + l : '>')).join('\n') + '\n\n' : '';
        }
        if (tag === 'IMG') {
            const alt = n.getAttribute('alt') || '';
            const src = n.getAttribute('src') || '';
            // Inline data: images would dump kilobytes of base64 into the text.
            return !src || src.startsWith('data:') ? alt : `![${alt}](${src})`;
        }
        if (tag === 'INPUT') {
            return n.getAttribute('type') === 'checkbox' ? (n.hasAttribute('checked') ? '[x] ' : '[ ] ') : '';
        }
        if (tag === 'A') {
            const text = children(n, ctx).trim();
            const href = n.getAttribute('href') || '';
            if (!text || !href || /^javascript:/i.test(href) || href.startsWith('#')) return text;
            return text === href ? `<${href}>` : `[${text}](${href})`;
        }

        let text = children(n, {
            bold: ctx.bold || isBold(n),
            italic: ctx.italic || isItalic(n),
            strike: ctx.strike || isStrike(n),
        });
        // Only the outermost element carrying a given emphasis emits the marker.
        if (isStrike(n) && !ctx.strike) text = wrap('~~', text);
        if (isItalic(n) && !ctx.italic) text = wrap('*', text);
        if (isBold(n) && !ctx.bold) text = wrap('**', text);
        if (MD_BLOCK.has(tag)) return '\n\n' + text.trim() + '\n\n';
        return text;
    }

    return tidyMarkdown(children(doc.body, { bold: false, italic: false, strike: false }));
}

// --- Plugin Export ---

export default {
    id: "markdown",
    label: "Markdown",
    modes: [
        { id: "to-html", label: "To HTML", default: true },
        { id: "to-markdown", label: "To Markdown" }
    ],
    // Called once without a mode (is the plugin relevant at all?) and once per
    // mode on Schrodinger 0.2+, so each direction is only offered when its
    // input is actually on the clipboard.
    appliesTo(entry, mode) {
        const has = format => entry.formats.some(f => f.format === format);
        if (mode === "to-markdown") return has(schrodinger.htmlFormat());
        if (mode === "to-html") return has(schrodinger.textFormat());
        return has(schrodinger.textFormat()) || has(schrodinger.htmlFormat());
    },
    async apply(entry, mode) {
        if (mode === "to-markdown") {
            // HTML -> Markdown. A clip with no HTML flavor is already plain
            // text; pass it through rather than parsing it as markup (which
            // would collapse its line breaks).
            let html;
            try {
                const buf = await schrodinger.readFormat(entry, schrodinger.htmlFormat());
                html = schrodinger.decode(buf);
            } catch {
                const buf = await schrodinger.readFormat(entry, schrodinger.textFormat());
                return [{ format: schrodinger.textFormat(), data: buf }];
            }
            const markdown = htmlToMarkdown(html);
            return [
                { format: schrodinger.textFormat(), data: schrodinger.encode(markdown) }
            ];
        }

        // Default: Markdown -> HTML
        const buf = await schrodinger.readFormat(entry, schrodinger.textFormat());
        const markdown = schrodinger.decode(buf);
        const html = markdownToHtml(markdown);
        return [
            { format: schrodinger.htmlFormat(), data: schrodinger.encode(html) }
        ];
    }
};

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

function htmlToMarkdown(html) {
    let md = html;

    // Pre/code blocks first (before other transforms eat the content)
    md = md.replace(/<pre><code(?:\s+class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/gi,
        (_, lang, code) => {
            const decoded = code.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
            return '\n```' + (lang || '') + '\n' + decoded + '\n```\n';
        });

    // Headings
    md = md.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, content) => {
        return '#'.repeat(parseInt(level)) + ' ' + content.trim() + '\n\n';
    });

    // Bold + italic
    md = md.replace(/<strong><em>([\s\S]*?)<\/em><\/strong>/gi, '***$1***');
    md = md.replace(/<em><strong>([\s\S]*?)<\/strong><\/em>/gi, '***$1***');

    // Bold
    md = md.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**');

    // Italic
    md = md.replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*');

    // Strikethrough
    md = md.replace(/<del>([\s\S]*?)<\/del>/gi, '~~$1~~');
    md = md.replace(/<s>([\s\S]*?)<\/s>/gi, '~~$1~~');

    // Inline code
    md = md.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');

    // Images (before links)
    md = md.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');

    // Links
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

    // Unordered lists
    md = md.replace(/<ul>([\s\S]*?)<\/ul>/gi, (_, content) => {
        return content.replace(/<li>([\s\S]*?)<\/li>/gi, '- $1\n').trim() + '\n\n';
    });

    // Ordered lists
    md = md.replace(/<ol>([\s\S]*?)<\/ol>/gi, (_, content) => {
        let idx = 0;
        return content.replace(/<li>([\s\S]*?)<\/li>/gi, () => {
            idx++;
            return `${idx}. ` + arguments[1] + '\n';
        }).trim() + '\n\n';
    });
    // Fix ordered list (the above closure doesn't capture properly in all engines)
    md = md.replace(/<ol>([\s\S]*?)<\/ol>/gi, (_, content) => {
        let idx = 0;
        const items = [];
        content.replace(/<li>([\s\S]*?)<\/li>/gi, (__, item) => {
            idx++;
            items.push(`${idx}. ${item.trim()}`);
        });
        return items.join('\n') + '\n\n';
    });

    // Blockquotes
    md = md.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
        return content.trim().split('\n').map(l => '> ' + l).join('\n') + '\n\n';
    });

    // Horizontal rules
    md = md.replace(/<hr\s*\/?>/gi, '---\n\n');

    // Paragraphs
    md = md.replace(/<p>([\s\S]*?)<\/p>/gi, '$1\n\n');

    // Line breaks
    md = md.replace(/<br\s*\/?>/gi, '\n');

    // Strip remaining tags
    md = md.replace(/<[^>]+>/g, '');

    // Decode entities
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&quot;/g, '"');
    md = md.replace(/&#39;/g, "'");

    // Clean up excessive newlines
    md = md.replace(/\n{3,}/g, '\n\n').trim();

    return md;
}

// --- Plugin Export ---

export default {
    id: "markdown",
    label: "Markdown",
    modes: [
        { id: "to-html", label: "To HTML", default: true },
        { id: "to-markdown", label: "To Markdown" }
    ],
    appliesTo(entry) {
        return entry.formats.some(f =>
            f.format === schrodinger.textFormat() || f.format === schrodinger.htmlFormat()
        );
    },
    async apply(entry, mode) {
        if (mode === "to-markdown") {
            // HTML -> Markdown: read HTML format, or fall back to text
            let html;
            try {
                const buf = await schrodinger.readFormat(entry, schrodinger.htmlFormat());
                html = schrodinger.decode(buf);
            } catch {
                const buf = await schrodinger.readFormat(entry, schrodinger.textFormat());
                html = schrodinger.decode(buf);
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

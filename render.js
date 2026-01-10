/**
 * mdpdf-link v0.9 - Minimal JavaScript Loader
 * Orchestrates: fetch, WASM init, and output delivery
 */

// State management
let pdfBlob = null;
let lastTypstSource = null;
let cmarkerAvailable = true;

const timings = {
    marks: {},
    counters: {},
};

// UI elements
const statusEl = document.getElementById('status');
const pdfContainer = document.getElementById('pdf-container');
const pdfViewer = document.getElementById('pdf-viewer');
const downloadBtn = document.getElementById('download-btn');

const urlParams = new URLSearchParams(window.location.search);
const rendererMode = urlParams.get('renderer') || 'auto';

/**
 * Update status message
 */
function updateStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = type;
}

function markTiming(name) {
    try {
        timings.marks[name] = performance.now();
    } catch {
        // ignore
    }
}

function incCounter(name, by = 1) {
    timings.counters[name] = (timings.counters[name] || 0) + by;
}

async function getRuntimeCache() {
    try {
        if (!('caches' in globalThis)) return null;
        return await caches.open('mdtypst-v1');
    } catch {
        return null;
    }
}

async function fetchWithCache(url, { timeoutMs = 0 } = {}) {
    const cache = await getRuntimeCache();

    if (cache) {
        try {
            const cached = await cache.match(url);
            if (cached) return cached.clone();
        } catch {
            // ignore cache read failures
        }
    }

    const controller = timeoutMs ? new AbortController() : null;
    const t = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
        const resp = await fetch(url, controller ? { signal: controller.signal } : undefined);
        if (cache && resp && resp.ok) {
            // Best-effort caching; ignore quota/errors.
            try {
                await cache.put(url, resp.clone());
            } catch {
                // ignore
            }
        }
        return resp;
    } finally {
        if (t) clearTimeout(t);
    }
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
        return { metadata: {}, content: content };
    }
    
    const yamlContent = match[1];
    const markdownContent = match[2];
    
    // Simple (flat) YAML parser for common key-value pairs.
    // Intentionally minimal: fixtures use plain scalars.
    const metadata = {};
    yamlContent.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const colonIndex = line.indexOf(':');
        if (colonIndex <= 0) return;

        const key = line.substring(0, colonIndex).trim();
        let raw = line.substring(colonIndex + 1).trim();
        raw = raw.replace(/^["']|["']$/g, '');

        if (raw === 'true') metadata[key] = true;
        else if (raw === 'false') metadata[key] = false;
        else if (/^-?\d+(?:\.\d+)?$/.test(raw)) metadata[key] = Number(raw);
        else metadata[key] = raw;
    });
    
    return { metadata, content: markdownContent };
}

function isTypstLength(value) {
    return typeof value === 'string' && /^-?\d+(?:\.\d+)?(pt|mm|cm|in)$/.test(value.trim());
}

function normalizePaper(value) {
    if (typeof value !== 'string') return null;
    const v = value.trim().toLowerCase();
    // Typst expects specific identifiers; accept common aliases.
    const alias = {
        letter: 'us-letter',
        legal: 'us-legal',
        tabloid: 'us-tabloid',
    };
    if (alias[v]) return alias[v];

    const allowed = new Set(['a3', 'a4', 'a5', 'us-letter', 'us-legal', 'us-tabloid']);
    if (allowed.has(v)) return v;
    return null;
}

function typstPreludeFromMetadata(metadata) {
    const paper = normalizePaper(metadata.paper) || 'a4';

    let marginX = '2.5cm';
    let marginY = '2.5cm';
    if (isTypstLength(metadata.margin)) {
        marginX = metadata.margin.trim();
        marginY = metadata.margin.trim();
    }
    if (isTypstLength(metadata.margin_x)) marginX = metadata.margin_x.trim();
    if (isTypstLength(metadata.margin_y)) marginY = metadata.margin_y.trim();

    const justify = typeof metadata.justify === 'boolean' ? metadata.justify : true;

    const font = typeof metadata.font === 'string' && metadata.font.trim() ? metadata.font.trim() : 'Libertinus Serif';
    const sizeRaw =
        typeof metadata.fontSize === 'string'
            ? metadata.fontSize
            : typeof metadata.font_size === 'string'
                ? metadata.font_size
                : null;
    const size = isTypstLength(sizeRaw) ? sizeRaw.trim() : '11pt';

    let prelude = '';
    prelude += `#set page(paper: "${escapeTypstString(paper)}", margin: (x: ${marginX}, y: ${marginY}))\n`;
    prelude += `#set text(font: "${escapeTypstString(font)}", size: ${size})\n`;
    prelude += `#set par(justify: ${justify ? 'true' : 'false'})\n\n`;
    return prelude;
}

function closeUnclosedBacktickFence(markdown) {
    // Some fixtures contain an opening ``` fence without a closing fence.
    // This is valid to test robustness, but it can trip downstream renderers.
    // If the number of fences is odd, append a closing fence.
    const fenceRegex = /^```/gm;
    let count = 0;
    while (fenceRegex.exec(markdown) !== null) count++;
    if (count % 2 === 1) {
        return `${markdown}\n\n\`\`\`\n`;
    }
    return markdown;
}

/**
 * Render Mermaid code blocks to SVG and return a map of virtual SVG asset paths.
 *
 * This enables deterministic client-side diagrams without relying on Typst plugins.
 * The SVG assets are later mounted into Typst's shadow FS via `$typst.mapShadow`.
 */
async function renderMermaidBlocksToSvgAssets(markdown) {
    const mermaidFenceRegex = /(^|\n)```mermaid\s*\n([\s\S]*?)\n```(?=\n|$)/g;
    const matches = [];
    let match;
    while ((match = mermaidFenceRegex.exec(markdown)) !== null) {
        matches.push({
            start: match.index + match[1].length,
            end: mermaidFenceRegex.lastIndex,
            code: match[2],
        });
    }

    if (matches.length === 0) {
        return { transformedMarkdown: markdown, svgAssets: [] };
    }

    updateStatus('Rendering Mermaid diagrams...');

    const localMermaid = new URL('./vendor/mermaid/mermaid.esm.min.mjs', import.meta.url);
    const cdnMermaid = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

    let mermaid;
    try {
        const probe = await fetch(localMermaid.href, { method: 'GET' }).catch(() => null);
        if (probe && probe.ok) {
            mermaid = (await import(localMermaid.href)).default;
        } else {
            mermaid = (await import(cdnMermaid)).default;
        }
    } catch (e) {
        console.warn('Failed to load Mermaid; falling back to CDN.', e);
        mermaid = (await import(cdnMermaid)).default;
    }
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

    const svgAssets = [];
    let transformed = '';
    let cursor = 0;

    for (let i = 0; i < matches.length; i++) {
        const { start, end, code } = matches[i];
        transformed += markdown.slice(cursor, start);

        try {
            const assetPath = `/assets/mermaid-${i}.svg`;
            const renderId = `mermaid-${Date.now()}-${i}`;
            const { svg } = await mermaid.render(renderId, code);

            svgAssets.push({ path: assetPath, svg });

            // Replace Mermaid fence with a regular Markdown image. cmarker will turn this into a Typst image.
            transformed += `\n![Mermaid diagram](${assetPath})\n`;
        } catch (e) {
            // Keep the original fence so fallback rendering can still proceed.
            console.warn('Failed to render Mermaid block; leaving as code fence.', e);
            transformed += markdown.slice(start, end);
        }
        cursor = end;
    }

    transformed += markdown.slice(cursor);
    return { transformedMarkdown: transformed, svgAssets };
}

function escapeTypstString(value) {
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '')
        .replace(/\t/g, '\\t')
        .replace(/"/g, '\\"');
}

function fnv1a32Hex(input) {
    // Small, stable hash for generating deterministic shadow FS paths.
    // Not cryptographic; just collision-resistant enough for typical asset sets.
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

function assetExtFromUrl(urlString) {
    try {
        const u = new URL(urlString, window.location.href);
        const path = u.pathname || '';
        const m = path.match(/\.(png|jpe?g|gif|svg|webp|bmp|tiff?|avif)$/i);
        return m ? `.${m[1].toLowerCase()}` : '.bin';
    } catch {
        return '.bin';
    }
}

function resolveLocalAsset(src, documentUrl) {
    try {
        if (!src) return null;

        // Skip data URLs.
        if (/^data:/i.test(src)) return null;

        // Virtual assets we mount ourselves (e.g. Mermaid SVGs).
        if (src.startsWith('/assets/')) {
            return { fetchUrl: null, shadowPath: src };
        }

        // Absolute remote URLs: mount into shadow FS under a safe synthetic path.
        if (/^https?:/i.test(src)) {
            // GitHub badge/image endpoints are commonly CORS-blocked in browsers.
            // Skip fetching them to avoid slowdowns; they will be replaced with text.
            try {
                const u = new URL(src);
                if (u.origin === 'https://github.com' || u.origin === 'https://www.github.com') {
                    return null;
                }
            } catch {
                // ignore
            }
            const shadowPath = `/assets/remote/${fnv1a32Hex(src)}${assetExtFromUrl(src)}`;
            return { fetchUrl: src, shadowPath };
        }

        let abs;
        // Root-relative paths.
        if (src.startsWith('/')) {
            abs = new URL(src, window.location.origin);
        } else if (src.startsWith('test/')) {
            // Our fixtures often use repo-root-relative paths without a leading slash.
            abs = new URL(`/${src}`, window.location.origin);
        } else {
            if (!documentUrl) return null;
            const base = new URL(documentUrl, window.location.href);
            abs = new URL(src, base);
        }

        // Same-origin assets can use their pathname directly. Cross-origin assets get remapped.
        if (abs.origin === window.location.origin) {
            return { fetchUrl: abs.toString(), shadowPath: abs.pathname };
        }

        const fetchUrl = abs.toString();

        // Same as above: github.com assets are usually blocked by CORS.
        try {
            if (abs.origin === 'https://github.com' || abs.origin === 'https://www.github.com') {
                return null;
            }
        } catch {
            // ignore
        }

        const shadowPath = `/assets/remote/${fnv1a32Hex(fetchUrl)}${assetExtFromUrl(fetchUrl)}`;
        return { fetchUrl, shadowPath };
    } catch {
        return null;
    }
}

async function mountAndRewriteImages(markdown, documentUrl, $typst) {
    if (!$typst || typeof $typst.mapShadow !== 'function') return markdown;

    markTiming('images:scan:start');

    // Markdown images: ![alt](src "title")
    const mdImageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+("[^"]*"|'[^']*'))?\)/g;
    // Basic HTML images: <img ... src="..." ...>
    const htmlImgRegex = /<img\b[^>]*\bsrc\s*=\s*("[^"]+"|'[^']+'|[^\s>]+)[^>]*>/gi;

    // Gather unique src strings as they appear in the document.
    const srcs = [];
    const seenSrc = new Set();

    {
        let m;
        while ((m = mdImageRegex.exec(markdown)) !== null) {
            const raw = m[2];
            if (!raw) continue;
            if (!seenSrc.has(raw)) {
                seenSrc.add(raw);
                srcs.push(raw);
            }
        }
    }

    {
        let m;
        while ((m = htmlImgRegex.exec(markdown)) !== null) {
            let raw = m[1];
            if (!raw) continue;
            raw = raw.replace(/^['"]|['"]$/g, '');
            if (!raw) continue;
            if (!seenSrc.has(raw)) {
                seenSrc.add(raw);
                srcs.push(raw);
            }
        }
    }

    const mounted = new Map(); // rawSrc -> shadowPath
    const failed = new Set();

    timings.counters.imagesTotal = srcs.length;

    const timeoutMs = 2500;
    const concurrency = 6;

    const runPool = async (tasks, limit) => {
        let idx = 0;
        const workers = Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, async () => {
            while (idx < tasks.length) {
                const current = idx++;
                await tasks[current]();
            }
        });
        await Promise.all(workers);
    };

    const tasks = srcs.map((rawSrc) => async () => {
        const resolved = resolveLocalAsset(rawSrc, documentUrl);
        if (!resolved) {
            failed.add(rawSrc);
            incCounter('imagesFailed');
            return;
        }

        if (resolved.fetchUrl == null) {
            mounted.set(rawSrc, resolved.shadowPath);
            incCounter('imagesMounted');
            return;
        }

        try {
            const resp = await fetchWithCache(resolved.fetchUrl, { timeoutMs });
            if (!resp.ok) {
                failed.add(rawSrc);
                incCounter('imagesFailed');
                return;
            }

            const buf = await resp.arrayBuffer();
            await $typst.mapShadow(resolved.shadowPath, new Uint8Array(buf));
            mounted.set(rawSrc, resolved.shadowPath);
            incCounter('imagesMounted');
        } catch {
            failed.add(rawSrc);
            incCounter('imagesFailed');
        }
    });

    await runPool(tasks, concurrency);
    markTiming('images:mounted');

    // Rewrite markdown so Typst only sees safe /assets/... paths.
    const rewrittenMd = markdown.replace(mdImageRegex, (_full, alt, src, title) => {
        const shadow = mounted.get(src);
        if (shadow) {
            return `![${alt}](${shadow}${title ? ` ${title}` : ''})`;
        }
        // If we couldn't fetch/mount the image, drop the image syntax to avoid Typst failing.
        const label = (alt && String(alt).trim()) ? String(alt).trim() : src;
        return `Image unavailable: ${label}`;
    });

    const rewrittenHtml = rewrittenMd.replace(htmlImgRegex, (fullTag) => {
        const srcMatch = fullTag.match(/\bsrc\s*=\s*("[^"]+"|'[^']+'|[^\s>]+)/i);
        if (!srcMatch) return 'Image unavailable';
        const raw = srcMatch[1].replace(/^['"]|['"]$/g, '');
        const shadow = mounted.get(raw);
        if (!shadow) {
            const altMatch = fullTag.match(/\balt\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i);
            const alt = altMatch ? altMatch[1].replace(/^['"]|['"]$/g, '') : '';
            return `Image unavailable: ${alt || raw}`;
        }

        // Replace only the src value; keep other attributes.
        return fullTag.replace(srcMatch[1], `"${shadow}"`);
    });

    return rewrittenHtml;
}

/**
 * Build a Typst document that renders Markdown through the Typst cmarker package.
 */
function markdownToTypstWithCmarker(markdown, metadata) {
    let typst = '';

    // Typst package: Markdown -> Typst content
    typst += `#import "@preview/cmarker:0.1.8": cmarker\n`;

    // Add metadata to Typst document
    if (metadata.title) {
        typst += `#set document(title: "${escapeTypstString(metadata.title)}")\n`;
    }
    if (metadata.author) {
        typst += `#set document(author: "${escapeTypstString(metadata.author)}")\n`;
    }

    // Basic document setup (overrideable via frontmatter)
    typst += typstPreludeFromMetadata(metadata);

    // Optional title page header
    if (metadata.title) {
        typst += `#align(center)[\n  #text(size: 24pt, weight: "bold")[${escapeTypstString(metadata.title)}]\n]\n`;
        if (metadata.author) {
            typst += `#align(center)[\n  #text(size: 12pt)[${escapeTypstString(metadata.author)}]\n]\n`;
        }
        if (metadata.date) {
            typst += `#align(center)[\n  #text(size: 10pt)[${escapeTypstString(metadata.date)}]\n]\n`;
        }
        typst += `\n`;
    }

    if (metadata.toc === true) {
        typst += `#outline()\n\n`;
    }

    // Render markdown through cmarker.
    // Override image in scope so paths resolve relative to our project/shadow FS.
    typst += `#cmarker.render(\n`;
    typst += `  "${escapeTypstString(markdown)}",\n`;
    typst += `  scope: (image: (source, alt: none, format: auto) => image(source, alt: alt, format: format))\n`;
    typst += `)\n`;

    return typst;
}

function markdownInlineToTypst(text) {
    // Minimal inline support for the bundled demo documents.
    // Convert Markdown emphasis to Typst emphasis markers:
    // - **bold** -> *bold*
    // - *italic* -> _italic_
    // - [text](url) -> #link("url")[text]
    // - `code` stays as-is
    const BOLD_OPEN = '\u0000B';
    const BOLD_CLOSE = '\u0000b';

    const LINK_OPEN = '\u0000L';
    const LINK_CLOSE = '\u0000l';

    const MATH_OPEN = '\u0000M';
    const MATH_CLOSE = '\u0000m';

    const inlineTextToTypst = (input) => {
        let out = String(input);

        // Escape characters that have structural meaning in Typst markup.
        // Do this before emphasis conversion.
        out = out
            .replace(/(?<!\\)@/g, '\\@')
            .replace(/(?<!\\)\$/g, '\\$')
            .replace(/(?<!\\)#/g, '\\#')
            .replace(/(?<!\\)\|/g, '\\|')
            .replace(/(?<!\\)`/g, '\\`')
            .replace(/(?<!\\)\[/g, '\\[')
            .replace(/(?<!\\)\]/g, '\\]');

        // Protect bold segments
        out = out.replace(/\*\*([^*]+?)\*\*/g, (_m, inner) => `${BOLD_OPEN}${inner}${BOLD_CLOSE}`);

        // Italic
        out = out.replace(/\*([^*]+?)\*/g, (_m, inner) => `_${inner}_`);

        // Any remaining '*' would open Typst emphasis and can break compilation
        // (fixtures include intentionally unclosed Markdown like `*italic`).
        // Escape them after we handled balanced markers.
        out = out.replace(/(?<!\\)\*/g, '\\*');

        // Restore bold
        out = out
            .replace(new RegExp(BOLD_OPEN, 'g'), '*')
            .replace(new RegExp(BOLD_CLOSE, 'g'), '*');

        return out;
    };

    let out = String(text);

    // Inline math: $...$ (keep dependency-free; treat as raw text in fallback mode).
    // We placeholder these before escaping so LaTeX-like content doesn't confuse Typst parsing.
    const math = [];
    const addMath = (content) => {
        const idx = math.push({ content }) - 1;
        return `${MATH_OPEN}${idx}${MATH_CLOSE}`;
    };
    out = out.replace(/\$(?!\s)([^$\n]+?)\$/g, (_m, inner) => addMath(inner));

    // Links: placeholder first, so later escaping doesn't break Typst link markup.
    // Support optional titles: [label](url "title")
    const links = [];
    const addLink = (url, label) => {
        const idx = links.push({ url, label }) - 1;
        return `${LINK_OPEN}${idx}${LINK_CLOSE}`;
    };

    // Autolinks: <https://example.org>
    out = out.replace(/<((?:https?:\/\/)[^>\s]+)>/g, (_m, url) => addLink(url, url));

    // Email links: <user@example.com>
    out = out.replace(/<([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>/gi, (_m, email) => {
        return addLink(`mailto:${email}`, email);
    });

    // Inline links: [label](url) and [label](url "title")
    out = out.replace(
        /\[([^\]]+)\]\(([^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)/g,
        (_m, label, url) => addLink(url, label),
    );

    // Convert remaining plain text.
    out = inlineTextToTypst(out);

    // Restore link placeholders.
    out = out.replace(new RegExp(`${LINK_OPEN}(\\d+)${LINK_CLOSE}`, 'g'), (_m, idxStr) => {
        const idx = Number(idxStr);
        const link = links[idx];
        if (!link) return '';
        return `#link("${escapeTypstString(link.url)}")[${inlineTextToTypst(link.label)}]`;
    });

    // Restore inline math placeholders.
    out = out.replace(new RegExp(`${MATH_OPEN}(\\d+)${MATH_CLOSE}`, 'g'), (_m, idxStr) => {
        const idx = Number(idxStr);
        const segment = math[idx];
        if (!segment) return '';
        const raw = `$${segment.content}$`;
        return `#raw("${escapeTypstString(raw)}")`;
    });

    return out;
}

function markdownToTypstFallback(markdown, metadata, documentUrl = null) {
    // Very small Markdown subset -> Typst markup.
    // This is used when Typst package fetching is unavailable and cmarker can't be imported.
    const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
    const blocks = [];

    let i = 0;
    const eatBlank = () => {
        while (i < lines.length && lines[i].trim() === '') i++;
    };

    const isFenceStart = (line) => line.startsWith('```');
    const isHeading = (line) => /^#{1,6}\s+/.test(line);
    const isUList = (line) => /^\s{0,3}[-*+]\s+/.test(line);
    const isOList = (line) => /^\s{0,3}\d+\.\s+/.test(line);
    const isImageOnly = (line) => /^!\[[^\]]*\]\([^)]+\)\s*$/.test(line.trim());
    const isHorizontalRule = (line) => /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line);
    const isDisplayMathFence = (line) => /^\s*\$\$\s*$/.test(line);
    const isDisplayMathSingleLine = (line) => /^\s*\$\$[\s\S]*\$\$\s*$/.test(line);

    while (i < lines.length) {
        eatBlank();
        if (i >= lines.length) break;

        const line = lines[i];

        // Code fence
        if (isFenceStart(line)) {
            const lang = line.slice(3).trim();
            i++;
            const codeLines = [];
            while (i < lines.length && !lines[i].startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            if (i < lines.length && lines[i].startsWith('```')) i++;
            const code = codeLines.join('\n');
            blocks.push({ type: 'code', lang, code });
            continue;
        }

        // Heading
        if (isHeading(line)) {
            const m = /^(#{1,6})\s+(.*)$/.exec(line);
            const level = m[1].length;
            const text = m[2].trim();
            blocks.push({ type: 'heading', level, text });
            i++;
            continue;
        }

        // Mermaid replacement results in a single image line
        if (isImageOnly(line)) {
            const m = /^!\[[^\]]*\]\(([^)]+)\)\s*$/.exec(line.trim());
            blocks.push({ type: 'image', src: m[1] });
            i++;
            continue;
        }

        // Display math: $$...$$ or fenced $$\n...\n$$
        if (isDisplayMathSingleLine(line)) {
            const trimmed = line.trim();
            const inner = trimmed.slice(2, -2).trim();
            blocks.push({ type: 'math', content: inner });
            i++;
            continue;
        }

        if (isDisplayMathFence(line)) {
            i++;
            const mathLines = [];
            while (i < lines.length && !isDisplayMathFence(lines[i])) {
                mathLines.push(lines[i]);
                i++;
            }
            if (i < lines.length && isDisplayMathFence(lines[i])) i++;
            blocks.push({ type: 'math', content: mathLines.join('\n') });
            continue;
        }

        // Horizontal rule
        if (isHorizontalRule(line)) {
            blocks.push({ type: 'hr' });
            i++;
            continue;
        }

        // Unordered list
        if (isUList(line)) {
            const items = [];
            while (i < lines.length && isUList(lines[i])) {
                items.push(lines[i].replace(/^\s{0,3}[-*+]\s+/, ''));
                i++;
            }
            blocks.push({ type: 'ulist', items });
            continue;
        }

        // Ordered list
        if (isOList(line)) {
            const items = [];
            while (i < lines.length && isOList(lines[i])) {
                items.push(lines[i].replace(/^\s{0,3}\d+\.\s+/, ''));
                i++;
            }
            blocks.push({ type: 'olist', items });
            continue;
        }

        // Paragraph
        const para = [];
        while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            !isFenceStart(lines[i]) &&
            !isHeading(lines[i]) &&
            !isUList(lines[i]) &&
            !isOList(lines[i]) &&
            !isImageOnly(lines[i])
        ) {
            para.push(lines[i]);
            i++;
        }
        blocks.push({ type: 'p', text: para.join(' ') });
    }

    let typst = '';

    if (metadata.title) {
        typst += `#set document(title: "${escapeTypstString(metadata.title)}")\n`;
    }
    if (metadata.author) {
        typst += `#set document(author: "${escapeTypstString(metadata.author)}")\n`;
    }

    typst += typstPreludeFromMetadata(metadata);

    if (metadata.title) {
        typst += `= ${markdownInlineToTypst(metadata.title)}\n\n`;
        if (metadata.author) typst += `${markdownInlineToTypst(metadata.author)}\n\n`;
        if (metadata.date) typst += `${markdownInlineToTypst(metadata.date)}\n\n`;
    }

    if (metadata.toc === true) {
        typst += `#outline()\n\n`;
    }

    for (const b of blocks) {
        if (b.type === 'heading') {
            typst += `${'='.repeat(b.level)} ${markdownInlineToTypst(b.text)}\n\n`;
        } else if (b.type === 'p') {
            typst += `${markdownInlineToTypst(b.text)}\n\n`;
        } else if (b.type === 'code') {
            const lang = b.lang ? `, lang: "${escapeTypstString(b.lang)}"` : '';
            typst += `#raw("${escapeTypstString(b.code)}"${lang})\n\n`;
        } else if (b.type === 'ulist') {
            for (const item of b.items) {
                typst += `- ${markdownInlineToTypst(item)}\n`;
            }
            typst += `\n`;
        } else if (b.type === 'olist') {
            for (const item of b.items) {
                typst += `+ ${markdownInlineToTypst(item)}\n`;
            }
            typst += `\n`;
        } else if (b.type === 'image') {
            const resolved = resolveLocalAsset(b.src, documentUrl);
            const srcForTypst = resolved?.shadowPath || (b.src.startsWith('/') ? b.src : `/${b.src}`);
            typst += `#image("${escapeTypstString(srcForTypst)}")\n\n`;
        } else if (b.type === 'math') {
            // Keep it as raw text in fallback mode (we don't implement math parsing here).
            // This avoids Typst interpreting LaTeX-like sequences in regular markup.
            const raw = `$$\n${b.content}\n$$`;
            typst += `#raw("${escapeTypstString(raw)}")\n\n`;
        } else if (b.type === 'hr') {
            typst += `#line(length: 100%)\n\n`;
        }
    }

    return typst;
}

async function ensureTypstPackageRegistry($typst) {
    // Ensure Typst can resolve @preview/... imports in the browser.
    // Must run before the compiler is initialized.
    try {
        const TypstSnippet = globalThis.TypstSnippet;
        if (!TypstSnippet || typeof $typst?.use !== 'function') return;

        $typst.use(TypstSnippet.fetchPackageRegistry());
        if (typeof $typst.prepareUse === 'function') {
            await $typst.prepareUse();
        }
    } catch (e) {
        console.warn('Typst package registry setup failed; will use fallback renderer if needed.', e);
        cmarkerAvailable = false;
    }
}

/**
 * Wait for the typst.ts bundle to expose the global $typst instance.
 */
async function waitForTypst() {
    const scriptEl = document.getElementById('typst');

    if (globalThis.$typst) return globalThis.$typst;

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Timed out loading Typst runtime'));
        }, 30000);

        const done = () => {
            clearTimeout(timeout);
            resolve();
        };

        if (scriptEl && scriptEl.addEventListener) {
            scriptEl.addEventListener('load', done, { once: true });
            scriptEl.addEventListener(
                'error',
                () => {
                    clearTimeout(timeout);
                    reject(new Error('Failed to load Typst runtime'));
                },
                { once: true },
            );
        } else {
            // Fallback: poll for the global instance
            const interval = setInterval(() => {
                if (globalThis.$typst) {
                    clearInterval(interval);
                    done();
                }
            }, 50);
        }
    });

    if (!globalThis.$typst) {
        throw new Error('Typst runtime loaded but $typst is missing');
    }

    return globalThis.$typst;
}

/**
 * Fetch markdown document from URL
 */
async function fetchMarkdown(url) {
    try {
        markTiming('fetch:start');
        updateStatus(`Fetching markdown from: ${url}`);

        const response = await fetchWithCache(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const content = await response.text();
        markTiming('fetch:done');
        return content;
    } catch (error) {
        console.error('Failed to fetch markdown:', error);
        throw new Error('Failed to fetch markdown: ' + error.message);
    }
}

/**
 * Compile markdown to PDF
 */
async function compileToPDF(markdownContent, documentUrl = null) {
    try {
        markTiming('compile:start');
        updateStatus('Parsing frontmatter...');
        const { metadata, content } = parseFrontmatter(markdownContent);

        const sanitizedContent = closeUnclosedBacktickFence(content);

        updateStatus('Preparing Mermaid diagrams...');
        markTiming('mermaid:start');
        const { transformedMarkdown, svgAssets } =
            await renderMermaidBlocksToSvgAssets(sanitizedContent);
        markTiming('mermaid:done');

        updateStatus('Compiling to PDF with Typst WASM...');
        const $typst = await waitForTypst();
        markTiming('typst:ready');

        // Configure package registry before the compiler initializes.
        await ensureTypstPackageRegistry($typst);

        // Ensure a clean slate across renders
        if (typeof $typst.resetShadow === 'function') {
            await $typst.resetShadow();
        }

        // Mount mermaid SVG assets so Typst can `image("/assets/...")`
        if (typeof $typst.mapShadow === 'function') {
            const encoder = new TextEncoder();
            for (const asset of svgAssets) {
                await $typst.mapShadow(asset.path, encoder.encode(asset.svg));
            }
        }

        // Fetch + mount external/local images into shadow FS and rewrite Markdown to those paths.
        const markdownForTypst = await mountAndRewriteImages(transformedMarkdown, documentUrl, $typst);

        // Heuristic: remote markdown often can't use @preview package imports on GH Pages.
        // Default to the fallback renderer for remote sources to avoid a slow failed attempt.
        let useFallback = rendererMode === 'fallback';
        if (!useFallback && rendererMode === 'auto') {
            try {
                const docOrigin = documentUrl ? new URL(documentUrl, window.location.href).origin : null;
                if (docOrigin && docOrigin !== window.location.origin) {
                    useFallback = true;
                }
            } catch {
                // ignore
            }
        }
        if (!useFallback && !cmarkerAvailable) useFallback = true;

        updateStatus('Converting Markdown to Typst...');
        markTiming('typst:convert:start');
        let typstContent =
            useFallback
                ? markdownToTypstFallback(markdownForTypst, metadata, documentUrl)
                : markdownToTypstWithCmarker(markdownForTypst, metadata);
        markTiming('typst:convert:done');

        lastTypstSource = typstContent;

        try {
            const pdfData = await $typst.pdf({ mainContent: typstContent });
            markTiming('pdf:compiled');
            return pdfData;
        } catch (err) {
            if (useFallback) {
                throw err;
            }

            console.warn('Typst compilation failed; retrying with fallback renderer.', err);
            try {
                const msg = String(err?.message ?? err).toLowerCase();
                if (msg.includes('unresolved import')) {
                    cmarkerAvailable = false;
                }
            } catch {
                // ignore
            }
            updateStatus('Retrying with fallback renderer...');
            typstContent = markdownToTypstFallback(markdownForTypst, metadata, documentUrl);
            lastTypstSource = typstContent;
            const pdfData = await $typst.pdf({ mainContent: typstContent });
            markTiming('pdf:compiled');
            return pdfData;
        }
    } catch (error) {
        console.error('Failed to compile PDF:', error);
        throw new Error('Failed to compile PDF: ' + error.message);
    }
}

/**
 * Display PDF in viewer
 */
function displayPDF(pdfData) {
    try {
        pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // Mark when the PDF viewer actually finishes loading the blob URL.
        // This is useful for performance measurement (time-to-visible) and differs from compile time.
        try {
            const onLoad = () => {
                markTiming('pdf:viewerLoaded');
                pdfViewer.removeEventListener('load', onLoad);
            };
            pdfViewer.addEventListener('load', onLoad);
        } catch {
            // ignore
        }
        
        pdfViewer.src = pdfUrl;
        pdfContainer.style.display = 'block';
        
        markTiming('pdf:displayed');
        updateStatus('PDF rendered successfully!', 'success');
    } catch (error) {
        console.error('Failed to display PDF:', error);
        throw new Error('Failed to display PDF: ' + error.message);
    }
}

/**
 * Handle PDF download
 */
function downloadPDF() {
    if (!pdfBlob) return;
    
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Main initialization and rendering pipeline
 */
async function main() {
    try {
        // Get URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const srcUrl = urlParams.get('src');
        
        if (!srcUrl) {
            updateStatus('No source URL provided. Use ?src=URL to specify a markdown document.', 'error');
            return;
        }
        
        // Initialize Typst runtime
        updateStatus('Loading Typst WASM runtime...');
        await waitForTypst();
        
        // Fetch markdown
        const markdownContent = await fetchMarkdown(srcUrl);
        
        // Compile to PDF
        const pdfData = await compileToPDF(markdownContent, srcUrl);
        
        // Display PDF
        displayPDF(pdfData);
        
        // Setup download button
        downloadBtn.addEventListener('click', downloadPDF);
        
    } catch (error) {
        updateStatus(error.message, 'error');
        console.error('Error:', error);
    }
}

// Start the application
main();

// Minimal test hooks for CLI fixture runner (headless browser).
// Safe to expose: it only reads current state and can trigger compilation.
globalThis.__mdtypst = {
    getStatusText: () => statusEl?.textContent ?? '',
    getPdfBlob: () => pdfBlob,
    getTypstSource: () => lastTypstSource,
    getTimings: () => timings,
    compileToPDF,
    displayPDF,
};

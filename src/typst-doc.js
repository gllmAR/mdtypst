import { escapeTypstString, typstPreludeFromMetadata } from './frontmatter.js';
import { resolveLocalAsset } from './assets.js';

function isSafeTypstRawValue(text) {
  const s = String(text).trim();
  if (!s) return false;

  // Length-like literals (used for margins, font sizes, etc.)
  if (/^-?\d+(?:\.\d+)?(?:pt|mm|cm|in|em|rem|%)$/i.test(s)) return true;

  // Simple dictionary/tuple-like literals, e.g. (x: 1cm, y: 2cm)
  if (s.startsWith('(') && s.endsWith(')')) {
    // Keep this intentionally conservative.
    if (!/^[0-9a-zA-Z_:+,\.\-\s()]*$/.test(s)) return false;
    return true;
  }

  return false;
}

function typstLiteral(value, { allowRaw = false } = {}) {
  if (value == null) return 'none';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  const s = String(value);
  if (allowRaw && isSafeTypstRawValue(s)) return s.trim();
  return `"${escapeTypstString(s)}"`;
}

export function typstMdtypstContextFromMetadata(metadata) {
  const mdtypstTitle = metadata?.title ?? metadata?.__mdtypst_titleFromHeading;
  const margin = metadata?.margin;
  const marginX = metadata?.margin_x ?? metadata?.marginX;
  const marginY = metadata?.margin_y ?? metadata?.marginY;
  const fontSize = metadata?.font_size ?? metadata?.fontSize;

  const meta = metadata && typeof metadata === 'object' ? metadata : {};
  const metaEntries = Object.entries(meta)
    .filter(([k]) => !String(k).startsWith('__mdtypst_'))
    .filter(([, v]) => v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    .sort(([a], [b]) => String(a).localeCompare(String(b)));

  const metaLines = metaEntries.map(([key, value]) => {
    const k = String(key);
    const isIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k);
    const typstKey = isIdent ? k : `"${escapeTypstString(k)}"`;
    return `    ${typstKey}: ${typstLiteral(value)},`;
  });

  const lines = [];
  lines.push(`#let mdtypst = (`);
  lines.push(`  title: ${typstLiteral(mdtypstTitle)},`);
  lines.push(`  author: ${typstLiteral(metadata?.author)},`);
  lines.push(`  date: ${typstLiteral(metadata?.date)},`);
  lines.push(`  toc: ${typstLiteral(metadata?.toc)},`);
  lines.push(`  paper: ${typstLiteral(metadata?.paper)},`);
  lines.push(`  margin: ${typstLiteral(margin, { allowRaw: true })},`);
  lines.push(`  margin_x: ${typstLiteral(marginX, { allowRaw: true })},`);
  lines.push(`  margin_y: ${typstLiteral(marginY, { allowRaw: true })},`);
  lines.push(`  font: ${typstLiteral(metadata?.font)},`);
  lines.push(`  font_size: ${typstLiteral(fontSize, { allowRaw: true })},`);
  lines.push(`  justify: ${typstLiteral(metadata?.justify)},`);
  lines.push(`  meta: (`);
  if (metaLines.length) {
    lines.push(...metaLines);
  }
  lines.push(`  ),`);
  lines.push(`)`);
  return `${lines.join('\n')}\n`;
}

// ------------------------
// cmarker-based renderer
// ------------------------

export function markdownToTypstWithCmarker(
  markdown,
  metadata,
  { tableMode = 'cmarker', extraPreamble = '', includeMetadataPrelude = true, markdownPath = null } = {},
) {
  let typst = '';

  typst += `#import "@preview/cmarker:0.1.8": cmarker\n`;

  const useTablem = tableMode === 'tablem';
  const canUsePath = Boolean(markdownPath) && !useTablem;
  const { markdown: rewrittenMarkdown, usedTablem } = useTablem
    ? rewriteMarkdownPipeTablesToTablem(markdown)
    : { markdown, usedTablem: false };
  if (useTablem && usedTablem) {
    typst += `#import "@preview/tablem:0.3.0": tablem\n`;
  }

  // Typst-native styling for cmarker tables.
  if (!useTablem) {
    typst += `#show table: t => {\n`;
    typst += `  if t.columns.all(c => c == auto) {\n`;
    typst += `    table(columns: (1fr,) * t.columns.len(), align: t.align, ..t.children)\n`;
    typst += `  } else {\n`;
    typst += `    t\n`;
    typst += `  }\n`;
    typst += `}\n`;
  }

  typst += typstMdtypstContextFromMetadata(metadata);

  // Shared helpers for sidecar templates.
  // Keep this tiny: it should be low-overhead but remove repetition.
  typst += `#let mdtypst_meta(key, default: none) = mdtypst.meta.at(key, default: default)\n`;
  typst += `#let mdtypst_text_or_none(v) = if v == none { none } else { text(v) }\n`;
  typst += `#let mdtypst_decode_escaped_newlines(s) = if s == none { none } else { s.replace("\\\\n", "\\n") }\n`;
  typst += `#let mdtypst_block_from_escaped_newlines(s) = {\n`;
  typst += `  if s == none { none } else {\n`;
  typst += `    let parts = mdtypst_decode_escaped_newlines(s).split("\\n")\n`;
  typst += `    let out = ()\n`;
  typst += `    for i in range(parts.len()) {\n`;
  typst += `      out.push(text(parts.at(i)))\n`;
  typst += `      if i < parts.len() - 1 { out.push(linebreak()) }\n`;
  typst += `    }\n`;
  typst += `    out.join()\n`;
  typst += `  }\n`;
  typst += `}\n\n`;

  if (includeMetadataPrelude) {
    if (metadata.title) {
      typst += `#set document(title: "${escapeTypstString(metadata.title)}")\n`;
    }
    if (metadata.author) {
      typst += `#set document(author: "${escapeTypstString(metadata.author)}")\n`;
    }

    typst += typstPreludeFromMetadata(metadata);
  }

  if (extraPreamble && String(extraPreamble).trim()) {
    typst += `${String(extraPreamble).trim()}\n\n`;
  }

  if (includeMetadataPrelude) {
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
  }

  const markdownExpr = canUsePath
    ? `read("${escapeTypstString(String(markdownPath))}")`
    : `"${escapeTypstString(rewrittenMarkdown)}"`;

  typst += `#cmarker.render(\n`;
  typst += `  ${markdownExpr},\n`;
  typst += `  scope: (\n`;
  typst += `    image: (source, alt: none, format: auto) => {\n`;
  typst += `      if source.starts-with("/assets/twemoji/") {\n`;
  typst += `        box(image(source, alt: alt, format: format, width: 1em, height: 1em))\n`;
  typst += `      } else {\n`;
  typst += `        image(source, alt: alt, format: format)\n`;
  typst += `      }\n`;
  typst += `    }\n`;
  typst += `  )\n`;
  typst += `)\n`;

  return typst;
}

// ------------------------
// Fallback renderer
// ------------------------

function markdownInlineToTypst(text, { mathEnabled = false } = {}) {
  // Minimal inline support for the bundled demo documents.
  // Convert Markdown emphasis to Typst emphasis markers:
  // - **bold** -> *bold*
  // - *italic* -> _italic_
  // - [text](url) -> #link("url")[text]
  // - `code` becomes #raw("...")
  const BOLD_OPEN = '\u0000B';
  const BOLD_CLOSE = '\u0000b';

  const LINK_OPEN = '\u0000L';
  const LINK_CLOSE = '\u0000l';

  const CODE_OPEN = '\u0000C';
  const CODE_CLOSE = '\u0000c';

  const IMAGE_OPEN = '\u0000I';
  const IMAGE_CLOSE = '\u0000i';

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

  // Inline code: `code`
  // Convert to a Typst raw node so it doesn't interact with markup parsing.
  // Must run before math parsing so `$` inside code spans isn't treated as math.
  const codeSpans = [];
  const addCodeSpan = (content) => {
    const idx = codeSpans.push({ content }) - 1;
    return `${CODE_OPEN}${idx}${CODE_CLOSE}`;
  };
  out = out.replace(/`([^`\n]+?)`/g, (_m, inner) => addCodeSpan(inner));

  // Inline math: $...$
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

  // Images: ![alt](src)
  // Must be processed before inline links so we don't turn images into '!#link(...)'.
  const images = [];
  const addImage = (src, alt) => {
    const idx = images.push({ src, alt }) - 1;
    return `${IMAGE_OPEN}${idx}${IMAGE_CLOSE}`;
  };
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)/g,
    (_m, alt, src) => addImage(src, alt),
  );

  // Inline links: [label](url) and [label](url "title")
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)/g,
    (_m, label, url) => addLink(url, label),
  );

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
    if (!mathEnabled) {
      const raw = `$${segment.content}$`;
      return `#raw("${escapeTypstString(raw)}")`;
    }
    return `#mi("${escapeTypstString(String(segment.content))}")`;
  });

  // Restore inline code placeholders.
  out = out.replace(new RegExp(`${CODE_OPEN}(\\d+)${CODE_CLOSE}`, 'g'), (_m, idxStr) => {
    const idx = Number(idxStr);
    const segment = codeSpans[idx];
    if (!segment) return '';
    return `#raw("${escapeTypstString(segment.content)}")`;
  });

  // Restore image placeholders.
  out = out.replace(new RegExp(`${IMAGE_OPEN}(\\d+)${IMAGE_CLOSE}`, 'g'), (_m, idxStr) => {
    const idx = Number(idxStr);
    const img = images[idx];
    if (!img) return '';
    const src = String(img.src || '').trim();
    if (!src) return '';
    const srcForTypst = src.startsWith('/') ? src : `/${src}`;
    if (srcForTypst.startsWith('/assets/twemoji/')) {
      return `#box(image("${escapeTypstString(srcForTypst)}", width: 1em, height: 1em))`;
    }
    return `#image("${escapeTypstString(srcForTypst)}")`;
  });

  return out;
}

export function markdownToTypstFallback(
  markdown,
  metadata,
  documentUrl = null,
  { extraPreamble = '', includeMetadataPrelude = true } = {},
) {
  // Very small Markdown subset -> Typst markup.
  // This is used when Typst package fetching is unavailable and cmarker can't be imported.

  // --- Footnotes / citations (GFM-ish) ---
  // Support named footnotes:
  //   In text:  [^id]
  //   Def:      [^id]: content
  // with optional indented continuation lines.
  //
  // Behavior:
  // - If the document contains a "References" section, treat these as citations:
  //   render in-text as `[id]` and keep the definitions under References as a list.
  // - Otherwise, treat them as footnotes: render in-text as Typst `#footnote[...]`
  //   and drop the definition blocks from the body.
  const footnotesEnabled = metadata?.footnotes !== false && metadata?.notes !== false;
  const mathEnabled = metadata?.math !== false;
  const footnoteDefsRaw = new Map();
  let hasReferencesSection = false;

  const cleanedLines = [];
  {
    const srcLines = String(markdown).replace(/\r\n/g, '\n').split('\n');
    let inReferences = false;
    let referencesLevel = null;

    const headingMatch = (l) => /^(#{1,6})\s+(.+?)\s*$/.exec(String(l ?? ''));

    for (let li = 0; li < srcLines.length; li++) {
      const line = srcLines[li];

      const hm = headingMatch(line);
      if (hm) {
        const level = hm[1].length;
        const text = String(hm[2] ?? '').trim().toLowerCase();
        if (inReferences && referencesLevel != null && level <= referencesLevel) {
          inReferences = false;
          referencesLevel = null;
        }
        if (text === 'references') {
          inReferences = true;
          referencesLevel = level;
          hasReferencesSection = true;
        }
        cleanedLines.push(line);
        continue;
      }

      const m = /^\[\^([^\]]+)\]:\s*(.*)$/.exec(line.trimEnd());
      if (!m || !footnotesEnabled) {
        cleanedLines.push(line);
        continue;
      }

      const id = String(m[1]).trim();
      const parts = [String(m[2] ?? '').trim()];

      // Capture continuation lines that are indented (commonmark-ish).
      // Stop at the first non-indented non-blank line.
      while (li + 1 < srcLines.length) {
        const next = srcLines[li + 1];
        if (next.trim() === '') {
          parts.push('');
          li++;
          continue;
        }
        if (/^(\s{2,}|\t)/.test(next)) {
          parts.push(next.trim());
          li++;
          continue;
        }
        break;
      }

      const defText = parts.filter((p) => p !== '').join(' ').trim();
      if (id) footnoteDefsRaw.set(id, defText);

      if (inReferences) {
        // Keep under References, but render as a regular bullet list item.
        cleanedLines.push(`- [${id}]: ${defText}`);
      }
      // Else: drop the definition block from the rendered output.
    }
  }

  const lines = cleanedLines;

  const isBlockquoteLine = (line) => /^\s{0,3}>\s?/.test(String(line ?? ''));

  const isFenceStart = (line) => line.startsWith('```');
  const isHeading = (line) => /^#{1,6}\s+/.test(line);
  // Lists: allow arbitrary indentation so nested lists don't get swallowed
  // into a paragraph (common in fixtures like lists/deep-nesting.md).
  const isUList = (line) => /^\s*[-*+]\s+/.test(line);
  const isOList = (line) => /^\s*\d+\.\s+/.test(line);
  const isImageOnly = (line) => /^!\[[^\]]*\]\([^)]+\)\s*$/.test(line.trim());
  const isHorizontalRule = (line) => /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line);
  const isDisplayMathFence = (line) => /^\s*\$\$\s*$/.test(line);
  const isDisplayMathSingleLine = (line) => /^\s*\$\$[\s\S]*\$\$\s*$/.test(line);

  const isTableRowLine = (line) => {
    if (!line) return false;
    const t = String(line).trim();
    if (t === '') return false;
    if (!t.includes('|')) return false;
    return /[^|\s]/.test(t);
  };

  const isTableSeparatorLine = (line) => {
    if (!line) return false;
    const t = String(line).trim();
    if (!t.includes('-') || !t.includes('|')) return false;
    // Allow 1+ dashes to support width-hint fixtures like `|-|--------|-|`.
    // Note: GFM requires 3+ dashes; we treat <3 as a non-standard but intentional hint.
    return /^\|?\s*:?[-]{1,}:?\s*(\|\s*:?[-]{1,}:?\s*)+\|?$/.test(t);
  };

  const splitPipeRow = (line) => {
    const t = String(line).trim();
    const inner = t.replace(/^\|/, '').replace(/\|$/, '');

    const cells = [];
    let current = '';
    let inCode = false;

    for (let idx = 0; idx < inner.length; idx++) {
      const ch = inner[idx];

      if (ch === '`') {
        inCode = !inCode;
        current += ch;
        continue;
      }

      if (!inCode && ch === '\\' && inner[idx + 1] === '|') {
        current += '\\|';
        idx++;
        continue;
      }

      if (!inCode && ch === '|') {
        cells.push(current.trim());
        current = '';
        continue;
      }

      current += ch;
    }

    cells.push(current.trim());
    return cells;
  };

  const parseAlignments = (separatorLine, columnCount) => {
    const parts = splitPipeRow(separatorLine);
    const aligns = [];
    for (let c = 0; c < columnCount; c++) {
      const seg = String(parts[c] ?? '').trim();
      const left = seg.startsWith(':');
      const right = seg.endsWith(':');
      if (left && right) aligns.push('center');
      else if (right) aligns.push('right');
      else aligns.push('left');
    }
    return aligns;
  };

  const parseColumnWeightsFromSeparator = (separatorLine, columnCount) => {
    const parts = splitPipeRow(separatorLine);
    const weights = [];
    let hasNonGfmWidthHint = false;
    for (let c = 0; c < columnCount; c++) {
      const seg = String(parts[c] ?? '').trim();
      const dashCount = (seg.match(/-/g) || []).length;
      const w = Math.max(1, dashCount);
      weights.push(w);
      if (dashCount > 0 && dashCount < 3) hasNonGfmWidthHint = true;
    }
    return hasNonGfmWidthHint ? weights : null;
  };

  const parseBlocksFromLines = (sourceLines) => {
    const blocks = [];
    let i = 0;
    const eatBlank = () => {
      while (i < sourceLines.length && sourceLines[i].trim() === '') i++;
    };

    while (i < sourceLines.length) {
      eatBlank();
      if (i >= sourceLines.length) break;

      const line = sourceLines[i];

      // Code fence
      if (isFenceStart(line)) {
        const lang = line.slice(3).trim();
        i++;
        const codeLines = [];
        while (i < sourceLines.length && !sourceLines[i].startsWith('```')) {
          codeLines.push(sourceLines[i]);
          i++;
        }
        if (i < sourceLines.length && sourceLines[i].startsWith('```')) i++;
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

      // Blockquote (supports nesting via recursion)
      if (isBlockquoteLine(line)) {
        const quoteLines = [];
        while (i < sourceLines.length) {
          const l = sourceLines[i];
          if (isBlockquoteLine(l)) {
            quoteLines.push(l);
            i++;
            continue;
          }

          if (String(l).trim() === '') {
            // Keep a blank line inside the quote if it separates quote lines.
            if (i + 1 < sourceLines.length && isBlockquoteLine(sourceLines[i + 1])) {
              quoteLines.push('');
              i++;
              continue;
            }
          }
          break;
        }

        const innerLines = quoteLines.map((l) => {
          if (String(l).trim() === '') return '';
          return String(l).replace(/^\s{0,3}>\s?/, '');
        });
        blocks.push({ type: 'blockquote', blocks: parseBlocksFromLines(innerLines) });
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
        while (i < sourceLines.length && !isDisplayMathFence(sourceLines[i])) {
          mathLines.push(sourceLines[i]);
          i++;
        }
        if (i < sourceLines.length && isDisplayMathFence(sourceLines[i])) i++;
        blocks.push({ type: 'math', content: mathLines.join('\n') });
        continue;
      }

      // Horizontal rule
      if (isHorizontalRule(line)) {
        blocks.push({ type: 'hr' });
        i++;
        continue;
      }

      // List block (unordered or ordered, including nested items).
      if (isUList(line) || isOList(line)) {
        const items = [];

        const parseIndent = (s) => {
          const m = /^(\s*)/.exec(String(s) || '');
          const raw = m?.[1] || '';
          // Expand tabs conservatively.
          return raw.replace(/\t/g, '    ').length;
        };

        while (i < sourceLines.length && (isUList(sourceLines[i]) || isOList(sourceLines[i]))) {
          const raw = sourceLines[i];
          const indent = parseIndent(raw);

          const um = /^(\s*)[-*+]\s+(.*)$/.exec(raw);
          if (um) {
            items.push({ kind: 'u', indent, text: um[2] ?? '' });
            i++;
            continue;
          }

          const om = /^(\s*)\d+\.\s+(.*)$/.exec(raw);
          if (om) {
            items.push({ kind: 'o', indent, text: om[2] ?? '' });
            i++;
            continue;
          }

          // Should be unreachable due to guards, but avoid infinite loops.
          break;
        }

        blocks.push({ type: 'list', items });
        continue;
      }

      // GFM pipe table
      if (isTableRowLine(line) && isTableSeparatorLine(sourceLines[i + 1] || '')) {
        const headerLine = line;
        const separatorLine = sourceLines[i + 1];
        i += 2;

        const rowLines = [];
        while (i < sourceLines.length && isTableRowLine(sourceLines[i])) {
          rowLines.push(sourceLines[i]);
          i++;
        }

        const headerCells = splitPipeRow(headerLine);
        const bodyRows = rowLines.map((l) => splitPipeRow(l));
        const columnCount = Math.max(
          headerCells.length,
          ...bodyRows.map((r) => r.length),
        );

        const align = parseAlignments(separatorLine, columnCount);
        const columnWeights = parseColumnWeightsFromSeparator(separatorLine, columnCount);
        blocks.push({
          type: 'table',
          columnCount,
          align,
          columnWeights,
          header: headerCells,
          rows: bodyRows,
        });
        continue;
      }

      // Paragraph
      const para = [];
      while (
        i < sourceLines.length &&
        sourceLines[i].trim() !== '' &&
        !isFenceStart(sourceLines[i]) &&
        !isHeading(sourceLines[i]) &&
        !isBlockquoteLine(sourceLines[i]) &&
        !isUList(sourceLines[i]) &&
        !isOList(sourceLines[i]) &&
        !isImageOnly(sourceLines[i]) &&
        !(isTableRowLine(sourceLines[i]) && isTableSeparatorLine(sourceLines[i + 1] || ''))
      ) {
        para.push(sourceLines[i]);
        i++;
      }
      blocks.push({ type: 'p', text: para.join(' ') });
    }

    return blocks;
  };

  const blocks = parseBlocksFromLines(lines);

  let typst = '';

  typst += typstMdtypstContextFromMetadata(metadata);

  // Shared helpers for sidecar templates.
  // Keep this tiny: it should be low-overhead but remove repetition.
  typst += `#let mdtypst_meta(key, default: none) = mdtypst.meta.at(key, default: default)\n`;
  typst += `#let mdtypst_text_or_none(v) = if v == none { none } else { text(v) }\n`;
  typst += `#let mdtypst_decode_escaped_newlines(s) = if s == none { none } else { s.replace("\\\\n", "\\n") }\n`;
  typst += `#let mdtypst_block_from_escaped_newlines(s) = {\n`;
  typst += `  if s == none { none } else {\n`;
  typst += `    let parts = mdtypst_decode_escaped_newlines(s).split("\\n")\n`;
  typst += `    let out = ()\n`;
  typst += `    for i in range(parts.len()) {\n`;
  typst += `      out.push(text(parts.at(i)))\n`;
  typst += `      if i < parts.len() - 1 { out.push(linebreak()) }\n`;
  typst += `    }\n`;
  typst += `    out.join()\n`;
  typst += `  }\n`;
  typst += `}\n\n`;

  // TeX math support (fallback renderer) via MiTeX.
  // Import only when enabled and detected.
  const hasInlineMath = /\$(?!\s)[^$\n]+?\$/.test(String(markdown));
  const hasBlockMath = blocks.some((b) => b?.type === 'math');
  const hasAnyMath = mathEnabled && (hasInlineMath || hasBlockMath);
  if (hasAnyMath) {
    typst += `#import "@preview/mitex:0.2.4": *\n\n`;
  }

  if (includeMetadataPrelude) {
    if (metadata.title) {
      typst += `#set document(title: "${escapeTypstString(metadata.title)}")\n`;
    }
    if (metadata.author) {
      typst += `#set document(author: "${escapeTypstString(metadata.author)}")\n`;
    }

    typst += typstPreludeFromMetadata(metadata);
  }

  const footnoteDefsTypst = new Map();
  if (footnotesEnabled && footnoteDefsRaw.size) {
    for (const [id, defText] of footnoteDefsRaw.entries()) {
      footnoteDefsTypst.set(id, markdownInlineToTypst(defText, { mathEnabled }));
    }
  }

  const injectFootnotes = (typstMarkup) => {
    if (!footnotesEnabled) return typstMarkup;
    let out = String(typstMarkup);

    // Inline footnotes: ^[text]
    const inlineFootnote = (_m, inner) => {
      const rendered = markdownInlineToTypst(String(inner), { mathEnabled });
      return `#footnote[${rendered}]`;
    };
    out = out.replace(/\^\[([^\]]+?)\]/g, inlineFootnote);
    // The fallback renderer escapes literal brackets as `\[` and `\]`.
    out = out.replace(/\^\\\[([\s\S]*?)\\\]/g, inlineFootnote);
    out = out.replace(/\\\^\\\[([\s\S]*?)\\\]/g, inlineFootnote);

    // Named footnotes: [^id]
    if (footnoteDefsTypst.size) {
      const namedFootnote = (full, rawId) => {
        const id = String(rawId).trim();
        const def = footnoteDefsTypst.get(id);
        if (!def) return full;
        if (hasReferencesSection) {
          // Citation mode: show literal bracketed key.
          return `\\[${markdownInlineToTypst(id, { mathEnabled })}\\]`;
        }
        return `#footnote[${def}]`;
      };

      // Raw brackets
      out = out.replace(/\[\^([^\]]+)\]/g, namedFootnote);
      // Escaped brackets produced by the fallback renderer
      out = out.replace(/\\\[\^([^\\\]]+)\\\]/g, namedFootnote);
    }

    return out;
  };

  const inline = (text) => injectFootnotes(markdownInlineToTypst(text, { mathEnabled }));
  if (extraPreamble && String(extraPreamble).trim()) {
    typst += `${String(extraPreamble).trim()}\n\n`;
  }

  if (includeMetadataPrelude) {
    if (metadata.title) {
      typst += `= ${markdownInlineToTypst(metadata.title, { mathEnabled })}\n\n`;
      if (metadata.author) typst += `${markdownInlineToTypst(metadata.author, { mathEnabled })}\n\n`;
      if (metadata.date) typst += `${markdownInlineToTypst(metadata.date, { mathEnabled })}\n\n`;
    }

    if (metadata.toc === true) {
      typst += `#outline()\n\n`;
    }
  }

  const renderBlocksToTypst = (blockList) => {
    let out = '';
    for (const b of blockList) {
      if (b.type === 'heading') {
        out += `${'='.repeat(b.level)} ${inline(b.text)}\n\n`;
      } else if (b.type === 'p') {
        out += `${inline(b.text)}\n\n`;
      } else if (b.type === 'blockquote') {
        const inner = renderBlocksToTypst(Array.isArray(b.blocks) ? b.blocks : []).trimEnd();
        // Typst's `quote` adds quotation marks; Markdown blockquotes are typically
        // rendered as an indented block with a left rule.
        out += `#block(inset: (left: 1em), stroke: (left: 1pt))[\n${inner}\n]\n\n`;
      } else if (b.type === 'code') {
        const lang = b.lang ? `, lang: "${escapeTypstString(b.lang)}"` : '';
        out += `#raw("${escapeTypstString(b.code)}"${lang})\n\n`;
      } else if (b.type === 'list') {
        const items = Array.isArray(b.items) ? b.items : [];
        for (const it of items) {
          const indent = Number.isFinite(it?.indent) ? Math.max(0, it.indent) : 0;
          const bullet = it?.kind === 'o' ? '+' : '-';
          out += `${' '.repeat(indent)}${bullet} ${inline(it?.text ?? '')}\n`;
        }
        out += `\n`;
      } else if (b.type === 'image') {
        const resolved = resolveLocalAsset(b.src, documentUrl);
        const srcForTypst = resolved?.shadowPath || (b.src.startsWith('/') ? b.src : `/${b.src}`);
        if (String(srcForTypst).startsWith('/assets/twemoji/')) {
          out += `#box(image("${escapeTypstString(srcForTypst)}", width: 1em, height: 1em))\n\n`;
        } else {
          out += `#image("${escapeTypstString(srcForTypst)}")\n\n`;
        }
      } else if (b.type === 'math') {
        if (!mathEnabled) {
          const raw = `$$\n${b.content}\n$$`;
          out += `#raw("${escapeTypstString(raw)}")\n\n`;
        } else {
          const content = String(b.content ?? '');
          if (!content.includes('`')) {
            out += `#mitex(\`\n${content}\n\`)\n\n`;
          } else {
            out += `#mitex("${escapeTypstString(content)}")\n\n`;
          }
        }
      } else if (b.type === 'hr') {
        out += `#line(length: 100%)\n\n`;
      } else if (b.type === 'table') {
        const cols = Number(b.columnCount) || 1;
        const align = Array.isArray(b.align) ? b.align : [];
        const alignList = Array.from({ length: cols }, (_v, idx) => align[idx] || 'left');
        const weights = Array.isArray(b.columnWeights) ? b.columnWeights : null;
        const columnsExpr = weights && weights.length
          ? `(${weights.slice(0, cols).map((w) => `${Math.max(1, Number(w) || 1)}fr`).join(', ')})`
          : `(1fr,) * ${cols}`;

        const cells = [];
        const header = Array.isArray(b.header) ? b.header : [];
        const headerCells = [];
        for (let c = 0; c < cols; c++) {
          const raw = header[c] ?? '';
          const content = inline(String(raw));
          headerCells.push(`[*${content}*]`);
        }

        const rows = Array.isArray(b.rows) ? b.rows : [];
        for (const r of rows) {
          for (let c = 0; c < cols; c++) {
            const raw = r?.[c] ?? '';
            const content = inline(String(raw));
            cells.push(content ? `[${content}]` : `[]`);
          }
        }

        out += `#table(\n`;
        out += `  columns: ${columnsExpr},\n`;
        out += `  align: (${alignList.join(', ')}),\n`;
        out += `  table.header(\n    ${headerCells.join(',\n    ')}\n  ),\n`;
        out += `  ${cells.join(',\n  ')}\n`;
        out += `)\n\n`;
      }
    }
    return out;
  };

  typst += renderBlocksToTypst(blocks);

  return typst;
}

// ------------------------
// tablem injection
// ------------------------

export function rewriteMarkdownPipeTablesToTablem(markdown) {
  // Convert GitHub-style Markdown pipe tables into Typst `tablem` blocks.
  // We inject raw Typst via cmarker’s `<!--raw-typst ... -->` support.
  // This allows using tablem while still keeping the rest of the document in Markdown.
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const out = [];

  let usedTablem = false;
  let inFence = false;

  const isFence = (line) => /^```/.test(line);
  const isTableRowLine = (line) => {
    if (!line) return false;
    const t = line.trim();
    if (t === '') return false;
    // Must contain at least one pipe and some non-pipe content.
    if (!t.includes('|')) return false;
    return /[^|\s]/.test(t);
  };
  const isTableSeparatorLine = (line) => {
    if (!line) return false;
    const t = line.trim();
    if (!t.includes('-') || !t.includes('|')) return false;
    // Match pipes with --- segments, allowing optional colons for alignment.
    // Examples: | --- | ---: | :---: |
    // Allow 1+ dashes to support width-hint fixtures like `|-|--------|-|`.
    return /^\|?\s*:?[-]{1,}:?\s*(\|\s*:?[-]{1,}:?\s*)+\|?$/.test(t);
  };

  const splitPipeRow = (line) => {
    // Split a pipe table row into cells, respecting:
    // - escaped pipes (\|)
    // - inline code spans (`...|...`) where pipes don't delimit cells
    const t = String(line).trim();
    const inner = t.replace(/^\|/, '').replace(/\|$/, '');

    const cells = [];
    let current = '';
    let inCode = false;

    for (let idx = 0; idx < inner.length; idx++) {
      const ch = inner[idx];

      if (ch === '`') {
        // Toggle code span state on each backtick; good enough for typical GFM.
        inCode = !inCode;
        current += ch;
        continue;
      }

      if (!inCode && ch === '\\' && inner[idx + 1] === '|') {
        current += '\\|';
        idx++;
        continue;
      }

      if (!inCode && ch === '|') {
        cells.push(current.trim());
        current = '';
        continue;
      }

      current += ch;
    }

    cells.push(current.trim());
    return cells;
  };

  const normalizePipeRow = (cells) => `| ${cells.join(' | ')} |`;

  const normalizeSeparatorRow = (line) => {
    const segs = splitPipeRow(line).map((s) => {
      const seg = String(s).trim();
      const left = seg.startsWith(':');
      const right = seg.endsWith(':');
      const dashCount = (seg.match(/-/g) || []).length;
      // Keep table header detection stable by normalizing to at least 3 dashes.
      const normalizedDashCount = Math.max(3, dashCount || 0);
      const core = '-'.repeat(normalizedDashCount);
      return `${left ? ':' : ''}${core}${right ? ':' : ''}`;
    });
    return normalizePipeRow(segs);
  };

  const columnWeightsFromSeparator = (separatorLine, columnCount) => {
    const parts = splitPipeRow(separatorLine);
    const weights = [];
    let hasNonGfmWidthHint = false;
    for (let c = 0; c < columnCount; c++) {
      const seg = String(parts[c] ?? '').trim();
      const dashCount = (seg.match(/-/g) || []).length;
      weights.push(Math.max(1, dashCount));
      if (dashCount > 0 && dashCount < 3) hasNonGfmWidthHint = true;
    }
    return hasNonGfmWidthHint ? weights : null;
  };

  const normalizeDataRow = (line) => {
    const cells = splitPipeRow(line).map((cell) => markdownInlineToTypst(cell, { mathEnabled: false }));
    return normalizePipeRow(cells);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isFence(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }

    if (!inFence && isTableRowLine(line) && isTableSeparatorLine(lines[i + 1] || '')) {
      // Capture contiguous table block.
      const tableLines = [line, lines[i + 1]];
      const separatorLine = lines[i + 1];
      const headerCells = splitPipeRow(line);
      const columnCount = Math.max(1, headerCells.length);
      const columnWeights = columnWeightsFromSeparator(separatorLine, columnCount);
      i += 2;
      while (i < lines.length && isTableRowLine(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      i -= 1;

      const converted = [];
      converted.push(normalizeDataRow(tableLines[0]));
      converted.push(normalizeSeparatorRow(tableLines[1]));
      for (let j = 2; j < tableLines.length; j++) {
        converted.push(normalizeDataRow(tableLines[j]));
      }

      // Keep the original table GFM-compliant for GitHub rendering,
      // but exclude it from Typst. Then inject tablem for Typst rendering.
      if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('');
      out.push('<!--typst-begin-exclude-->');
      out.push(...tableLines);
      out.push('<!--typst-end-exclude-->');
      out.push('');

      out.push('<!--raw-typst');
      if (columnWeights) {
        const columnsExpr = `(${columnWeights.map((w) => `${Math.max(1, Number(w) || 1)}fr`).join(', ')})`;
        out.push(`#tablem(columns: ${columnsExpr})[`);
      } else {
        out.push('#tablem[');
      }
      out.push(...converted);
      out.push(']');
      out.push('-->');
      out.push('');

      usedTablem = true;
      continue;
    }

    out.push(line);
  }

  return { markdown: out.join('\n'), usedTablem };
}

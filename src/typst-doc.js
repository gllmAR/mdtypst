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

function typstMdtypstContextFromMetadata(metadata) {
  const margin = metadata?.margin;
  const marginX = metadata?.margin_x ?? metadata?.marginX;
  const marginY = metadata?.margin_y ?? metadata?.marginY;
  const fontSize = metadata?.font_size ?? metadata?.fontSize;

  const lines = [];
  lines.push(`#let mdtypst = (`);
  lines.push(`  title: ${typstLiteral(metadata?.title)},`);
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
  lines.push(`)`);
  return `${lines.join('\n')}\n`;
}

// ------------------------
// cmarker-based renderer
// ------------------------

export function markdownToTypstWithCmarker(
  markdown,
  metadata,
  { tableMode = 'cmarker', extraPreamble = '', includeMetadataPrelude = true } = {},
) {
  let typst = '';

  typst += `#import "@preview/cmarker:0.1.8": cmarker\n`;

  const useTablem = tableMode === 'tablem';
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

  typst += `#cmarker.render(\n`;
  typst += `  "${escapeTypstString(rewrittenMarkdown)}",\n`;
  typst += `  scope: (image: (source, alt: none, format: auto) => image(source, alt: alt, format: format))\n`;
  typst += `)\n`;

  return typst;
}

// ------------------------
// Fallback renderer
// ------------------------

function markdownInlineToTypst(text) {
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

  // Inline code: `code`
  // Convert to a Typst raw node so it doesn't interact with markup parsing.
  const codeSpans = [];
  const addCodeSpan = (content) => {
    const idx = codeSpans.push({ content }) - 1;
    return `${CODE_OPEN}${idx}${CODE_CLOSE}`;
  };
  out = out.replace(/`([^`\n]+?)`/g, (_m, inner) => addCodeSpan(inner));

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
    return /^\|?\s*:?[-]{3,}:?\s*(\|\s*:?[-]{3,}:?\s*)+\|?$/.test(t);
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

    // GFM pipe table
    if (isTableRowLine(line) && isTableSeparatorLine(lines[i + 1] || '')) {
      const headerLine = line;
      const separatorLine = lines[i + 1];
      i += 2;

      const rowLines = [];
      while (i < lines.length && isTableRowLine(lines[i])) {
        rowLines.push(lines[i]);
        i++;
      }

      const headerCells = splitPipeRow(headerLine);
      const bodyRows = rowLines.map((l) => splitPipeRow(l));
      const columnCount = Math.max(
        headerCells.length,
        ...bodyRows.map((r) => r.length),
      );

      const align = parseAlignments(separatorLine, columnCount);
      blocks.push({
        type: 'table',
        columnCount,
        align,
        header: headerCells,
        rows: bodyRows,
      });
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
      !isImageOnly(lines[i]) &&
      !(isTableRowLine(lines[i]) && isTableSeparatorLine(lines[i + 1] || ''))
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'p', text: para.join(' ') });
  }

  let typst = '';

  typst += typstMdtypstContextFromMetadata(metadata);

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
      typst += `= ${markdownInlineToTypst(metadata.title)}\n\n`;
      if (metadata.author) typst += `${markdownInlineToTypst(metadata.author)}\n\n`;
      if (metadata.date) typst += `${markdownInlineToTypst(metadata.date)}\n\n`;
    }

    if (metadata.toc === true) {
      typst += `#outline()\n\n`;
    }
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
      const raw = `$$\n${b.content}\n$$`;
      typst += `#raw("${escapeTypstString(raw)}")\n\n`;
    } else if (b.type === 'hr') {
      typst += `#line(length: 100%)\n\n`;
    } else if (b.type === 'table') {
      const cols = Number(b.columnCount) || 1;
      const align = Array.isArray(b.align) ? b.align : [];
      const alignList = Array.from({ length: cols }, (_v, idx) => align[idx] || 'left');

      const cells = [];
      const header = Array.isArray(b.header) ? b.header : [];
      for (let c = 0; c < cols; c++) {
        const raw = header[c] ?? '';
        const content = markdownInlineToTypst(String(raw));
        cells.push(`[*${content}*]`);
      }

      const rows = Array.isArray(b.rows) ? b.rows : [];
      for (const r of rows) {
        for (let c = 0; c < cols; c++) {
          const raw = r?.[c] ?? '';
          const content = markdownInlineToTypst(String(raw));
          cells.push(content ? `[${content}]` : `[]`);
        }
      }

      typst += `#table(\n`;
      typst += `  columns: (1fr,) * ${cols},\n`;
      typst += `  align: (${alignList.join(', ')}),\n`;
      typst += `  ${cells.join(',\n  ')}\n`;
      typst += `)\n\n`;
    }
  }

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
    return /^\|?\s*:?[-]{3,}:?\s*(\|\s*:?[-]{3,}:?\s*)+\|?$/.test(t);
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
    const segs = splitPipeRow(line).map((s) => s.trim());
    return normalizePipeRow(segs);
  };

  const normalizeDataRow = (line) => {
    const cells = splitPipeRow(line).map((cell) => markdownInlineToTypst(cell));
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
      out.push('#tablem[');
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

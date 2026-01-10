export function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, content };
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

export function isTypstLength(value) {
  return typeof value === 'string' && /^-?\d+(?:\.\d+)?(pt|mm|cm|in)$/.test(value.trim());
}

export function normalizePaper(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
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

export function escapeTypstString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/\t/g, '\\t')
    .replace(/"/g, '\\"');
}

export function typstPreludeFromMetadata(metadata) {
  const paper = normalizePaper(metadata.paper) || 'a4';
  const margin = isTypstLength(metadata.margin) ? metadata.margin.trim() : null;
  const marginX = isTypstLength(metadata.margin_x) ? metadata.margin_x.trim() : null;
  const marginY = isTypstLength(metadata.margin_y) ? metadata.margin_y.trim() : null;

  const font = typeof metadata.font === 'string' && metadata.font.trim() ? metadata.font.trim() : null;
  const fontSizeRaw =
    (typeof metadata.fontSize === 'string' ? metadata.fontSize : null) ??
    (typeof metadata.font_size === 'string' ? metadata.font_size : null);
  const fontSize = isTypstLength(fontSizeRaw) ? fontSizeRaw.trim() : null;

  const justify = metadata.justify === true;

  let typst = '';

  // Page setup
  typst += `#set page(paper: "${escapeTypstString(paper)}"`;
  if (margin || marginX || marginY) {
    const mx = marginX || margin;
    const my = marginY || margin;
    if (mx && my) typst += `, margin: (x: ${mx}, y: ${my})`;
  }
  typst += `)\n`;

  // Typography
  if (font) {
    typst += `#set text(font: "${escapeTypstString(font)}")\n`;
  }
  if (fontSize) {
    typst += `#set text(size: ${fontSize})\n`;
  }
  if (justify) {
    typst += `#set par(justify: true)\n`;
  }

  typst += `\n`;
  return typst;
}

export function closeUnclosedBacktickFence(markdown) {
  // Some fixtures include unclosed fences; Typst/cmarker can hang or error.
  // Close if we detect an odd number of triple-backtick fences.
  const fence = /(^|\n)```/g;
  const matches = markdown.match(fence);
  if (!matches || matches.length % 2 === 0) return markdown;
  return `${markdown}\n\n\`\`\`\n`;
}

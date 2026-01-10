import { fetchWithCache } from './cache.js';

function parseFlatYaml(text) {
  const out = {};
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex <= 0) continue;

    const key = line.substring(0, colonIndex).trim();
    let raw = line.substring(colonIndex + 1).trim();
    raw = raw.replace(/^["']|["']$/g, '');

    if (raw === 'true') out[key] = true;
    else if (raw === 'false') out[key] = false;
    else if (/^-?\d+(?:\.\d+)?$/.test(raw)) out[key] = Number(raw);
    else out[key] = raw;
  }
  return out;
}

function isYamlPath(pathname) {
  return /\.(ya?ml)$/i.test(pathname);
}

function isJsonPath(pathname) {
  return /\.json$/i.test(pathname);
}

function isTypstPath(pathname) {
  return /\.typ$/i.test(pathname);
}

function normalizeSidecarObject(obj) {
  if (!obj || typeof obj !== 'object') return { metadata: {}, typst: {} };

  // Allow either nested `metadata` or top-level keys.
  const metadata = { ...(obj.metadata && typeof obj.metadata === 'object' ? obj.metadata : {}) };
  const typst = { ...(obj.typst && typeof obj.typst === 'object' ? obj.typst : {}) };

  // Promote common metadata keys if present at top-level.
  for (const k of [
    'title',
    'author',
    'date',
    'paper',
    'margin',
    'margin_x',
    'margin_y',
    'font',
    'fontSize',
    'font_size',
    'justify',
    'toc',
  ]) {
    if (obj[k] != null && metadata[k] == null) metadata[k] = obj[k];
  }

  // Convenience aliases.
  if (obj.template && typst.template == null) typst.template = obj.template;
  if (obj.preamble && typst.preamble == null) typst.preamble = obj.preamble;

  return { metadata, typst };
}

async function tryFetchText(url, { timeoutMs = 8000 } = {}) {
  try {
    const resp = await fetchWithCache(url, { timeoutMs });
    if (!resp || !resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

function buildAutoSidecarUrls(srcUrlString) {
  // Strategy: look for a sibling file next to the markdown.
  // - foo.md -> foo.mdtypst.typ then foo.mdtypst.json then foo.mdtypst.yaml
  // - foo     -> foo.mdtypst.json then foo.mdtypst.yaml
  const urls = [];
  let abs;
  try {
    abs = new URL(srcUrlString, window.location.href);
  } catch {
    return urls;
  }

  const base = abs.toString();
  const isMd = /\.md$/i.test(abs.pathname);
  const typUrl = isMd ? base.replace(/\.md$/i, '.mdtypst.typ') : `${base}.mdtypst.typ`;
  const jsonUrl = isMd ? base.replace(/\.md$/i, '.mdtypst.json') : `${base}.mdtypst.json`;
  const yamlUrl = isMd ? base.replace(/\.md$/i, '.mdtypst.yaml') : `${base}.mdtypst.yaml`;

  urls.push(typUrl, jsonUrl, yamlUrl);
  return urls;
}

function extractMdtypstJsonHeaderFromTyp(text) {
  // Optional header to allow .typ sidecars to carry metadata/config.
  // Format (single line):
  //   // mdtypst: {"metadata": {"title": "..."}, "toc": false, ...}
  // This is intentionally minimal and must be valid JSON on one line.
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^\/\/\s*mdtypst\s*:\s*(\{.*\})\s*$/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
  return null;
}

export async function loadSidecar({ srcUrl, explicitSidecarUrl } = {}) {
  const candidates = [];

  let absSrcUrl = null;
  if (srcUrl) {
    try {
      absSrcUrl = new URL(srcUrl, window.location.href).toString();
    } catch {
      absSrcUrl = null;
    }
  }

  if (explicitSidecarUrl) {
    try {
      // Resolve relative sidecar URLs relative to the markdown document URL.
      candidates.push(new URL(explicitSidecarUrl, absSrcUrl || window.location.href).toString());
    } catch {
      // ignore
    }
  } else if (absSrcUrl) {
    candidates.push(...buildAutoSidecarUrls(absSrcUrl));
  }

  for (const url of candidates) {
    const text = await tryFetchText(url);
    if (text == null) continue;

    try {
      const u = new URL(url);
      let raw;
      if (isJsonPath(u.pathname)) {
        raw = JSON.parse(text);
      } else if (isYamlPath(u.pathname)) {
        raw = parseFlatYaml(text);
      } else if (isTypstPath(u.pathname)) {
        // Native Typst sidecar: treat the file as a template payload.
        // (We mount it and include it, so users can write pure Typst styling.)
        const headerObj = extractMdtypstJsonHeaderFromTyp(text);
        const normalized = headerObj ? normalizeSidecarObject(headerObj) : { metadata: {}, typst: {} };
        return {
          url,
          metadata: normalized.metadata || {},
          typst: {
            ...(normalized.typst || {}),
            templateText: text,
          },
        };
      } else {
        // Unknown extension: attempt JSON first, then YAML.
        try {
          raw = JSON.parse(text);
        } catch {
          raw = parseFlatYaml(text);
        }
      }

      return { url, ...normalizeSidecarObject(raw) };
    } catch {
      // If parsing fails, treat as no sidecar.
      return null;
    }
  }

  return null;
}

export async function loadTypstTemplateText(sidecar, { documentUrl } = {}) {
  const inlineTemplate = sidecar?.typst?.templateText;
  if (typeof inlineTemplate === 'string' && inlineTemplate.trim()) {
    return { url: sidecar?.url || '(inline)', text: inlineTemplate };
  }

  const template = sidecar?.typst?.template;
  if (!template || typeof template !== 'string') return null;

  let base;
  try {
    base = documentUrl ? new URL(documentUrl, window.location.href).toString() : window.location.href;
  } catch {
    base = window.location.href;
  }

  let abs;
  try {
    // Resolve relative templates relative to the markdown document.
    abs = new URL(template, base).toString();
  } catch {
    return null;
  }

  const text = await tryFetchText(abs);
  if (text == null) return null;
  return { url: abs, text };
}

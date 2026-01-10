import { fetchWithCache } from './cache.js';

function isTypstPath(pathname) {
  return /\.typ$/i.test(pathname);
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
  // - foo.md -> foo.mdtypst.typ
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

  urls.push(typUrl);
  return urls;
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
      if (!isTypstPath(u.pathname)) {
        // JSON/YAML sidecars are no longer supported.
        continue;
      }

      if (isTypstPath(u.pathname)) {
        // Native Typst sidecar: treat the file as a template payload.
        // (We mount it and include it, so users can write pure Typst styling.)
        return {
          url,
          metadata: {},
          typst: {
            templateText: text,
          },
        };
      }
    } catch {
      // If parsing fails, treat as no sidecar.
      return null;
    }
  }

  return null;
}

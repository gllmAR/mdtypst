import { fetchWithCache } from './cache.js';

function fnv1a32Hex(input) {
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
    const p = u.pathname || '';
    const m = p.match(/\.(png|jpe?g|gif|svg|webp|bmp|tiff?|avif)$/i);
    return m ? `.${m[1].toLowerCase()}` : '.bin';
  } catch {
    return '.bin';
  }
}

export function resolveLocalAsset(src, documentUrl) {
  try {
    if (!src) return null;

    if (/^data:/i.test(src)) return null;

    if (src.startsWith('/assets/')) {
      return { fetchUrl: null, shadowPath: src };
    }

    if (/^https?:/i.test(src)) {
      try {
        const u = new URL(src);
        if (u.origin === 'https://github.com' || u.origin === 'https://www.github.com') {
          return null;
        }

        // Twemoji SVGs: keep a stable, readable path so Typst can treat them specially.
        // Supported examples:
        // - https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/<code>.svg
        // - https://twemoji.maxcdn.com/v/latest/svg/<code>.svg
        // - https://cdnjs.cloudflare.com/ajax/libs/twemoji/<ver>/svg/<code>.svg
        const twemojiMatch = u.pathname.match(/\/svg\/([0-9a-f-]+)\.svg$/i);
        if (twemojiMatch) {
          const code = String(twemojiMatch[1]).toLowerCase();
          const shadowPath = `/assets/twemoji/${code}.svg`;
          return { fetchUrl: src, shadowPath };
        }
      } catch {
        // ignore
      }
      const shadowPath = `/assets/remote/${fnv1a32Hex(src)}${assetExtFromUrl(src)}`;
      return { fetchUrl: src, shadowPath };
    }

    let abs;
    if (src.startsWith('/')) {
      abs = new URL(src, window.location.origin);
    } else if (src.startsWith('test/')) {
      abs = new URL(`/${src}`, window.location.origin);
    } else {
      if (!documentUrl) return null;
      const base = new URL(documentUrl, window.location.href);
      abs = new URL(src, base);
    }

    if (abs.origin === window.location.origin) {
      return { fetchUrl: abs.toString(), shadowPath: abs.pathname };
    }

    const fetchUrl = abs.toString();

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

async function transcodeJpegToPngBytes(jpegBytes) {
  try {
    const jpegBlob = new Blob([jpegBytes], { type: 'image/jpeg' });

    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(jpegBlob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!pngBlob) return null;
      return new Uint8Array(await pngBlob.arrayBuffer());
    }

    const imgUrl = URL.createObjectURL(jpegBlob);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = imgUrl;
      if (typeof img.decode === 'function') {
        await img.decode();
      } else {
        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image decode failed'));
        });
      }

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!pngBlob) return null;
      return new Uint8Array(await pngBlob.arrayBuffer());
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  } catch {
    return null;
  }
}

export async function mountAndRewriteImages(markdown, documentUrl, $typst, ctx) {
  if (!$typst || typeof $typst.mapShadow !== 'function') return markdown;

  const { markTiming, debugLog, incCounter, timings, jpegMode = 'native' } = ctx || {};

  markTiming?.('images:scan:start');
  debugLog?.('images: scan:start');

  const mdImageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+("[^"]*"|'[^']*'))?\)/g;
  const htmlImgRegex = /<img\b[^>]*\bsrc\s*=\s*("[^"]+"|'[^']+'|[^\s>]+)[^>]*>/gi;

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

  const mounted = new Map();
  const failed = new Set();

  if (timings?.counters) timings.counters.imagesTotal = srcs.length;

  markTiming?.('images:scan:done');
  debugLog?.('images: scan:done', { total: srcs.length });

  const timeoutMs = 2500;
  const concurrency = 6;

  if (timings?.counters) {
    timings.counters.imagesMounted = 0;
    timings.counters.imagesFailed = 0;
    timings.counters.imagesFetchedBytes = 0;
    timings.counters.imagesFetchMs = 0;
    timings.counters.imagesJpegCount = 0;
    timings.counters.imagesJpegTranscoded = 0;
  }

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
      incCounter?.('imagesFailed');
      return;
    }

    if (resolved.fetchUrl == null) {
      mounted.set(rawSrc, resolved.shadowPath);
      incCounter?.('imagesMounted');
      return;
    }

    try {
      const t0 = performance.now();
      const resp = await fetchWithCache(resolved.fetchUrl, { timeoutMs });
      if (!resp.ok) {
        failed.add(rawSrc);
        incCounter?.('imagesFailed');
        return;
      }

      const buf = await resp.arrayBuffer();
      const t1 = performance.now();

      if (timings?.counters) {
        timings.counters.imagesFetchedBytes += buf.byteLength;
        timings.counters.imagesFetchMs += (t1 - t0);
      }

      let shadowPath = resolved.shadowPath;
      let bytesToMount = new Uint8Array(buf);
      const looksLikeJpeg = /\.(jpe?g)$/i.test(shadowPath) || /\.(jpe?g)(\?|#|$)/i.test(resolved.fetchUrl);
      if (looksLikeJpeg) {
        if (timings?.counters) timings.counters.imagesJpegCount += 1;
        if (jpegMode === 'transcode') {
          const pngBytes = await transcodeJpegToPngBytes(bytesToMount);
          if (pngBytes && pngBytes.byteLength > 0) {
            shadowPath = shadowPath.replace(/\.(jpe?g)$/i, '.png');
            bytesToMount = pngBytes;
            if (timings?.counters) timings.counters.imagesJpegTranscoded += 1;
          }
        }
      }

      await $typst.mapShadow(shadowPath, bytesToMount);
      mounted.set(rawSrc, shadowPath);
      incCounter?.('imagesMounted');
    } catch {
      failed.add(rawSrc);
      incCounter?.('imagesFailed');
    }
  });

  markTiming?.('images:fetch:start');
  await runPool(tasks, concurrency);
  markTiming?.('images:fetch:done');
  markTiming?.('images:mounted');

  debugLog?.('images: mounted', {
    total: timings?.counters?.imagesTotal ?? srcs.length,
    mounted: timings?.counters?.imagesMounted ?? 0,
    failed: timings?.counters?.imagesFailed ?? 0,
    fetchedBytes: timings?.counters?.imagesFetchedBytes ?? 0,
    fetchMs: Math.round(timings?.counters?.imagesFetchMs ?? 0),
  });

  let rewritten = markdown.replace(mdImageRegex, (_full, alt, src, title) => {
    const shadow = mounted.get(src);
    if (shadow) {
      return `![${alt}](${shadow}${title ? ` ${title}` : ''})`;
    }

    const label = (alt && String(alt).trim()) ? String(alt).trim() : src;
    return `Image unavailable: ${label}`;
  });

  rewritten = rewritten.replace(htmlImgRegex, (fullTag) => {
    const srcMatch = fullTag.match(/\bsrc\s*=\s*("[^"]+"|'[^']+'|[^\s>]+)/i);
    if (!srcMatch) return 'Image unavailable';
    const raw = srcMatch[1].replace(/^['"]|['"]$/g, '');
    const shadow = mounted.get(raw);
    if (!shadow) {
      const altMatch = fullTag.match(/\balt\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i);
      const alt = altMatch ? altMatch[1].replace(/^['"]|['"]$/g, '') : '';
      return `Image unavailable: ${alt || raw}`;
    }

    return fullTag.replace(srcMatch[1], `"${shadow}"`);
  });

  return rewritten;
}

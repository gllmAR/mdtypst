export async function renderMermaidBlocksToSvgAssets(markdown, { markTiming, debugLog, updateStatus } = {}) {
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

  if (matches.length === 0) return { transformedMarkdown: markdown, svgAssets: [] };

  updateStatus?.('Rendering Mermaid diagrams...');

  const localMermaid = new URL('../vendor/mermaid/mermaid.esm.min.mjs', import.meta.url);
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
    // eslint-disable-next-line no-console
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
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      const { svg } = await mermaid.render(renderId, code);
      const t1 = typeof performance !== 'undefined' ? performance.now() : 0;
      svgAssets.push({ path: assetPath, svg });
      debugLog?.('mermaid: rendered', { i, ms: Math.round(t1 - t0) });

      // Replace Mermaid fence with a regular Markdown image.
      transformed += `\n![Mermaid diagram](${assetPath})\n`;
    } catch (e) {
      // Keep the original fence so fallback rendering can still proceed.
      // eslint-disable-next-line no-console
      console.warn('Failed to render Mermaid block; leaving as code fence.', e);
      transformed += markdown.slice(start, end);
    }

    cursor = end;
  }

  transformed += markdown.slice(cursor);

  markTiming?.('mermaid:done');
  return { transformedMarkdown: transformed, svgAssets };
}

// Minimal Twemoji-based emoji rendering.
// Rewrites emoji characters to inline Markdown images pointing at the Twemoji SVG CDN.

const DEFAULT_TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/';

function toTwemojiCode(emoji) {
  // Build Twemoji filename from Unicode code points.
  // Keep FE0F (emoji presentation), drop FE0E (text presentation).
  const cps = [];
  for (const ch of String(emoji)) {
    const cp = ch.codePointAt(0);
    if (cp == null) continue;
    if (cp === 0xfe0e) continue;
    cps.push(cp.toString(16));
  }
  return cps.join('-');
}

function replaceEmojiInTextSegment(text, { baseUrl }) {
  // Rough-but-practical emoji matching:
  // - Extended pictographic sequences (incl. ZWJ)
  // - Regional indicator pairs (flags)
  // - Keycap sequences (#️⃣, 1️⃣, etc)
  // - Optional emoji modifiers (skin tones)
  const re = /(?:[#*0-9]\uFE0F?\u20E3|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*)/gu;
  return String(text).replace(re, (m) => {
    const code = toTwemojiCode(m);
    if (!code) return m;
    const url = `${baseUrl}${code}.svg`;
    // Use an inline image so both cmarker and the fallback renderer can render it.
    return `![${m}](${url})`;
  });
}

export function rewriteEmojiToTwemojiImages(markdown, options = {}) {
  const enabled = options?.enabled !== false;
  if (!enabled) return markdown;

  const baseUrl = String(options?.baseUrl || DEFAULT_TWEMOJI_BASE);

  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const out = [];

  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }

    if (inFence) {
      out.push(line);
      continue;
    }

    // Avoid touching inline code spans by splitting on backticks.
    const parts = String(line).split('`');
    for (let i = 0; i < parts.length; i += 2) {
      parts[i] = replaceEmojiInTextSegment(parts[i], { baseUrl });
    }
    out.push(parts.join('`'));
  }

  return out.join('\n');
}

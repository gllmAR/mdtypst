async function getRuntimeCache() {
  try {
    if (!('caches' in globalThis)) return null;
    return await caches.open('mdtypst-v1');
  } catch {
    return null;
  }
}

export async function fetchWithCache(url, { timeoutMs = 0 } = {}) {
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

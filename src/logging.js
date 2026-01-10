export function createTimings() {
  return { marks: {}, counters: {} };
}

export function createLogger({ debugEnabled, timings }) {
  const debugLog = (...args) => {
    if (!debugEnabled) return;
    try {
      const t = typeof performance !== 'undefined' ? Math.round(performance.now()) : 0;
      // eslint-disable-next-line no-console
      console.log(`[mdtypst +${t}ms]`, ...args);
    } catch {
      // ignore
    }
  };

  const markTiming = (name) => {
    try {
      timings.marks[name] = performance.now();
    } catch {
      // ignore
    }
  };

  const incCounter = (name, by = 1) => {
    timings.counters[name] = (timings.counters[name] || 0) + by;
  };

  return { debugLog, markTiming, incCounter };
}

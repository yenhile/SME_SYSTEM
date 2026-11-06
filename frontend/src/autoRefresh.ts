const DEFAULT_INTERVAL_MS = 60_000;

interface AutoRefreshOptions {
  refresh: () => void;
  intervalMs?: number;
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  doc?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
}

export function startAutoRefresh({ refresh, intervalMs = DEFAULT_INTERVAL_MS, target = window, doc = document }: AutoRefreshOptions): () => void {
  const refreshIfVisible = () => { if (doc.visibilityState === 'visible') refresh(); };
  const timer = setInterval(refreshIfVisible, intervalMs);
  target.addEventListener('focus', refreshIfVisible);
  doc.addEventListener('visibilitychange', refreshIfVisible);
  return () => {
    clearInterval(timer);
    target.removeEventListener('focus', refreshIfVisible);
    doc.removeEventListener('visibilitychange', refreshIfVisible);
  };
}

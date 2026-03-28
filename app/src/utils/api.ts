import type { LatestData, NewsArticle } from '../types';

const API = 'http://localhost:8000';

export async function fetchLatest(): Promise<LatestData | null> {
  try {
    const r = await fetch(`${API}/latest`, { signal: AbortSignal.timeout(5000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function fetchNews(tickers: string[]): Promise<NewsArticle[]> {
  const r = await fetch(
    `${API}/news?tickers=${encodeURIComponent(tickers.join(','))}`,
    { signal: AbortSignal.timeout(20000) }
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()).articles ?? [];
}

export async function checkHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Analysis from './pages/Analysis';
import Portfolio from './pages/Portfolio';
import News from './pages/News';
import { fetchLatest, checkHealth } from './utils/api';
import type { Holding, LatestData } from './types';

const DEFAULT_HOLDINGS: Holding[] = [
  { ticker: 'AAPL', name: 'Apple Inc.',      shares: 10, avgBuyPrice: 145 },
  { ticker: 'NVDA', name: 'NVIDIA Corp.',    shares: 5,  avgBuyPrice: 410 },
  { ticker: 'MSFT', name: 'Microsoft Corp.', shares: 8,  avgBuyPrice: 290 },
  { ticker: 'TSLA', name: 'Tesla Inc.',      shares: 3,  avgBuyPrice: 220 },
];

const MAX_HISTORY = 3;

type Page = 'analysis' | 'portfolio' | 'news';

function loadHoldings(): Holding[] {
  try {
    const s = localStorage.getItem('yield_holdings');
    return s ? JSON.parse(s) : DEFAULT_HOLDINGS;
  } catch {
    return DEFAULT_HOLDINGS;
  }
}

function loadHistory(): LatestData[] {
  try {
    const s = localStorage.getItem('yield_history');
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [page, setPage]           = useState<Page>('analysis');
  const [holdings, setHoldings]   = useState<Holding[]>(loadHoldings);
  const [history, setHistory]     = useState<LatestData[]>(loadHistory);
  const [engineLive, setEngineLive] = useState<boolean | null>(null);

  const saveHoldings = useCallback((h: Holding[]) => {
    setHoldings(h);
    localStorage.setItem('yield_holdings', JSON.stringify(h));
  }, []);

  const refresh = useCallback(async () => {
    const raw = await fetchLatest();
    if (!raw?.result) return;
    const data: LatestData = { ...raw, scannedAt: new Date().toISOString() };

    setHistory(prev => {
      // Deduplicate: only push if the article title changed from the most recent entry
      if (prev[0]?.request?.title === data.request?.title) return prev;
      const next = [data, ...prev].slice(0, MAX_HISTORY);
      localStorage.setItem('yield_history', JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 8000);
    return () => clearInterval(iv);
  }, [refresh]);

  useEffect(() => {
    const check = async () => setEngineLive(await checkHealth());
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  // Expose latest as the first history entry
  const latestData = history[0] ?? null;

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} holdings={holdings} engineLive={engineLive} />
      <main className="main">
        {page === 'analysis'  && <Analysis history={history} holdings={holdings} />}
        {page === 'portfolio' && <Portfolio holdings={holdings} setHoldings={saveHoldings} latestData={latestData} />}
        {page === 'news'      && <News holdings={holdings} />}
      </main>
    </div>
  );
}

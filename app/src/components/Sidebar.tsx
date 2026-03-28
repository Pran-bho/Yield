import { colorFor, fmt$, fmtPct } from '../utils/format';
import type { Holding } from '../types';

type Page = 'analysis' | 'portfolio' | 'news';

interface Props {
  page: Page;
  setPage: (p: Page) => void;
  holdings: Holding[];
  engineLive: boolean | null;
}

export default function Sidebar({ page, setPage, holdings, engineLive }: Props) {
  const tv = holdings.reduce((s, h) => s + h.shares * h.avgBuyPrice, 0);
  const dotClass = `dot${engineLive === true ? ' live' : engineLive === false ? ' dead' : ''}`;
  const engLabel = engineLive === null ? 'checking…' : engineLive ? 'ENGINE LIVE' : 'ENGINE OFFLINE';

  return (
    <nav className="sidebar">
      <div className="wordmark">◈ YIELD<span>.</span></div>
      <div className="tagline">portfolio intelligence</div>

      <div className="nav">
        {(['analysis', 'portfolio', 'news'] as Page[]).map(p => (
          <button
            key={p}
            className={`nav-btn${page === p ? ' active' : ''}`}
            onClick={() => setPage(p)}
          >
            {p === 'analysis'  && '📡\u00a0 Analysis'}
            {p === 'portfolio' && '📊\u00a0 Portfolio'}
            {p === 'news'      && '📰\u00a0 News'}
          </button>
        ))}
      </div>

      <hr className="divider" />
      <div className="sec-label">Holdings</div>

      {holdings.length > 0 ? (
        <>
          <div style={{ marginBottom: 8 }}>
            <div className="stat-row">
              <span className="stat-l">book value</span>
              <span className="stat-a">{fmt$(tv)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-l">positions</span>
              <span className="stat-v">{holdings.length}</span>
            </div>
          </div>
          <hr className="divider" style={{ margin: '8px 0' }} />
          {holdings.map(h => {
            const pct = tv > 0 ? (h.shares * h.avgBuyPrice) / tv * 100 : 0;
            return (
              <div key={h.ticker} className="sb-ticker">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className="sb-dot" style={{ background: colorFor(h.ticker) }} />
                  <span style={{ fontSize: 10 }}>{h.ticker}</span>
                </div>
                <span style={{ fontSize: 9, color: 'var(--fg3)' }}>{fmtPct(pct)}</span>
              </div>
            );
          })}
        </>
      ) : (
        <div style={{ fontSize: 9, color: 'var(--fg3)' }}>No positions</div>
      )}

      <div className="engine">
        <div className={dotClass} />
        <span>{engLabel}</span>
      </div>
    </nav>
  );
}

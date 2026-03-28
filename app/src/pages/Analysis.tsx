import { useState } from 'react';
import type { LatestData, Holding } from '../types';
import SuggestionCard from '../components/SuggestionCard';
import { colorFor, fmt$, fmtPct, timeAgo } from '../utils/format';

interface Props {
  history: LatestData[];
  holdings: Holding[];
}

function PillSentiment({ s }: { s: string }) {
  if (s === 'positive') return <span className="pill pill-pos">▲ positive</span>;
  if (s === 'negative') return <span className="pill pill-neg">▼ negative</span>;
  return <span className="pill pill-neu">— neutral</span>;
}

export default function Analysis({ history, holdings }: Props) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = history[selectedIdx] ?? null;
  const tv = holdings.reduce((s, h) => s + h.shares * h.avgBuyPrice, 0);

  return (
    <>
      <div className="ph">
        <div className="ph-title">◈ YIELD<span>.</span></div>
        <div className="ph-sub">news intelligence · portfolio impact</div>
      </div>

      {/* ── History selector ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {Array.from({ length: 3 }).map((_, i) => {
          const entry = history[i];
          const active = i === selectedIdx && !!entry;
          return (
            <button
              key={i}
              onClick={() => entry && setSelectedIdx(i)}
              style={{
                flex: 1,
                background: active ? 'var(--bg2)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 3,
                padding: '8px 10px',
                cursor: entry ? 'pointer' : 'default',
                textAlign: 'left',
                transition: 'border-color .15s',
              }}
            >
              <div style={{ fontSize: 8, color: active ? 'var(--accent)' : 'var(--fg3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>
                {i === 0 ? 'Latest' : `−${i}`}
                {entry?.scannedAt && (
                  <span style={{ float: 'right', color: 'var(--fg3)', fontWeight: 400 }}>
                    {timeAgo(entry.scannedAt)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: entry ? 'var(--fg2)' : 'var(--fg3)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {entry ? (entry.request?.title ?? 'Untitled article').slice(0, 48) : '— empty slot'}
              </div>
            </button>
          );
        })}
      </div>

      {!selected ? (
        <div className="no-data">
          <div className="no-data-icon">◈</div>
          Scan a page with the browser extension to see live analysis.
        </div>
      ) : (
        <AnalysisContent data={selected} holdings={holdings} totalValue={tv} />
      )}
    </>
  );
}

function AnalysisContent({ data, holdings, totalValue }: { data: LatestData; holdings: Holding[]; totalValue: number }) {
  const { result, request = {} } = data;
  const sent    = result.sentiment ?? 'neutral';
  const details = result.impactDetails ?? [];
  const impMap  = Object.fromEntries(details.map(d => [d.ticker.toUpperCase(), d]));
  const ac      = details.length ? details.reduce((s, d) => s + (d.confidence ?? 0), 0) / details.length : 0;
  const pc      = details.filter(d => d.sentiment === 'positive').length;
  const nc      = details.filter(d => d.sentiment === 'negative').length;
  // Weighted sentiment score: +1 per positive signal × confidence, −1 per negative
  const sentScore = details.reduce((s, d) => {
    const w = d.confidence ?? 0.5;
    return s + (d.sentiment === 'positive' ? w : d.sentiment === 'negative' ? -w : 0);
  }, 0);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="sec-label" style={{ marginBottom: 0, borderBottom: 'none' }}>Live Analysis</div>
        <span className="auto-badge">● AUTO · 8 s</span>
      </div>

      <div className="sumbox">
        <div className="sumbox-src">
          <PillSentiment s={sent} />&nbsp;&nbsp;
          <span style={{ color: 'var(--fg3)' }}>source · </span>
          <span style={{ color: '#6a6a62', fontStyle: 'italic' }}>
            {(request.title ?? '').slice(0, 100)}{(request.title ?? '').length > 100 ? '…' : ''}
          </span>
        </div>
        <div className="sumbox-txt">{result.summary ?? ''}</div>
      </div>

      {!details.length ? (
        <div className="no-data" style={{ padding: 30 }}>
          No significant impact detected for your current holdings.
        </div>
      ) : (
        <>
          <div className="stats-strip">
            <div className="ss-item">
              <div className="ss-l">signals fired</div>
              <div className="ss-v">{details.length}</div>
            </div>
            <div className="ss-item">
              <div className="ss-l">avg confidence</div>
              <div className="ss-v a">{Math.round(ac * 100)}%</div>
            </div>
            <div className="ss-item">
              <div className="ss-l">bullish</div>
              <div className="ss-v p">{pc}</div>
            </div>
            <div className="ss-item">
              <div className="ss-l">bearish</div>
              <div className="ss-v n">{nc}</div>
            </div>
            <div className="ss-item">
              <div className="ss-l">sentiment score</div>
              <div className={`ss-v ${sentScore > 0 ? 'p' : sentScore < 0 ? 'n' : ''}`}>
                {sentScore >= 0 ? '+' : ''}{sentScore.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="sec-label">Holding Impact & Position Guidance</div>
          <div className="grid2">
            {details.map(d => (
              <SuggestionCard key={d.ticker} detail={d} holdings={holdings} totalValue={totalValue} />
            ))}
          </div>

          <div className="sec-label" style={{ marginTop: 22 }}>Portfolio Snapshot</div>
          <table className="snap-table">
            <thead>
              <tr>
                <th>Ticker</th><th>Name</th><th>Shares</th>
                <th>Avg Buy</th><th>Position</th><th>Alloc</th><th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map(h => {
                const tk  = h.ticker.toUpperCase();
                const pv  = h.shares * h.avgBuyPrice;
                const pct = totalValue > 0 ? pv / totalValue * 100 : 0;
                const imp = impMap[tk];
                const s   = imp?.sentiment ?? '';
                const fl  = s === 'positive' ? '▲' : s === 'negative' ? '▼' : '—';
                const sc  = s === 'positive' ? '#c8f060' : s === 'negative' ? '#f06060' : 'var(--fg3)';
                return (
                  <tr key={tk}>
                    <td>
                      <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: colorFor(tk) }}>
                        {tk}
                      </span>
                    </td>
                    <td style={{ color: 'var(--fg2)' }}>{h.name}</td>
                    <td>{h.shares}</td>
                    <td>${h.avgBuyPrice.toFixed(2)}</td>
                    <td>{fmt$(pv)}</td>
                    <td>{fmtPct(pct)}</td>
                    <td style={{ color: sc }}>{fl} {s.toUpperCase() || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 8, color: '#2a2a28', marginTop: 6, letterSpacing: '0.06em' }}>
            Half-Kelly Criterion · b=1.5 · For informational purposes only.
          </div>
        </>
      )}
    </>
  );
}

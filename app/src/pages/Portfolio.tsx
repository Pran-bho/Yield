import { useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import type { Holding, LatestData } from '../types';
import SuggestionCard from '../components/SuggestionCard';
import { PRESETS, colorFor, fmt$, fmtPct } from '../utils/format';

Chart.register(ArcElement, Tooltip, Legend);

interface Props {
  holdings: Holding[];
  setHoldings: (h: Holding[]) => void;
  latestData: LatestData | null;
}

function PillSentiment({ s }: { s: string }) {
  if (s === 'positive') return <span className="pill pill-pos">▲ positive</span>;
  if (s === 'negative') return <span className="pill pill-neg">▼ negative</span>;
  return <span className="pill pill-neu">— neutral</span>;
}

export default function Portfolio({ holdings, setHoldings, latestData }: Props) {
  const have      = new Set(holdings.map(h => h.ticker));
  const available = PRESETS.filter(p => !have.has(p.ticker));

  const [addTicker, setAddTicker] = useState(available[0]?.ticker ?? '');
  const [addName,   setAddName]   = useState(available[0]?.name ?? '');
  const [addShares, setAddShares] = useState('');
  const [addPrice,  setAddPrice]  = useState('');

  const tv = holdings.reduce((s, h) => s + h.shares * h.avgBuyPrice, 0);

  function handleTickerChange(tk: string) {
    setAddTicker(tk);
    const p = PRESETS.find(x => x.ticker === tk);
    if (p) setAddName(p.name);
  }

  function addPosition() {
    const sh = parseFloat(addShares), pr = parseFloat(addPrice);
    if (!addTicker || !sh || !pr || isNaN(sh) || isNaN(pr)) return;
    if (holdings.find(h => h.ticker === addTicker)) return;
    setHoldings([...holdings, { ticker: addTicker, name: addName || addTicker, shares: sh, avgBuyPrice: pr }]);
    setAddShares('');
    setAddPrice('');
  }

  function removeHolding(i: number) {
    const next = [...holdings];
    next.splice(i, 1);
    setHoldings(next);
  }

  const chartData = {
    labels: holdings.map(h => h.ticker),
    datasets: [{
      data: holdings.map(h => h.shares * h.avgBuyPrice),
      backgroundColor: holdings.map(h => colorFor(h.ticker)),
      borderColor: '#0a0a0a',
      borderWidth: 2,
    }],
  };

  const chartOptions = {
    cutout: '62%' as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (c: { raw: number }) =>
            ` ${fmt$(c.raw)}  (${tv > 0 ? (c.raw / tv * 100).toFixed(1) : 0}%)`,
        },
        backgroundColor: '#111110' as const,
        borderColor: '#2a2a28' as const,
        borderWidth: 1,
        titleColor: '#e8e4dc' as const,
        bodyColor: '#7a7a70' as const,
        titleFont: { family: "'Syne', sans-serif", weight: 'bold' as const },
        bodyFont:  { family: "'DM Mono', monospace", size: 11 },
      },
    },
    animation: { duration: 400 },
  };

  const details = latestData?.result?.impactDetails ?? [];
  const sent    = latestData?.result?.sentiment ?? 'neutral';
  const request = latestData?.request ?? {};

  return (
    <>
      <div className="ph">
        <div className="ph-title">◈ PORTFOLIO<span>.</span></div>
        <div className="ph-sub">allocation · position guidance</div>
      </div>

      <div className="grid2" style={{ marginBottom: 22 }}>
        {/* Allocation chart */}
        <div className="card">
          <div className="sec-label">Allocation</div>
          {holdings.length > 0 ? (
            <>
              <div className="chart-wrap">
                <Doughnut data={chartData} options={chartOptions} />
                <div className="chart-center">
                  <div className="chart-val">{fmt$(tv)}</div>
                  <div className="chart-lbl">book value</div>
                </div>
              </div>
              <div className="legend">
                {holdings.map(h => (
                  <div key={h.ticker} className="legend-item">
                    <div className="cdot" style={{ background: colorFor(h.ticker) }} />
                    {h.ticker}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="no-data">No positions yet.</div>
          )}
        </div>

        {/* Positions list + add form */}
        <div className="card">
          <div className="sec-label">Positions</div>
          {holdings.length === 0 ? (
            <div style={{ color: 'var(--fg3)', fontSize: 10, padding: '12px 0' }}>
              No positions. Add one below.
            </div>
          ) : (
            holdings.map((h, i) => {
              const pv  = h.shares * h.avgBuyPrice;
              const pct = tv > 0 ? pv / tv * 100 : 0;
              return (
                <div key={h.ticker} className="pos-row">
                  <div>
                    <div className="pos-ticker" style={{ color: colorFor(h.ticker) }}>{h.ticker}</div>
                    <div className="pos-meta">{h.shares} sh @ ${h.avgBuyPrice.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--accent)' }}>{fmtPct(pct)}</div>
                    <div style={{ fontSize: 9, color: 'var(--fg3)' }}>{fmt$(pv)}</div>
                  </div>
                  <button className="btn-rm" onClick={() => removeHolding(i)}>×</button>
                </div>
              );
            })
          )}

          <hr className="divider" style={{ marginTop: 10 }} />
          <div className="sec-label">Add Position</div>
          <div className="add-form">
            <div className="fg">
              <label>Instrument</label>
              <select value={addTicker} onChange={e => handleTickerChange(e.target.value)}>
                {available.map(p => (
                  <option key={p.ticker} value={p.ticker}>{p.ticker} · {p.name}</option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label>Name</label>
              <input
                type="text"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder="Company"
              />
            </div>
            <div className="fg">
              <label>Shares</label>
              <input
                type="number"
                value={addShares}
                onChange={e => setAddShares(e.target.value)}
                min={0} step={0.1} placeholder="0"
              />
            </div>
            <div className="fg">
              <label>Avg Buy ($)</label>
              <input
                type="number"
                value={addPrice}
                onChange={e => setAddPrice(e.target.value)}
                min={0} step={0.01} placeholder="0.00"
              />
            </div>
            <div className="fg">
              <label>&nbsp;</label>
              <button className="btn-primary" onClick={addPosition}>Add →</button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Suggestions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div className="sec-label" style={{ marginBottom: 0, borderBottom: 'none' }}>AI Suggestions</div>
        <span className="auto-badge">● LIVE · 8 s</span>
      </div>

      {!latestData?.result ? (
        <div className="no-data" style={{ padding: 40 }}>
          <div className="no-data-icon">◈</div>
          Scan an article with the browser extension to generate suggestions.
        </div>
      ) : (
        <>
          <div className="sumbox" style={{ marginBottom: 18 }}>
            <div className="sumbox-src">
              <PillSentiment s={sent} />&nbsp;&nbsp;
              <span style={{ color: 'var(--fg3)' }}>source · </span>
              <span style={{ color: '#6a6a62', fontStyle: 'italic' }}>
                {(request.title ?? '').slice(0, 90)}{(request.title ?? '').length > 90 ? '…' : ''}
              </span>
            </div>
            <div className="sumbox-txt">{latestData.result.summary ?? ''}</div>
          </div>

          {details.length > 0 ? (
            <>
              {(() => {
                const ac = details.reduce((s, d) => s + (d.confidence ?? 0), 0) / details.length;
                const pc = details.filter(d => d.sentiment === 'positive').length;
                const nc = details.filter(d => d.sentiment === 'negative').length;
                return (
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
                  </div>
                );
              })()}
              <div className="grid2">
                {details.map(d => <SuggestionCard key={d.ticker} detail={d} holdings={holdings} totalValue={tv} />)}
              </div>
              <div style={{ fontSize: 8, color: '#2a2a28', marginTop: 6, letterSpacing: '0.06em' }}>
                Half-Kelly Criterion · b=1.5 · For informational purposes only.
              </div>
            </>
          ) : (
            <div className="no-data" style={{ padding: 30 }}>No holdings impacted by this article.</div>
          )}
        </>
      )}
    </>
  );
}

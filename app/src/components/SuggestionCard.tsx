import type { ImpactDetail, Holding } from '../types';
import { colorFor, fmtPct, fmt$ } from '../utils/format';
import { kelly, kellyInterp } from '../utils/kelly';

interface Props {
  detail: ImpactDetail;
  holdings: Holding[];
  totalValue: number;
}

function PillSentiment({ s }: { s: string }) {
  if (s === 'positive') return <span className="pill pill-pos">▲ positive</span>;
  if (s === 'negative') return <span className="pill pill-neg">▼ negative</span>;
  return <span className="pill pill-neu">— neutral</span>;
}

function PillAction({ a }: { a: string }) {
  if (a === 'increase') return <span className="ap ap-inc">↑ increase</span>;
  if (a === 'reduce')   return <span className="ap ap-red">↓ reduce</span>;
  return <span className="ap ap-mnt">· maintain</span>;
}

export default function SuggestionCard({ detail, holdings, totalValue }: Props) {
  const tk        = detail.ticker.toUpperCase();
  const sent      = detail.sentiment ?? 'neutral';
  const conf      = detail.confidence ?? 0.5;
  const reasoning = detail.reasoning ?? '';

  // Split reasoning into signal summary + strongest evidence quote
  let justification = reasoning, ev = '';
  if (reasoning.includes('Strongest evidence:')) {
    const [a, b]  = reasoning.split('Strongest evidence:');
    justification = a.replace('Detected ', '').replace(' in the article.', '').trim();
    ev            = (b ?? '').trim().replace(/^"|"$/g, '');
  }

  const h      = holdings.find(x => x.ticker.toUpperCase() === tk);
  const curPct = h && totalValue > 0 ? h.shares * h.avgBuyPrice / totalValue * 100 : 0;
  const f      = kelly(sent, conf);
  const kd     = (h && totalValue > 0)
    ? (() => { const r = kellyInterp(f, curPct); if (!r.sugPct) r.sugPct = curPct; return r; })()
    : { action: 'maintain' as const, halfKelly: 0, sugPct: curPct, deltaPct: 0 };

  // 4th stat: implied dollar position change
  const impliedDelta = kd.deltaPct / 100 * totalValue;

  const cp = Math.round(conf * 100);
  const cc = cp >= 65 ? '#c8f060' : cp >= 40 ? '#f0b060' : '#4a4a42';
  const bp = Math.min(Math.abs(kd.halfKelly) * 200, 100);
  const bg = f >= 0
    ? 'linear-gradient(90deg,#3a5a12,#c8f060)'
    : 'linear-gradient(90deg,#5a1212,#f06060)';

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: colorFor(tk) }}>{tk}</span>
        <PillSentiment s={sent} />
      </div>

      {/* Confidence */}
      <div className="stat-row">
        <span className="stat-l">confidence</span>
        <span style={{ color: cc, fontSize: 11, fontWeight: 500 }}>{cp}%</span>
      </div>
      <div className="bar-wrap">
        <div className="bar-fill" style={{ width: `${cp}%`, background: cc }} />
      </div>

      {/* Justification */}
      <div style={{ fontSize: 8, color: 'var(--fg3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
        Justification
      </div>
      <div style={{ fontSize: 10, color: '#8a8a80', lineHeight: 1.55, marginBottom: ev ? 6 : 0 }}>
        {justification || '—'}
      </div>
      {ev && (
        <div className="evidence">
          "{ev.slice(0, 260)}{ev.length > 260 ? '…' : ''}"
        </div>
      )}

      <hr className="divider" style={{ margin: '10px 0' }} />

      {/* Kelly sizing */}
      <div className="stat-row">
        <span className="stat-l">current allocation</span>
        <span style={{ fontSize: 11 }}>{fmtPct(curPct)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-l">suggested allocation</span>
        <span style={{ fontSize: 11 }}>
          {fmtPct(kd.sugPct)}&nbsp;&nbsp;
          {kd.deltaPct > 0.05
            ? <span style={{ color: '#c8f060' }}>+{kd.deltaPct.toFixed(1)}%</span>
            : kd.deltaPct < -0.05
              ? <span style={{ color: '#f06060' }}>{kd.deltaPct.toFixed(1)}%</span>
              : <span style={{ color: '#4a4a42' }}>—</span>
          }
        </span>
      </div>
      <div className="stat-row">
        <span className="stat-l">half-kelly fraction</span>
        <span style={{ fontSize: 11 }}>{kd.halfKelly >= 0 ? '+' : ''}{kd.halfKelly.toFixed(3)}</span>
      </div>
      <div className="bar-wrap">
        <div className="bar-fill" style={{ width: `${bp.toFixed(0)}%`, background: bg }} />
      </div>

      {/* 4th stat: implied $ trade */}
      <div className="stat-row" style={{ marginTop: 6 }}>
        <span className="stat-l">implied trade</span>
        <span style={{
          fontSize: 11,
          color: impliedDelta > 50 ? '#c8f060' : impliedDelta < -50 ? '#f06060' : 'var(--fg3)',
        }}>
          {Math.abs(impliedDelta) < 50
            ? '— hold'
            : `${impliedDelta > 0 ? '↑ buy' : '↓ sell'} ${fmt$(Math.abs(impliedDelta))}`
          }
        </span>
      </div>

      <div style={{ marginTop: 9 }}>
        <PillAction a={kd.action} />
      </div>
    </div>
  );
}

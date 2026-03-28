export interface KellyResult {
  action: 'increase' | 'reduce' | 'maintain';
  halfKelly: number;
  sugPct: number;
  deltaPct: number;
}

export function kelly(sentiment: string, conf: number): number {
  const b = 1.5;
  if (sentiment === 'positive') {
    const p = 0.5 + conf * 0.35, q = 1 - p;
    return Math.max(-1, Math.min(1, (b * p - q) / b));
  }
  if (sentiment === 'negative') {
    const p = 0.5 - conf * 0.35, q = 1 - p;
    return Math.max(-1, Math.min(1, (b * p - q) / b));
  }
  return 0;
}

export function kellyInterp(f: number, curPct: number): KellyResult {
  const hk = f * 0.5;
  if (hk > 0.05) {
    const sugPct = Math.min(curPct + hk * 100 * 0.4, 30);
    return { action: 'increase', halfKelly: hk, sugPct, deltaPct: sugPct - curPct };
  }
  if (hk < -0.05) {
    const sugPct = Math.max(curPct + hk * 100 * 0.4, 0);
    return { action: 'reduce', halfKelly: hk, sugPct, deltaPct: sugPct - curPct };
  }
  return { action: 'maintain', halfKelly: hk, sugPct: curPct, deltaPct: 0 };
}

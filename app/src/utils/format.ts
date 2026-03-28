export const COLORS = [
  '#c8f060', '#60b4f0', '#f08060', '#c060f0', '#f0d060', '#60f0c0',
  '#f060a0', '#a0c060', '#60a0f0', '#f060d0', '#80f090', '#f0a040',
];

export const PRESETS = [
  { ticker: 'AAPL',  name: 'Apple Inc.',             sector: 'Consumer Tech' },
  { ticker: 'NVDA',  name: 'NVIDIA Corp.',           sector: 'Semiconductors' },
  { ticker: 'MSFT',  name: 'Microsoft Corp.',        sector: 'Cloud / Enterprise' },
  { ticker: 'TSLA',  name: 'Tesla Inc.',             sector: 'EV / Autonomy' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.',          sector: 'Ads / Cloud' },
  { ticker: 'AMZN',  name: 'Amazon.com Inc.',        sector: 'Cloud / Retail' },
  { ticker: 'META',  name: 'Meta Platforms Inc.',    sector: 'Social / Ads' },
  { ticker: 'AMD',   name: 'Advanced Micro Devices', sector: 'Semiconductors' },
  { ticker: 'TSM',   name: 'Taiwan Semiconductor',   sector: 'Foundry' },
  { ticker: 'AVGO',  name: 'Broadcom Inc.',          sector: 'Semiconductors' },
  { ticker: 'ASML',  name: 'ASML Holding NV',        sector: 'Chip Equipment' },
  { ticker: 'NFLX',  name: 'Netflix Inc.',           sector: 'Streaming' },
];

export function colorFor(ticker: string): string {
  const i = PRESETS.findIndex(p => p.ticker === ticker);
  return COLORS[i >= 0 ? i : 0];
}

export const fmt$ = (n: number) =>
  '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export const fmtPct = (n: number) => n.toFixed(1) + '%';

export function timeAgo(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

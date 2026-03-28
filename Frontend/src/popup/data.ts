import { Stock } from "../types";

export interface StockWithPrice extends Stock {
  currentPrice: number;
  priceHistory: number[];
}

// Seeded pseudo-random (mulberry32) — deterministic so charts don't change on rebuild
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Box-Muller transform — uniform -> standard normal
function normalPair(rand: () => number): [number, number] {
  const u1 = Math.max(rand(), 1e-10);
  const u2 = rand();
  const mag = Math.sqrt(-2 * Math.log(u1));
  return [mag * Math.cos(2 * Math.PI * u2), mag * Math.sin(2 * Math.PI * u2)];
}

// Geometric Brownian Motion
// drift: expected daily return (e.g. 0.0008 = +0.08%/day)
// vol:   daily volatility (e.g. 0.018 = 1.8%/day)
function gbm(start: number, days: number, drift: number, vol: number, seed: number): number[] {
  const rand = makeRng(seed);
  const prices: number[] = [start];
  for (let i = 1; i < days; i++) {
    const [z] = normalPair(rand);
    const prev = prices[i - 1];
    prices.push(prev * Math.exp(drift - 0.5 * vol * vol + vol * z));
  }
  return prices.map((p) => Math.round(p * 100) / 100);
}

const DAYS = 30;

export const HOLDINGS: StockWithPrice[] = [
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    shares: 10,
    avgBuyPrice: 145.0,
    // mild upward drift, moderate vol (~1.4%/day)
    priceHistory: gbm(163.5, DAYS, 0.0006, 0.014, 1001),
    get currentPrice() { return this.priceHistory[this.priceHistory.length - 1]; },
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corp.",
    shares: 5,
    avgBuyPrice: 410.0,
    // strong upward drift, high vol (~2.5%/day)
    priceHistory: gbm(740.0, DAYS, 0.0018, 0.025, 2002),
    get currentPrice() { return this.priceHistory[this.priceHistory.length - 1]; },
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corp.",
    shares: 8,
    avgBuyPrice: 290.0,
    // mild upward drift, low vol (~1.1%/day)
    priceHistory: gbm(382.0, DAYS, 0.0007, 0.011, 3003),
    get currentPrice() { return this.priceHistory[this.priceHistory.length - 1]; },
  },
  {
    ticker: "TSLA",
    name: "Tesla Inc.",
    shares: 3,
    avgBuyPrice: 220.0,
    // slight downward drift, very high vol (~3.0%/day) — ends underwater
    priceHistory: gbm(210.0, DAYS, -0.0012, 0.030, 4004),
    get currentPrice() { return this.priceHistory[this.priceHistory.length - 1]; },
  },
];

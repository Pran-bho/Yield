export interface Holding {
  ticker: string;
  name: string;
  shares: number;
  avgBuyPrice: number;
}

export interface ImpactDetail {
  ticker: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  reasoning: string;
}

export interface AnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  summary: string;
  impactDetails: ImpactDetail[];
}

export interface LatestData {
  result: AnalysisResult;
  request: {
    title?: string;
    url?: string;
  };
  scannedAt?: string; // ISO timestamp added by the frontend on receipt
}

export interface NewsArticle {
  ticker: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

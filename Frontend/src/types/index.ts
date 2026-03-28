export interface Holding {
  ticker: string;
  name: string;
  shares: number;
  avgBuyPrice: number;
}

export interface ImpactDetail {
  ticker: string;
  sentiment: "positive" | "negative" | "neutral";
  reasoning: string;
  confidence: number;
}

export interface AnalyseResponse {
  summary: string;
  sentiment: "positive" | "negative" | "neutral";
  affectedTickers: string[];
  impactDetails: ImpactDetail[];
}

export interface ArticleData {
  title: string;
  body: string;
}

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  ticker: string;
}

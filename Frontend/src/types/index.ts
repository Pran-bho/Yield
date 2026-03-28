export interface Stock {
  ticker: string;
  name: string;
  shares: number;
  avgBuyPrice: number;
}

export interface ArticleScanPayload {
  url: string;
  title: string;
  body: string;
  holdings: Stock[];
}

export interface AnalysisResult {
  summary: string;
  affectedTickers: string[];
  sentiment: "positive" | "negative" | "neutral";
  impactDetails: {
    ticker: string;
    reasoning: string;
    sentiment: "positive" | "negative" | "neutral";
  }[];
}

export type MessageType =
  | { type: "IS_FINANCIAL_PAGE" }
  | { type: "EXTRACT_ARTICLE" };

export type MessageResponse =
  | { isFinancial: boolean }
  | { text: string };

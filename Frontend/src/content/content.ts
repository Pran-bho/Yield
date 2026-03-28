const FINANCIAL_KEYWORDS = [
  "stock", "shares", "earnings", "revenue", "nasdaq", "nyse",
  "market cap", "dividend", "investor", "portfolio", "quarter",
  "sec filing", "ipo", "valuation", "equity", "bull market", "bear market",
  "hedge fund", "short selling", "options", "futures", "trading volume",
  "price target", "analyst", "guidance", "fiscal", "ebitda",
];

function isFinancialPage(): boolean {
  const text = document.body.innerText.toLowerCase();
  const matchCount = FINANCIAL_KEYWORDS.filter((kw) => text.includes(kw)).length;
  return matchCount >= 3;
}

function extractArticleText(): string {
  // Try progressively broader containers
  const container =
    document.querySelector("article") ??
    document.querySelector('[role="article"]') ??
    document.querySelector("main") ??
    document.querySelector('[role="main"]') ??
    document.body;

  const clone = container.cloneNode(true) as HTMLElement;

  // Strip non-content elements
  clone
    .querySelectorAll("script, style, nav, footer, header, aside, [role='navigation'], [role='banner'], [role='complementary'], .ad, .advertisement, .sidebar")
    .forEach((el) => el.remove());

  // Collapse whitespace
  const text = clone.innerText
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 8000);

  return text;
}

browser.runtime.onMessage.addListener((message: { type: string }) => {
  if (message.type === "IS_FINANCIAL_PAGE") {
    return Promise.resolve({ isFinancial: isFinancialPage() });
  }
  if (message.type === "EXTRACT_ARTICLE") {
    return Promise.resolve({ text: extractArticleText() });
  }
  return false;
});
